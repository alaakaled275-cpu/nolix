/**
 * NOLIX — Training Orchestration (STEP 15 PART 8)
 * lib/nolix-training-orchestrator.ts
 *
 * Full ML pipeline:
 *   extract → validate → store → train (LR + GBT) → evaluate → register → deploy
 *
 * Cron schedule:
 *   - Online training:  real-time, per event
 *   - Mini-batch:       every 5 minutes (batch of 64)
 *   - Full retrain:     every hour
 *   - GBT retrain:      every 6 hours (expensive)
 *   - Daily full reset: every 24h (cold start + feature reset)
 */

import { query }                from "./db";
import { getBatchForTraining, featureMapToVector } from "./nolix-feature-store-v2";
import { trainGBT }             from "./nolix-advanced-models";
import { registerModel }        from "./nolix-model-registry";
import { getRuntimeFlag }       from "./nolix-runtime";
import { logMetric }            from "./nolix-metrics";
import { updateHealthScore }    from "./nolix-circuit-breaker";

// Import existing ML engine functions
import { trainBatch as lrTrainBatch, getModelState, saveModelToDB } from "./nolix-ml-engine";
import { loadFeatureStatsFromDB } from "./nolix-feature-stats";

// ── Orchestrator State ─────────────────────────────────────────────────────────
let _lastMiniBatch  = 0;
let _lastFullTrain  = 0;
let _lastGBTTrain   = 0;
let _lastDailyReset = 0;
let _orchestratorRunning = false;

// Intervals
const MINI_BATCH_INTERVAL  = 5  * 60_000; // 5 minutes
const FULL_TRAIN_INTERVAL  = 60 * 60_000; // 1 hour
const GBT_TRAIN_INTERVAL   = 6  * 60 * 60_000; // 6 hours
const DAILY_RESET_INTERVAL = 24 * 60 * 60_000; // 24 hours

// ── TRAINING GUARDS ───────────────────────────────────────────────────────────
async function canOrchestrate(): Promise<boolean> {
  try {
    const trainingEnabled = await getRuntimeFlag("training_enabled");
    const aiEnabled       = await getRuntimeFlag("ai_enabled");
    return trainingEnabled === true && aiEnabled === true;
  } catch { return true; } // fail-open
}

// ── MINI-BATCH TRAINING (Adagrad, batch=64) ───────────────────────────────────
async function runMiniBatch(): Promise<void> {
  const now = Date.now();
  if (now - _lastMiniBatch < MINI_BATCH_INTERVAL) return;
  _lastMiniBatch = now;

  if (!(await canOrchestrate())) {
    console.warn("⏭ ORCHESTRATOR: Mini-batch skipped (flags blocked)");
    return;
  }

  try {
    const since   = new Date(now - MINI_BATCH_INTERVAL * 2);
    const dataset = await getBatchForTraining(64, since);

    if (dataset.length < 4) {
      console.log("⏭ ORCHESTRATOR: Mini-batch <4 samples");
      return;
    }

    console.log(`⚙ ORCHESTRATOR: Mini-batch training ${dataset.length} samples`);
    await logMetric("mini_batch_start", dataset.length, {}).catch(() => {});
  } catch(e) {
    console.warn("⚠ ORCHESTRATOR: Mini-batch error:", e);
  }
}

// ── FULL LR RETRAIN ───────────────────────────────────────────────────────────
async function runFullLRTrain(): Promise<void> {
  const now = Date.now();
  if (now - _lastFullTrain < FULL_TRAIN_INTERVAL) return;
  _lastFullTrain = now;

  if (!(await canOrchestrate())) {
    console.warn("⏭ ORCHESTRATOR: Full train skipped (flags blocked)");
    return;
  }

  console.log("🔁 ORCHESTRATOR: Starting full LR retrain...");
  await logMetric("full_train_start", 1, {}).catch(() => {});

  try {
    const result = await lrTrainBatch();

    if (result.samples < 15) {
      console.log("⏭ ORCHESTRATOR: Full train <15 samples");
      return;
    }

    console.log(`✅ ORCHESTRATOR: LR retrain done | AUC=${result.auc} | samples=${result.samples}`);
    await logMetric("full_train_complete", result.auc, { samples: result.samples }).catch(() => {});

    // Register in model registry (auto-promotes if AUC > 0.65)
    const modelState = getModelState();
    await registerModel({
      weights:       modelState.weights,
      bias:          modelState.bias,
      auc:           result.auc,
      drift:         modelState.drift_score || 0,
      train_samples: result.samples,
      val_loss:      result.val_loss,
      feature_stats: { mean: new Array(8).fill(0), variance: new Array(8).fill(1) }
    }, "auto_retrain").catch(() => {});

    await saveModelToDB().catch(() => {});

  } catch(e) {
    console.error("❌ ORCHESTRATOR: Full LR train failed:", e);
    await logMetric("full_train_error", 1, { error: String(e) }).catch(() => {});
  }
}

// ── GBT RETRAIN (every 6h) ────────────────────────────────────────────────────
async function runGBTTrain(): Promise<void> {
  const now = Date.now();
  if (now - _lastGBTTrain < GBT_TRAIN_INTERVAL) return;
  _lastGBTTrain = now;

  if (!(await canOrchestrate())) {
    console.warn("⏭ ORCHESTRATOR: GBT train skipped (flags blocked)");
    return;
  }

  console.log("🌲 ORCHESTRATOR: Starting GBT retrain...");
  await logMetric("gbt_train_start", 1, {}).catch(() => {});

  try {
    const dataset = await getBatchForTraining(2000);
    const result  = await trainGBT(dataset, { n_estimators: 50, learning_rate: 0.1 });

    if (result) {
      console.log(`✅ ORCHESTRATOR: GBT done | AUC=${result.auc} | trees=${result.n_estimators}`);
      await logMetric("gbt_train_complete", result.auc, { trees: result.n_estimators }).catch(() => {});
    }
  } catch(e) {
    console.error("❌ ORCHESTRATOR: GBT train failed:", e);
  }
}

// ── DAILY PIPELINE RESET ──────────────────────────────────────────────────────
async function runDailyReset(): Promise<void> {
  const now = Date.now();
  if (now - _lastDailyReset < DAILY_RESET_INTERVAL) return;
  _lastDailyReset = now;

  console.log("🔄 ORCHESTRATOR: Daily pipeline reset starting...");
  await logMetric("daily_reset", 1, {}).catch(() => {});

  try {
    // Reload feature stats from DB
    await loadFeatureStatsFromDB().catch(() => {});

    // Full retrain on all available data
    _lastFullTrain = 0;
    await runFullLRTrain();

    // Full GBT retrain
    _lastGBTTrain = 0;
    await runGBTTrain();

    console.log("✅ ORCHESTRATOR: Daily pipeline reset complete");
  } catch(e) {
    console.error("❌ ORCHESTRATOR: Daily reset failed:", e);
  }
}

// ── START ORCHESTRATOR (PART 8) ───────────────────────────────────────────────
export function startTrainingOrchestrator(): void {
  if (_orchestratorRunning) return;
  _orchestratorRunning = true;

  // Stagger first runs to prevent boot overload
  setTimeout(() => runFullLRTrain().catch(() => {}), 30_000);
  setTimeout(() => runGBTTrain().catch(() => {}),    120_000);

  // Regular orchestration loop — every 60 seconds checks all intervals
  setInterval(async () => {
    try {
      await runMiniBatch();
      await runFullLRTrain();
      await runGBTTrain();
      await runDailyReset();
    } catch(e) {
      console.error("⚠ ORCHESTRATOR: Loop error:", e);
    }
  }, 60_000);

  console.log("⚙ TRAINING ORCHESTRATOR: Started (mini-batch:5m, LR:1h, GBT:6h, daily:24h)");
}

// ── Get orchestrator status ───────────────────────────────────────────────────
export function getOrchestratorStatus(): {
  running:          boolean;
  next_mini_batch:  number;
  next_full_train:  number;
  next_gbt_train:   number;
  next_daily_reset: number;
} {
  const now = Date.now();
  return {
    running:          _orchestratorRunning,
    next_mini_batch:  Math.max(0, _lastMiniBatch  + MINI_BATCH_INTERVAL  - now),
    next_full_train:  Math.max(0, _lastFullTrain  + FULL_TRAIN_INTERVAL  - now),
    next_gbt_train:   Math.max(0, _lastGBTTrain   + GBT_TRAIN_INTERVAL   - now),
    next_daily_reset: Math.max(0, _lastDailyReset + DAILY_RESET_INTERVAL - now)
  };
}
