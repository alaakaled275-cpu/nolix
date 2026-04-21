/**
 * NOLIX — Observability & Drift Detection (STEP 10 LAYER 8)
 * GET /api/model/observability
 *
 * Production monitoring:
 * - Accuracy history
 * - Loss curve
 * - Drift score
 * - Conversion lift
 * - Model health
 */

import { NextRequest, NextResponse } from "next/server";
import { query }          from "@/lib/db";
import { getModelState }  from "@/lib/nolix-ml-engine";
import { startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

export async function GET(req: NextRequest) {
  try {
    const state   = getModelState();
    const limit   = parseInt(req.nextUrl.searchParams.get("limit") || "50");

    // Training history from observability log
    let trainingHistory: any[] = [];
    try {
      trainingHistory = await query(
        `SELECT training_type, samples, loss, accuracy, drift_score, model_version, logged_at
         FROM nolix_model_observability
         ORDER BY logged_at DESC LIMIT $1`,
        [limit]
      );
    } catch(e) { /* table may not exist yet */ }

    // Conversion stats (truth events)
    let conversionStats: any = { total: 0, confirmed: 0, rate: 0 };
    try {
      const rows = await query<any>(
        `SELECT
           COUNT(*) FILTER (WHERE event_type = 'purchase_confirmed') as confirmed,
           COUNT(*) FILTER (WHERE event_type = 'cta_click')          as cta_clicks,
           COUNT(*) FILTER (WHERE event_type = 'popup_dismissed')    as dismissed,
           COUNT(DISTINCT visitor_id)                                as unique_visitors
         FROM nolix_truth_events`
      );
      if (rows.length) {
        const r = rows[0] as any;
        conversionStats = {
          total_events:    Number(r.cta_clicks) + Number(r.dismissed) + Number(r.confirmed),
          confirmed:       Number(r.confirmed),
          cta_clicks:      Number(r.cta_clicks),
          dismissed:       Number(r.dismissed),
          unique_visitors: Number(r.unique_visitors),
          click_to_purchase_rate: Number(r.cta_clicks) > 0
            ? Math.round((Number(r.confirmed) / Number(r.cta_clicks)) * 10000) / 10000
            : 0
        };
      }
    } catch(e) { /* silent */ }

    // Embedding coverage (how many visitors have embeddings)
    let embeddingStats: any = { total: 0 };
    try {
      const rows = await query<any>(
        `SELECT COUNT(*) as total, AVG(session_count) as avg_sessions FROM nolix_embeddings`
      );
      if (rows.length) {
        const r = rows[0] as any;
        embeddingStats = {
          total_visitors: Number(r.total),
          avg_sessions:   Math.round(Number(r.avg_sessions) * 100) / 100
        };
      }
    } catch(e) { /* silent */ }

    // Training queue health
    let trainingStats: any = { online: 0, batch: 0 };
    try {
      const rows = await query<any>(
        `SELECT
           COUNT(*) FILTER (WHERE event_type != 'batch')  as online_samples,
           COUNT(*) FILTER (WHERE event_type = 'batch')   as batch_samples
         FROM nolix_training_log
         WHERE trained_at > NOW() - INTERVAL '24 hours'`
      );
      if (rows.length) {
        const r = rows[0] as any;
        trainingStats = {
          online_last_24h: Number(r.online_samples),
          batch_last_24h:  Number(r.batch_samples)
        };
      }
    } catch(e) { /* silent */ }

    // Drift alert
    const driftAlert = state.drift_score > 0.3
      ? { alert: true, message: "MODEL DRIFT DETECTED — retrain recommended", score: state.drift_score }
      : { alert: false, score: state.drift_score };

    return NextResponse.json({
      model: {
        version:        state.version,
        type:           "logistic_regression_hybrid",
        weights:        state.weights,
        bias:           state.bias,
        last_loss:      state.last_loss,
        last_accuracy:  state.last_accuracy,
        online_trained: state.online_trained,
        batch_trained:  state.batch_trained
      },
      drift:           driftAlert,
      conversions:     conversionStats,
      embeddings:      embeddingStats,
      training:        trainingStats,
      history:         trainingHistory,
      generated_at:    new Date().toISOString()
    });

  } catch(err: any) {
    console.error("❌ /api/model/observability ERROR:", err);
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}
