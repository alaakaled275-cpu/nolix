/**
 * NOLIX — Cron Batch Training v2 (STEP 11.1)
 * POST /api/model/batch-train
 *
 * Returns full training metrics including:
 * - train_loss vs val_loss (overfitting detection)
 * - precision, recall, f1, auc
 * - drift_detected flag
 * - ai_enabled status (fail-safe)
 */

import { NextRequest, NextResponse } from "next/server";
import { trainBatch, saveModelToDB, getModelState, rollbackToVersion } from "@/lib/nolix-ml-engine";
import { getFeatureStatsSnapshot } from "@/lib/nolix-feature-stats";
import { getFlags, loadRuntimeFlags } from "@/lib/nolix-runtime";
import { startQueueWorker } from "@/lib/nolix-queue";
import { query } from "@/lib/db";

startQueueWorker();

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("x-nolix-cron-secret");
  if (cronSecret === process.env.NOLIX_CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  console.log("🔵 CRON BATCH TRAIN v2 START:", new Date().toISOString());

  // ── FIX 3: TRAINING GUARD — check runtime flags + health before training ──
  await loadRuntimeFlags();
  const flags = getFlags();

  if (flags.maintenance_mode) {
    return NextResponse.json({ status: "skipped", reason: "maintenance_mode" });
  }
  if (!flags.training_enabled) {
    console.warn("🚫 BATCH TRAIN BLOCKED: training_enabled=false (set by health engine or admin)");
    return NextResponse.json({
      status:  "blocked",
      reason:  "training_disabled_by_health_engine",
      message: "training_enabled flag is false. System health score is below 0.5. Training blocked to prevent model degradation.",
      flags:   { training_enabled: false, ai_enabled: flags.ai_enabled }
    }, { status: 503 });
  }
  if (!flags.ai_enabled) {
    console.warn("🚫 BATCH TRAIN BLOCKED: ai_enabled=false (fail-safe active)");
    return NextResponse.json({
      status:  "blocked",
      reason:  "ai_disabled_by_failsafe",
      message: "AI is disabled. Model training paused until system recovers."
    }, { status: 503 });
  }
  // ── END TRAINING GUARD ────────────────────────────────────────────────────

  try {
    const result = await trainBatch();

    if (result.samples < 10) {
      return NextResponse.json({
        status:  "skipped",
        reason:  "insufficient_data",
        samples: result.samples
      });
    }

    const state      = getModelState();
    const duration   = Date.now() - startTime;

    // Log to cron audit
    await query(
      `INSERT INTO nolix_cron_log
       (job_name, samples, loss, accuracy, drift_score, model_version, duration_ms, ran_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [
        "batch_train_v2", result.samples, result.train_loss,
        result.accuracy, state.drift_score, state.version, duration
      ]
    ).catch(() => {});

    console.log("✅ CRON BATCH v2 COMPLETE:", {
      samples:    result.samples,
      train_loss: result.train_loss,
      val_loss:   result.val_loss,
      precision:  result.precision,
      recall:     result.recall,
      f1:         result.f1,
      auc:        result.auc,
      drift:      state.drift_detected,
      ai_enabled: state.ai_enabled,
      allow_sync: state.allow_sync,
      version:    state.version,
      duration:   `${duration}ms`
    });

    return NextResponse.json({
      status:         "trained",
      samples:        result.samples,

      // Full metrics (STEP 11.1)
      metrics: {
        train_loss:  result.train_loss,
        val_loss:    result.val_loss,
        accuracy:    result.accuracy,
        precision:   result.precision,
        recall:      result.recall,
        f1:          result.f1,
        auc:         result.auc
      },

      model: {
        version:       state.version,
        model_id:      state.model_id,
        drift_detected: state.drift_detected,
        drift_score:   state.drift_score,
        ai_enabled:    state.ai_enabled,
        allow_sync:    state.allow_sync
      },

      feature_stats: getFeatureStatsSnapshot(),
      duration_ms:   duration
    });

  } catch(err: any) {
    console.error("❌ CRON BATCH TRAIN v2 ERROR:", err);
    return NextResponse.json({
      status: "error", error: err.message, duration_ms: Date.now() - startTime
    }, { status: 500 });
  }
}

// GET — training history + last batch details + rollback history
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

    const history = await query<any>(
      `SELECT model_id, model_version, train_samples, val_samples,
              train_loss, val_loss, accuracy, precision, recall, f1, auc,
              drift_detected, ai_enabled, logged_at
       FROM nolix_training_logs ORDER BY logged_at DESC LIMIT $1`, [limit]
    ).catch(() => []);

    const cronLog = await query<any>(
      `SELECT job_name, samples, loss, accuracy, drift_score,
              model_version, duration_ms, ran_at
       FROM nolix_cron_log ORDER BY ran_at DESC LIMIT 10`
    ).catch(() => []);

    const models = await query<any>(
      `SELECT model_id, version, metrics, drift_detected, ai_enabled, created_at
       FROM nolix_models ORDER BY created_at DESC LIMIT 10`
    ).catch(() => []);

    return NextResponse.json({
      training_history: history,
      cron_log:         cronLog,
      saved_models:     models,
      total_versions:   (models as any[]).length
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
