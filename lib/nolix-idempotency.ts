/**
 * NOLIX — Idempotency Layer (STEP 14 PART 4)
 * lib/nolix-idempotency.ts
 *
 * Prevents double-training from duplicate events.
 * Problem:
 *   - Network retry → same event arrives twice
 *   - Shopify webhook retry → same purchase processes twice
 *   - Client retry → same session event trains twice
 *
 * Solution:
 *   - Every event gets a deterministic event_id
 *   - Check nolix_event_dedup before processing
 *   - Insert with ON CONFLICT DO NOTHING (atomic)
 *   - TTL: 7 days (then cleanup)
 *
 * Ordering guarantee (PART 5):
 *   - event_sequence BIGSERIAL auto-increments
 *   - Worker processes ORDER BY event_sequence ASC
 *   - No out-of-order training
 */

import { query } from "./db";
import { createHash } from "crypto";

// ── Generate deterministic event_id ─────────────────────────────────────────
export function generateEventId(
  visitorId:  string,
  eventType:  string,
  sessionId?: string,
  timestamp?: number
): string {
  // Round timestamp to nearest 5 seconds to handle minor drift
  const ts = timestamp ? Math.round(timestamp / 5000) * 5000 : 0;
  const raw = `${visitorId}:${eventType}:${sessionId || ""}:${ts}`;
  return createHash("sha256").update(raw).digest("hex").substring(0, 32);
}

// ── Check if event was already processed ───────────────────────────────────
export async function isDuplicate(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const r = await query<any>(
      "SELECT 1 FROM nolix_event_dedup WHERE event_id=$1 LIMIT 1",
      [eventId]
    );
    return (r as any[]).length > 0;
  } catch { return false; } // fail-open: don't block on DB error
}

// ── Mark event as processed (atomic ON CONFLICT DO NOTHING) ─────────────────
export async function markProcessed(
  eventId:   string,
  eventType: string,
  visitorId?: string
): Promise<boolean> {
  if (!eventId) return true;
  try {
    await query(
      `INSERT INTO nolix_event_dedup (event_id, event_type, visitor_id, processed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, visitorId || null]
    );
    return true;
  } catch { return false; }
}

// ── Check + Mark in one atomic operation ────────────────────────────────────
// Returns true if event is NEW (should be processed)
// Returns false if event is DUPLICATE (skip it)
export async function checkAndMark(
  eventId:   string,
  eventType: string,
  visitorId?: string
): Promise<boolean> {
  if (!eventId) return true; // no ID = treat as new
  try {
    // ON CONFLICT DO NOTHING returns 0 rows affected for duplicates
    const r = await query<any>(
      `INSERT INTO nolix_event_dedup (event_id, event_type, visitor_id, processed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, eventType, visitorId || null]
    );
    const isNew = (r as any[]).length > 0;
    if (!isNew) console.log("⚡ DEDUP: Duplicate event skipped:", eventId.substring(0, 8));
    return isNew;
  } catch { return true; } // fail-open
}

// ── Cleanup old records (run daily) ──────────────────────────────────────────
export async function purgeOldDedupRecords(daysToKeep = 7): Promise<number> {
  try {
    const r = await query<any>(
      "DELETE FROM nolix_event_dedup WHERE processed_at < NOW() - ($1 * INTERVAL '1 day') RETURNING event_id",
      [daysToKeep]
    );
    return (r as any[]).length;
  } catch { return 0; }
}

// ── Get dedup stats ──────────────────────────────────────────────────────────
export async function getDedupStats(): Promise<{
  total_records: number;
  oldest_record: string | null;
  records_last_hour: number;
}> {
  try {
    const r = await query<any>(`
      SELECT
        COUNT(*)                                        AS total_records,
        MIN(processed_at)                               AS oldest_record,
        COUNT(*) FILTER (WHERE processed_at > NOW() - INTERVAL '1 hour') AS records_last_hour
      FROM nolix_event_dedup
    `);
    const row = (r as any[])[0] || {};
    return {
      total_records:     Number(row.total_records) || 0,
      oldest_record:     row.oldest_record || null,
      records_last_hour: Number(row.records_last_hour) || 0
    };
  } catch { return { total_records: 0, oldest_record: null, records_last_hour: 0 }; }
}
