/**
 * NOLIX — System Metrics Logger (STEP 13.5 PART 6)
 * lib/nolix-metrics.ts
 *
 * Operational observability: logs queue size, training rate,
 * error rate, latency, embedding status to nolix_system_metrics.
 *
 * Queried by /api/dashboard/metrics for real-time monitoring.
 */

import { query } from "./db";

export type MetricName =
  | "queue_size"
  | "training_rate"
  | "error_rate"
  | "latency_ms"
  | "embedding_writes"
  | "backlog_size"
  | "event_queue_pending"
  | "health_score"
  | "api_requests"
  | "license_checks";

// ============================================================
// LOG A METRIC POINT
// ============================================================
export async function logMetric(
  name:  MetricName | string,
  value: number,
  tags:  Record<string, string | number | boolean> = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_system_metrics (metric_name, metric_value, tags, recorded_at)
       VALUES ($1, $2, $3, NOW())`,
      [name, value, JSON.stringify(tags)]
    );
  } catch { /* non-blocking — never crash the main flow */ }
}

// ============================================================
// BATCH LOG MULTIPLE METRICS AT ONCE
// ============================================================
export async function logMetrics(
  metrics: Array<{ name: MetricName | string; value: number; tags?: Record<string, any> }>
): Promise<void> {
  if (!metrics.length) return;
  try {
    const values = metrics
      .map((_, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3}, NOW())`)
      .join(", ");
    const params = metrics.flatMap(m => [m.name, m.value, JSON.stringify(m.tags || {})]);
    await query(`INSERT INTO nolix_system_metrics (metric_name, metric_value, tags, recorded_at) VALUES ${values}`, params);
  } catch { /* non-blocking */ }
}

// ============================================================
// GET METRIC TIME-SERIES (last N minutes)
// ============================================================
export async function getMetricHistory(
  name:       MetricName | string,
  minutes:    number = 60,
  resolution: "1min" | "5min" | "1hour" = "5min"
): Promise<Array<{ time: string; value: number }>> {
  const trunc = resolution === "1min"  ? "minute"
              : resolution === "1hour" ? "hour"
              : "5 minutes";

  try {
    const rows = await query<any>(`
      SELECT
        date_trunc($1, recorded_at) AS time,
        AVG(metric_value)::NUMERIC(12,4) AS value
      FROM nolix_system_metrics
      WHERE metric_name = $2
        AND recorded_at > NOW() - INTERVAL '${minutes} minutes'
      GROUP BY date_trunc($1, recorded_at)
      ORDER BY time ASC
    `, [trunc, name]);
    return (rows as any[]).map(r => ({ time: r.time, value: parseFloat(r.value) }));
  } catch { return []; }
}

// ============================================================
// GET LATEST VALUE FOR A METRIC
// ============================================================
export async function getLatestMetric(name: MetricName | string): Promise<number | null> {
  try {
    const r = await query<any>(
      "SELECT metric_value FROM nolix_system_metrics WHERE metric_name=$1 ORDER BY recorded_at DESC LIMIT 1",
      [name]
    );
    return (r as any[]).length ? parseFloat((r as any[])[0].metric_value) : null;
  } catch { return null; }
}

// ============================================================
// SNAPSHOT ALL KEY METRICS AT ONCE (for health cron)
// ============================================================
export async function snapshotSystemMetrics(): Promise<Record<string, number>> {
  const snapshot: Record<string, number> = {};

  // Queue sizes
  try {
    const eq = await query<any>("SELECT COUNT(*) as cnt FROM nolix_event_queue WHERE status='pending'");
    snapshot.event_queue_pending = Number((eq as any[])[0]?.cnt) || 0;
  } catch {}

  try {
    const bl = await query<any>("SELECT COUNT(*) as cnt FROM nolix_training_backlog WHERE processed=false");
    snapshot.backlog_size = Number((bl as any[])[0]?.cnt) || 0;
  } catch {}

  // Training rate (last hour)
  try {
    const tr = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_training_logs WHERE logged_at > NOW() - INTERVAL '1 hour'"
    );
    snapshot.training_rate = Number((tr as any[])[0]?.cnt) || 0;
  } catch {}

  // Error rate (events with no truth in last hour)
  try {
    const er = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_webhook_errors WHERE created_at > NOW() - INTERVAL '1 hour'"
    );
    snapshot.error_rate = Number((er as any[])[0]?.cnt) || 0;
  } catch {}

  // Active embeddings
  try {
    const em = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_embeddings WHERE last_updated > NOW() - INTERVAL '24 hours'"
    );
    snapshot.embedding_writes = Number((em as any[])[0]?.cnt) || 0;
  } catch {}

  // License checks (last hour)
  try {
    const lc = await query<any>(
      "SELECT COALESCE(SUM(request_count), 0) as cnt FROM nolix_licenses WHERE last_seen_at > NOW() - INTERVAL '1 hour'"
    );
    snapshot.license_checks = Number((lc as any[])[0]?.cnt) || 0;
  } catch {}

  // Bulk insert all metrics
  if (Object.keys(snapshot).length) {
    await logMetrics(
      Object.entries(snapshot).map(([name, value]) => ({ name, value }))
    );
  }

  return snapshot;
}

// ============================================================
// CLEANUP OLD METRICS (retain 7 days)
// ============================================================
export async function purgeOldMetrics(): Promise<void> {
  try {
    await query("DELETE FROM nolix_system_metrics WHERE recorded_at < NOW() - INTERVAL '7 days'");
  } catch { /* non-blocking */ }
}
