/**
 * NOLIX — Queue Visibility & Observability (STEP 14 PART 6)
 * app/api/admin/queue/status/route.ts
 *
 * Real-time queue metrics every poll:
 * - pending/processing/done/failed/dead_letter counts
 * - processing_rate (events/min)
 * - lag_seconds (oldest pending event age)
 * - circuit breaker state
 * - dedup stats
 * - worker mode (redis/db)
 */

import { NextRequest, NextResponse } from "next/server";
import { getQueueStatus }    from "@/lib/nolix-job-queue";
import { getCircuitStatus }  from "@/lib/nolix-circuit-breaker";
import { getDedupStats }     from "@/lib/nolix-idempotency";
import { getBacklogStatus }  from "@/lib/nolix-training-backlog";
import { getVectorEngineStatus } from "@/lib/nolix-vector-engine";
import { query }             from "@/lib/db";

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-nolix-sync-secret") === process.env.NOLIX_SYNC_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [queueStatus, circuitStatus, dedupStats, backlogStatus, vectorStatus] =
    await Promise.all([
      getQueueStatus(),
      Promise.resolve(getCircuitStatus()),
      getDedupStats(),
      getBacklogStatus(),
      getVectorEngineStatus()
    ]);

  // Queue lag: age of oldest pending event
  let queue_lag_seconds = 0;
  let processing_rate_per_min = 0;
  try {
    const lagR = await query<any>(
      "SELECT EXTRACT(EPOCH FROM (NOW() - MIN(enqueued_at)))::INT AS lag_s FROM nolix_event_queue WHERE status='pending'"
    );
    queue_lag_seconds = Number((lagR as any[])[0]?.lag_s) || 0;

    const rateR = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_event_queue WHERE status='done' AND processed_at > NOW() - INTERVAL '1 minute'"
    );
    processing_rate_per_min = Number((rateR as any[])[0]?.cnt) || 0;
  } catch {}

  // Recent metrics from nolix_system_metrics
  let metricsHistory: any[] = [];
  try {
    const mr = await query<any>(`
      SELECT metric_name,
             AVG(metric_value)::NUMERIC(10,4) AS avg_val,
             MAX(metric_value)::NUMERIC(10,4) AS max_val,
             COUNT(*) AS data_points
      FROM nolix_system_metrics
      WHERE recorded_at > NOW() - INTERVAL '30 minutes'
      GROUP BY metric_name
      ORDER BY metric_name
    `);
    metricsHistory = mr as any[];
  } catch {}

  return NextResponse.json({
    // Queue visibility
    queue: {
      ...queueStatus,
      lag_seconds:           queue_lag_seconds,
      processing_rate_1min:  processing_rate_per_min,
    },

    // Circuit breaker
    circuit_breaker: circuitStatus,

    // Idempotency / dedup
    dedup: dedupStats,

    // Training backlog
    backlog: backlogStatus,

    // Vector/embedding engine
    vector_engine: vectorStatus,

    // System metrics summary (last 30min)
    metrics_summary: metricsHistory,

    // Sampled at
    sampled_at: new Date().toISOString()
  });
}
