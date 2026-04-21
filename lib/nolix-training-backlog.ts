/**
 * NOLIX — Training Backlog System (STEP 13.5 PART 3)
 * lib/nolix-training-backlog.ts
 *
 * When training_enabled=false (health engine blocked training),
 * events are NOT dropped. They are saved to nolix_training_backlog.
 * On recovery, processBacklogBatch() drains and trains on them.
 *
 * This closes the data loss gap completely.
 */

import { query }        from "./db";
import { flags }        from "./nolix-runtime";
import { trainOnline }  from "./nolix-ml-engine";
import { featureToArray } from "./nolix-feature-store";

export interface BacklogEvent {
  id:          number;
  features:    number[];
  label:       number;
  visitor_id:  string;
  store?:      string;
  created_at:  Date;
  processed:   boolean;
}

// ============================================================
// SAVE TO BACKLOG (when training is blocked)
// ============================================================
export async function saveToBacklog(
  visitorId: string,
  features:  number[],
  label:     number,
  store?:    string,
  meta?:     Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_training_backlog
       (visitor_id, store, features, label, event_meta, created_at, processed)
       VALUES ($1, $2, $3, $4, $5, NOW(), false)`,
      [visitorId, store || null, JSON.stringify(features), label, JSON.stringify(meta || {})]
    );
    console.log("📥 BACKLOG: Saved training event for visitor:", visitorId, "label:", label);
  } catch(e) { console.warn("⚠ BACKLOG: Save failed:", e); }
}

// ============================================================
// PROCESS BACKLOG (on recovery — runs when training re-enabled)
// ============================================================
export async function processBacklogBatch(batchSize = 1000): Promise<{
  processed: number;
  errors:    number;
  remaining: number;
}> {
  if (!flags.trainingEnabled) {
    console.warn("⚠ BACKLOG: Training still disabled. Cannot drain backlog.");
    return { processed: 0, errors: 0, remaining: -1 };
  }

  let processed = 0, errors = 0;

  try {
    // Fetch unprocessed events in FIFO order
    const rows = await query<any>(
      `SELECT id, visitor_id, store, features, label
       FROM nolix_training_backlog
       WHERE processed = false
       ORDER BY created_at ASC
       LIMIT $1`,
      [batchSize]
    );

    const events = rows as any[];
    console.log("📤 BACKLOG DRAIN: Processing", events.length, "events...");

    for (const ev of events) {
      try {
        const features: number[] = JSON.parse(ev.features);
        const label: number      = ev.label;

        if (!Array.isArray(features) || features.length !== 8) {
          errors++; continue;
        }

        trainOnline(features, label);
        processed++;

        // Mark as processed
        await query(
          `UPDATE nolix_training_backlog SET processed=true, processed_at=NOW() WHERE id=$1`,
          [ev.id]
        );
      } catch { errors++; }
    }

    // Count remaining
    const rem = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_training_backlog WHERE processed=false"
    );
    const remaining = Number((rem as any[])[0]?.cnt) || 0;

    console.log("✅ BACKLOG DRAIN COMPLETE: processed=" + processed + " errors=" + errors + " remaining=" + remaining);

    // Log to training_logs
    await query(
      `INSERT INTO nolix_training_logs
       (model_version, batch_size, train_loss, val_loss, auc, accuracy,
        precision_score, recall_score, f1_score, drift_detected, ai_enabled, logged_at)
       VALUES ('backlog_drain', $1, 0, 0, 0, 0, 0, 0, 0, false, true, NOW())`,
      [processed]
    ).catch(() => {});

    return { processed, errors, remaining };
  } catch(e) {
    console.error("❌ BACKLOG DRAIN FAILED:", e);
    return { processed, errors, remaining: -1 };
  }
}

// ============================================================
// BACKLOG STATUS (for dashboard)
// ============================================================
export async function getBacklogStatus(): Promise<{
  total:      number;
  pending:    number;
  processed:  number;
  oldest_at:  string | null;
}> {
  try {
    const r = await query<any>(`
      SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE processed=false)        AS pending,
        COUNT(*) FILTER (WHERE processed=true)         AS processed,
        MIN(created_at) FILTER (WHERE processed=false) AS oldest_at
      FROM nolix_training_backlog
    `);
    const row = (r as any[])[0] || {};
    return {
      total:     Number(row.total)     || 0,
      pending:   Number(row.pending)   || 0,
      processed: Number(row.processed) || 0,
      oldest_at: row.oldest_at || null
    };
  } catch { return { total: 0, pending: 0, processed: 0, oldest_at: null }; }
}
