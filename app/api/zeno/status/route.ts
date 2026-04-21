/**
 * NOLIX — ZENO Status API (Pre-Step 16 PART 10)
 * app/api/zeno/status/route.ts
 *
 * Real-time ZENO system status — NOT just last 10 decisions.
 * Returns:
 *   - Decision accuracy (% correct predictions)
 *   - Avg intent score
 *   - ML vs ZENO score diff
 *   - Failure rate
 *   - Decisions per hour
 *   - Command breakdown
 *   - System health integration
 */
import { NextRequest, NextResponse }   from "next/server";
import { getDecisionAccuracyStats }    from "@/lib/nolix-decision-trace";
import { getAccessTier, requireTier }  from "@/lib/nolix-security";
import { query }                        from "@/lib/db";
import { getModelServerStatus }        from "@/lib/nolix-model-server";
import { getOrchestratorStatus }       from "@/lib/nolix-training-orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [decisionStats, modelStatus, orchStatus] = await Promise.all([
    getDecisionAccuracyStats(),
    Promise.resolve(getModelServerStatus()),
    Promise.resolve(getOrchestratorStatus())
  ]);

  // Decision accuracy from calibration log
  let calibrationAccuracy = null;
  let avgConfidence       = null;
  try {
    const calRows = await query<any>(`
      SELECT
        COUNT(*)                                          AS total,
        AVG(
          CASE WHEN predicted_class = actual_outcome THEN 1.0 ELSE 0.0 END
        )::NUMERIC(6,4)                                  AS accuracy,
        AVG(predicted_probability)::NUMERIC(6,4)         AS avg_confidence
      FROM nolix_calibration_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND actual_outcome IS NOT NULL
    `);
    const calRow = (calRows as any[])[0];
    if (calRow && Number(calRow.total) > 0) {
      calibrationAccuracy = Number(calRow.accuracy);
      avgConfidence       = Number(calRow.avg_confidence);
    }
  } catch {}

  // Recent failure patterns
  let recentErrors: string[] = [];
  try {
    const errRows = await query<any>(`
      SELECT output->>'error' AS err, COUNT(*) AS cnt
      FROM nolix_decision_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND output::TEXT LIKE '%error%'
      GROUP BY err ORDER BY cnt DESC LIMIT 5
    `);
    recentErrors = (errRows as any[]).map(r => `${r.err} (x${r.cnt})`);
  } catch {}

  // Segment distribution for context
  let segmentDistribution: Record<string, number> = {};
  try {
    const segRows = await query<any>(
      "SELECT segment, COUNT(*) as c FROM nolix_visitor_segments GROUP BY segment ORDER BY c DESC"
    );
    for (const r of segRows as any[]) segmentDistribution[r.segment] = Number(r.c);
  } catch {}

  return NextResponse.json({
    // PART 10: Full ZENO status (not just last 10)
    zeno_status: {
      // Decision metrics
      total_decisions_24h:    decisionStats.total_decisions,
      decisions_per_hour:     decisionStats.decisions_per_hour,
      avg_latency_ms:         decisionStats.avg_latency_ms,
      failure_rate:           decisionStats.failure_rate,
      failure_rate_pct:       `${(decisionStats.failure_rate * 100).toFixed(2)}%`,

      // Accuracy metrics
      avg_intent_score:       decisionStats.avg_intent_score,
      ml_vs_zeno_diff:        decisionStats.ml_vs_zeno_diff,
      decision_accuracy:      calibrationAccuracy,
      avg_confidence:         avgConfidence,

      // Command breakdown
      commands_breakdown:     decisionStats.commands_breakdown,

      // Error patterns
      recent_error_patterns:  recentErrors,

      // Health
      system_health: {
        model_server: {
          active_version:      modelStatus.active_version,
          cached_predictions:  modelStatus.cached_predictions,
          cached_models:       modelStatus.cached_models
        },
        training_orchestrator: {
          running:             orchStatus.running,
          next_full_train_ms:  orchStatus.next_full_train
        }
      },

      // Segmentation context
      segment_distribution: segmentDistribution,

      computed_at: new Date().toISOString()
    }
  });
}
