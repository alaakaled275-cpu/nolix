/**
 * NOLIX — Model Sync v3 (STEP 11.1)
 * GET /api/model/sync
 *
 * STEP 11.1 additions:
 * - Returns full metrics: precision, recall, f1, val_loss, ai_enabled
 * - Model Governance: blocks sync if ai_enabled=false OR drift detected
 * - Returns model_id for client-side version tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { getModelState, loadModelFromDB, isLoaded, isAIEnabled } from "@/lib/nolix-ml-engine";
import { getFeatureStatsSnapshot } from "@/lib/nolix-feature-stats";
import { startQueueWorker } from "@/lib/nolix-queue";
import { query } from "@/lib/db";

startQueueWorker();

export async function GET(req: NextRequest) {
  try {
    if (!isLoaded()) { await loadModelFromDB(); }
    const state = getModelState();

    // HARD FAIL-SAFE: if AI is completely disabled, block sync immediately
    if (!state.ai_enabled) {
      return NextResponse.json({
        allow_sync:    false,
        ai_enabled:    false,
        reason:        "fail_safe_triggered",
        message:       `AI disabled — AUC (${state.last_auc}) below safety threshold (0.55). Clients should use rule-based fallback.`,
        auc:           state.last_auc,
        model_version: state.version,
        model_id:      state.model_id
      }, { status: 503 });
    }

    // MODEL GOVERNOR: block if drift detected or quality below threshold
    if (!state.allow_sync) {
      return NextResponse.json({
        allow_sync:     false,
        ai_enabled:     true,
        reason:         state.drift_detected ? "drift_detected" : "quality_below_threshold",
        message:        state.drift_detected
          ? `Drift detected. val_loss ${state.last_val_loss} > baseline ${state.baseline_loss} × 1.3. Sync blocked.`
          : `AUC ${state.last_auc} below sync threshold (0.60). Sync blocked.`,
        auc:            state.last_auc,
        drift_detected: state.drift_detected,
        drift_score:    state.drift_score,
        val_loss:       state.last_val_loss,
        model_version:  state.version,
        model_id:       state.model_id
      });
    }

    // Get feature stats for client-side normalization context
    const featureStats = getFeatureStatsSnapshot();

    return NextResponse.json({
      allow_sync:     true,
      ai_enabled:     true,

      // Model weights (8D named)
      weights: {
        scroll:     state.weights[0],
        clicks:     state.weights[1],
        dwell:      state.weights[2],
        hesitation: state.weights[3],
        engagement: state.weights[4],
        recency:    state.weights[5],
        loyalty:    state.weights[6],
        trust:      state.weights[7]
      },
      bias:          state.bias,
      lr:            state.lr,
      lambda:        state.lambda,

      // Model identity
      version:       state.version,
      model_id:      state.model_id,
      model_type:    "logistic_regression_hybrid_v3",

      // Full metrics (new in STEP 11.1)
      metrics: {
        train_loss:  state.last_loss,
        val_loss:    state.last_val_loss,
        accuracy:    state.last_accuracy,
        precision:   state.last_precision,
        recall:      state.last_recall,
        f1:          state.last_f1,
        auc:         state.last_auc,
        drift_score: state.drift_score
      },

      // Training counts
      online_trained:  state.online_trained,
      batch_trained:   state.batch_trained,

      // Feature normalization stats (client can use for own z-score)
      feature_stats: featureStats,

      synced_at: Date.now()
    });

  } catch(err: any) {
    console.error("❌ /api/model/sync ERROR:", err);
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-nolix-sync-secret");
  if (!secret || secret !== process.env.NOLIX_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { weights, bias, version } = await req.json();
    if (!weights || typeof bias !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await query(
      `INSERT INTO nolix_model_weights
       (id, scroll, clicks, time, engagement, hesitation, bias, lr, version, updated_at)
       VALUES (1,$1,$2,$3,$4,$5,$6,0.01,$7,NOW())
       ON CONFLICT (id) DO UPDATE SET
         scroll=$1,clicks=$2,time=$3,engagement=$4,hesitation=$5,
         bias=$6,version=$7,updated_at=NOW()`,
      [weights.scroll||0.25, weights.clicks||0.20, weights.dwell||0.15,
       weights.engagement||0.25, weights.hesitation||-0.35, bias, version||0]
    );
    return NextResponse.json({ synced: true, version });
  } catch(err: any) {
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}
