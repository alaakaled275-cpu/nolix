/**
 * NOLIX — Attribution Engine (COMMAND X - Part 2)
 * lib/nolix-attribution-engine.ts
 */

import { query } from "@/lib/db";

export async function logAttributionEvent(visitor_id: string, trace_id: string, decision_action: string) {
  await query(
    `INSERT INTO nolix_attribution_events (visitor_id, trace_id, decision_action, timestamp) VALUES ($1, $2, $3, NOW())`,
    [visitor_id, trace_id, decision_action]
  );
}

export async function resolveAttribution(visitor_id: string): Promise<{ trace_id: string; weight: number }[]> {
  // Get events in the last 24 hours
  const events = await query(`
    SELECT trace_id FROM nolix_attribution_events 
    WHERE visitor_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
  `, [visitor_id]) as any[];

  if (events.length === 0) return [];

  // Multi-Touch Weighted Attribution
  const weight = 1.0 / events.length;

  return events.map(e => ({
    trace_id: e.trace_id,
    weight
  }));
}
