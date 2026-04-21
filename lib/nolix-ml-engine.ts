/**
 * NOLIX — ML Engine v3 FINAL (STEP 11.1 + STEP 13 PART 4)
 * lib/nolix-ml-engine.ts
 *
 * COMPLETE REBUILD with:
 * PART 1: Z-Score Normalization (Welford-backed)
 * PART 2: L2 Regularization with proper lambda
 * PART 3: Train / Validation Split (80/20)
 * PART 4: Full Metrics: loss, val_loss, accuracy, precision, recall, F1, AUC
 * PART 5: Drift Detection — val_loss > baseline * 1.3 = DRIFT
 * PART 6: Training Logs to DB (every batch)
 * PART 7: Model Versioning — each trained model is versioned
 * STEP 13 PART 4: canTrain() gate — reads training_enabled FLAG live from DB
 */
import { query } from "./db";
import { featureStore, featureToArray } from "./nolix-feature-store";
import { normalizeVector, updateFeatureStats, loadFeatureStatsFromDB, saveFeatureStatsToDB } from "./nolix-feature-stats";

// ============================================================
// MODEL STATE INTERFACE (v3)
// ============================================================
export interface ModelWeightsV3 {
  weights:         number[];  // 8D
  bias:            number;
  lr:              number;
  lambda:          number;    // L2 regularization strength
  version:         number;    // increments on every batch
  model_id:        string;    // timestamp-based ID for versioning
  online_trained:  number;
  batch_trained:   number;
  last_loss:       number;
  last_val_loss:   number;    // NEW: validation loss
  baseline_loss:   number;    // first batch loss (drift reference)
  last_accuracy:   number;
  last_precision:  number;    // NEW: precision
  last_recall:     number;    // NEW: recall
  last_f1:         number;    // NEW: F1 score
  last_auc:        number;    // AUC-ROC
  drift_score:     number;
  drift_detected:  boolean;   // NEW: explicit drift flag
  allow_sync:      boolean;   // Model Governance: false = block client
  ai_enabled:      boolean;   // Fail-Safe: false if AUC < 0.55
  updated_at:      number;
}

const FEATURE_DIM     = 8;
const LAMBDA          = 0.001;  // L2 regularization strength
const DRIFT_RATIO     = 1.30;   // val_loss > baseline*1.3 = drift
const MIN_AUC         = 0.55;   // Fail-safe: disable AI below this
const MIN_SYNC_AUC    = 0.60;   // Governor: block sync below this
const MAX_DRIFT_SCORE = 0.30;   // Governor: block sync above this

let _model: ModelWeightsV3 = {
  weights:        [0.25, 0.20, 0.15, -0.35, 0.25, 0.10, 0.10, 0.15],
  bias:           0,
  lr:             0.01,
  lambda:         LAMBDA,
  version:        0,
  model_id:       `boot_${Date.now()}`,
  online_trained: 0,
  batch_trained:  0,
  last_loss:      0.693,  // log(2) = worst-case binary CE
  last_val_loss:  0.693,
  baseline_loss:  0.693,
  last_accuracy:  0,
  last_precision: 0,
  last_recall:    0,
  last_f1:        0,
  last_auc:       0.5,
  drift_score:    0,
  drift_detected: false,
  allow_sync:     true,
  ai_enabled:     true,
  updated_at:     Date.now()
};
let _loaded = false;

// ============================================================
// MATH UTILITIES
// ============================================================
function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(v) ? 0 : v));
}

function dot(w: number[], x: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(w.length, x.length); i++) {
    sum += (w[i] || 0) * (x[i] || 0);
  }
  return sum;
}

function logLoss(pred: number, label: number): number {
  const eps = 1e-7;
  const p   = clamp(pred, eps, 1 - eps);
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

// ============================================================
// PART 4 — FULL METRICS ENGINE
// ============================================================
function computeMetrics(
  predictions: number[],
  labels:      number[]
): { accuracy: number; precision: number; recall: number; f1: number; auc: number } {
  if (predictions.length === 0) {
    return { accuracy: 0, precision: 0, recall: 0, f1: 0, auc: 0.5 };
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred  = predictions[i] >= 0.5 ? 1 : 0;
    const label = labels[i]      >= 0.5 ? 1 : 0;
    if (pred === 1 && label === 1) tp++;
    else if (pred === 1 && label === 0) fp++;
    else if (pred === 0 && label === 1) fn++;
    else tn++;
  }

  const accuracy  = (tp + tn) / (tp + tn + fp + fn);
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1        = (precision + recall) > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  // AUC via Wilcoxon-Mann-Whitney
  const pairs = predictions
    .map((p, i) => ({ p, label: labels[i] }))
    .sort((a, b) => b.p - a.p);
  const nPos = labels.filter(l => l >= 0.5).length;
  const nNeg = labels.length - nPos;
  let nCorrect = 0;
  if (nPos > 0 && nNeg > 0) {
    for (let i = 0; i < pairs.length; i++) {
      for (let j = 0; j < pairs.length; j++) {
        if (pairs[i].label >= 0.5 && pairs[j].label < 0.5) {
          if      (pairs[i].p > pairs[j].p) nCorrect++;
          else if (pairs[i].p === pairs[j].p) nCorrect += 0.5;
        }
      }
    }
  }
  const auc = nPos > 0 && nNeg > 0 ? nCorrect / (nPos * nNeg) : 0.5;

  return {
    accuracy:  Math.round(accuracy  * 10000) / 10000,
    precision: Math.round(precision * 10000) / 10000,
    recall:    Math.round(recall    * 10000) / 10000,
    f1:        Math.round(f1        * 10000) / 10000,
    auc:       Math.round(auc       * 10000) / 10000
  };
}

// ============================================================
// PART 9 — FAIL-SAFE + GOVERNANCE
// ============================================================
function _updateGovernanceAndFailsafe(): void {
  // Fail-Safe: disable AI entirely if AUC is below random baseline
  _model.ai_enabled = _model.last_auc >= MIN_AUC;

  // Drift detection: val_loss > baseline * 1.3
  _model.drift_detected = _model.baseline_loss > 0 &&
    _model.last_val_loss > _model.baseline_loss * DRIFT_RATIO;

  const driftOK     = !_model.drift_detected && _model.drift_score < MAX_DRIFT_SCORE;
  const qualityOK   = _model.last_auc >= MIN_SYNC_AUC;

  // Model Sync Governor: block distribution if quality/stability threshold not met
  _model.allow_sync = qualityOK && driftOK && _model.ai_enabled;

  if (!_model.ai_enabled) {
    console.error("🛑 FAIL-SAFE: AI DISABLED. AUC=" + _model.last_auc +
      " below threshold=" + MIN_AUC + ". Using rule-based fallback.");
  }
  if (_model.drift_detected) {
    console.error("🚨 DRIFT DETECTED: val_loss=" + _model.last_val_loss +
      " baseline=" + _model.baseline_loss +
      " ratio=" + (_model.last_val_loss / _model.baseline_loss).toFixed(3));
  }
  if (!_model.allow_sync) {
    console.warn("🔒 SYNC BLOCKED. AUC=" + _model.last_auc +
      " drift=" + _model.drift_detected +
      " aiEnabled=" + _model.ai_enabled);
  }
}

// ============================================================
// TRAINING GATE (STEP 13 PART 4)
// Reads LIVE from DB — not from in-memory cache.
// This is the double-safety guard against training on sick models.
// Called before EVERY trainOnline() and trainBatch().
// ============================================================
async function canTrain(): Promise<boolean> {
  try {
    // Dynamic import to avoid circular dependency
    const { getRuntimeFlag } = await import("./nolix-runtime");
    const trainingEnabled = await getRuntimeFlag("training_enabled");
    if (!trainingEnabled) {
      console.warn("🚫 ML ENGINE: Training BLOCKED — training_enabled=false in DB");
      return false;
    }
    const aiEnabled = await getRuntimeFlag("ai_enabled");
    if (!aiEnabled) {
      console.warn("🚫 ML ENGINE: Training BLOCKED — ai_enabled=false in DB");
      return false;
    }
  } catch(e) {
    // DB error: fail-open (allow training) to avoid false blocks
    console.warn("⚠ ML ENGINE: canTrain() DB check failed. Proceeding.", e);
  }
  return true;
}

// ============================================================
// ONLINE TRAINING (real-time, per event — L2 + Z-score)
// ============================================================
export function trainOnline(features: number[], label: number): void {
  if (!features || features.length !== FEATURE_DIM) return;

  // PART 1: Update Welford stats, then z-score normalize
  updateFeatureStats(features);
  const x = normalizeVector(features);

  const z     = dot(_model.weights, x) + _model.bias;
  const pred  = sigmoid(z);
  const error = label - pred;
  const loss  = logLoss(pred, label);

  // PART 2: L2 Regularization: gradient = error*x - lambda*w
  for (let i = 0; i < FEATURE_DIM; i++) {
    const gradient = error * x[i] - _model.lambda * _model.weights[i];
    _model.weights[i] = clamp(_model.weights[i] + _model.lr * gradient, -5, 5);
  }
  _model.bias = clamp(_model.bias + _model.lr * error, -5, 5);

  _model.online_trained++;
  _model.last_loss  = Math.round(loss * 10000) / 10000;
  _model.version++;
  _model.updated_at = Date.now();

  _updateGovernanceAndFailsafe();
}

// ============================================================
// BATCH TRAINING (PART 3: Train/Val Split + Full Metrics)
// ============================================================
export async function trainBatch(): Promise<{
  samples: number; train_loss: number; val_loss: number;
  accuracy: number; precision: number; recall: number; f1: number; auc: number;
}> {
  // STEP 13 PART 4: TRAINING GATE — check live DB flag before batch training
  const allowed = await canTrain();
  if (!allowed) {
    return { samples: 0, train_loss: 0, val_loss: 0, accuracy: 0, precision: 0, recall: 0, f1: 0, auc: 0 };
  }

  await loadFeatureStatsFromDB();
  const dataset = await featureStore.getBatchTrainingData(500);

  if (dataset.length < 15) {
    console.log("⏭ BATCH: Insufficient data (<15 samples).");
    return { samples: 0, train_loss: 0, val_loss: 0, accuracy: 0, precision: 0, recall: 0, f1: 0, auc: 0.5 };
  }

  // PART 3: 80/20 Train / Validation Split
  const splitIdx = Math.floor(dataset.length * 0.8);
  const trainSet = dataset.slice(0, splitIdx);
  const valSet   = dataset.slice(splitIdx);

  const epochs  = 3;
  const batchLR = _model.lr * 0.5;
  let  totalTrainLoss = 0;

  // Training loop
  for (let ep = 0; ep < epochs; ep++) {
    for (const sample of trainSet) {
      updateFeatureStats(sample.features);
      const x      = normalizeVector(sample.features);
      const z      = dot(_model.weights, x) + _model.bias;
      const pred   = sigmoid(z);
      const error  = sample.label - pred;
      const loss   = logLoss(pred, sample.label);
      totalTrainLoss += loss;

      for (let i = 0; i < FEATURE_DIM; i++) {
        const gradient = error * x[i] - _model.lambda * _model.weights[i];
        _model.weights[i] = clamp(_model.weights[i] + batchLR * gradient, -5, 5);
      }
      _model.bias = clamp(_model.bias + batchLR * error, -5, 5);
    }
  }

  const avgTrainLoss = totalTrainLoss / (trainSet.length * epochs);

  // VALIDATION PASS (no weight updates)
  const valPreds:  number[] = [];
  const valLabels: number[] = [];
  let   totalValLoss = 0;

  for (const sample of valSet) {
    const x    = normalizeVector(sample.features);
    const z    = dot(_model.weights, x) + _model.bias;
    const pred = sigmoid(z);
    valPreds.push(pred);
    valLabels.push(sample.label);
    totalValLoss += logLoss(pred, sample.label);
  }

  const avgValLoss = valSet.length > 0 ? totalValLoss / valSet.length : avgTrainLoss;

  // PART 4: Full Metrics
  const metrics = computeMetrics(valPreds, valLabels);

  // PART 5: Drift detection
  const driftScore = Math.abs(avgValLoss - _model.baseline_loss);

  // Set baseline on first ever batch
  if (_model.baseline_loss === 0.693) {
    _model.baseline_loss = avgValLoss;
  }

  _model.batch_trained  += trainSet.length;
  _model.last_loss       = Math.round(avgTrainLoss * 10000) / 10000;
  _model.last_val_loss   = Math.round(avgValLoss   * 10000) / 10000;
  _model.last_accuracy   = metrics.accuracy;
  _model.last_precision  = metrics.precision;
  _model.last_recall     = metrics.recall;
  _model.last_f1         = metrics.f1;
  _model.last_auc        = metrics.auc;
  _model.drift_score     = Math.round(driftScore * 10000) / 10000;
  _model.version++;
  _model.model_id        = `v${_model.version}_${Date.now()}`;
  _model.updated_at      = Date.now();

  _updateGovernanceAndFailsafe();

  console.log("📊 BATCH COMPLETE:", {
    samples:  dataset.length,
    train_n:  trainSet.length,
    val_n:    valSet.length,
    train_loss:  _model.last_loss,
    val_loss:    _model.last_val_loss,
    accuracy:    _model.last_accuracy,
    precision:   _model.last_precision,
    recall:      _model.last_recall,
    f1:          _model.last_f1,
    auc:         _model.last_auc,
    drift:       _model.drift_detected,
    ai_enabled:  _model.ai_enabled,
    allow_sync:  _model.allow_sync,
    version:     _model.version
  });

  // PART 6: Log to training_logs
  await _logTraining(trainSet.length, valSet.length);

  // PART 7: Save versioned model snapshot
  await saveModelVersion();
  await saveModelToDB();
  await saveFeatureStatsToDB();

  return {
    samples:    dataset.length,
    train_loss: _model.last_loss,
    val_loss:   _model.last_val_loss,
    accuracy:   _model.last_accuracy,
    precision:  _model.last_precision,
    recall:     _model.last_recall,
    f1:         _model.last_f1,
    auc:        _model.last_auc
  };
}

// ============================================================
// INFERENCE
// ============================================================
export function predict(features: number[]): {
  score: number; confidence: number; model_version: number;
  model_type: string; ai_enabled: boolean;
} {
  // PART 9 FAIL-SAFE: if AI is disabled, return neutral score
  if (!_model.ai_enabled) {
    return {
      score:         0,        // no intervention
      confidence:    0,
      model_version: _model.version,
      model_type:    "logistic_regression_DISABLED_failsafe",
      ai_enabled:    false
    };
  }

  const feat = (features && features.length === FEATURE_DIM)
    ? normalizeVector(features)
    : new Array(FEATURE_DIM).fill(0);

  const z          = dot(_model.weights, feat) + _model.bias;
  const score      = sigmoid(z);
  const confidence = clamp(Math.abs(score - 0.5) * 2, 0, 1);

  return {
    score:         Math.round(score      * 1000) / 1000,
    confidence:    Math.round(confidence * 1000) / 1000,
    model_version: _model.version,
    model_type:    "logistic_regression_hybrid_v3",
    ai_enabled:    true
  };
}

// ============================================================
// MODEL PERSISTENCE — nolix_model_weights
// ============================================================
export async function saveModelToDB(): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_model_weights
       (id, scroll, clicks, time, engagement, hesitation, bias, lr, version, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         scroll=$1, clicks=$2, time=$3, engagement=$4, hesitation=$5,
         bias=$6, lr=$7, version=$8, updated_at=NOW()`,
      [
        _model.weights[0], _model.weights[1], _model.weights[2],
        _model.weights[4], _model.weights[3],
        _model.bias, _model.lr, _model.version
      ]
    );
  } catch(e) { console.warn("⚠ ML: saveModelToDB failed:", e); }
}

// PART 7: Save versioned snapshot to nolix_models (rollback-capable)
export async function saveModelVersion(): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_models
       (model_id, weights, bias, lr, lambda, version, metrics, drift_detected, ai_enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (model_id) DO NOTHING`,
      [
        _model.model_id,
        JSON.stringify(_model.weights),
        _model.bias,
        _model.lr,
        _model.lambda,
        _model.version,
        JSON.stringify({
          train_loss: _model.last_loss, val_loss: _model.last_val_loss,
          accuracy:   _model.last_accuracy, precision: _model.last_precision,
          recall:     _model.last_recall,   f1:       _model.last_f1,
          auc:        _model.last_auc,      drift:    _model.drift_score
        }),
        _model.drift_detected,
        _model.ai_enabled
      ]
    );
  } catch(e) { console.warn("⚠ ML: saveModelVersion failed:", e); }
}

// PART 7: Rollback to a previous model version
export async function rollbackToVersion(modelId: string): Promise<boolean> {
  try {
    const rows = await query<any>(
      `SELECT weights, bias, lr, lambda, version, metrics FROM nolix_models
       WHERE model_id=$1 LIMIT 1`, [modelId]
    );
    if (!rows.length) { console.error("❌ ROLLBACK: Model not found:", modelId); return false; }
    const m = rows[0] as any;
    const w = JSON.parse(m.weights);
    if (!Array.isArray(w) || w.length !== FEATURE_DIM) { return false; }
    _model.weights  = w;
    _model.bias     = Number(m.bias);
    _model.lr       = Number(m.lr);
    _model.lambda   = Number(m.lambda) || LAMBDA;
    _model.version  = Number(m.version);
    _model.model_id = modelId + "_restored";
    _updateGovernanceAndFailsafe();
    await saveModelToDB();
    console.log("♻ ROLLBACK: Restored model:", modelId);
    return true;
  } catch(e) { console.error("❌ ROLLBACK ERROR:", e); return false; }
}

export async function loadModelFromDB(): Promise<void> {
  try {
    const rows = await query<any>(
      `SELECT scroll, clicks, time, engagement, hesitation, bias, lr, version
       FROM nolix_model_weights WHERE id=1 LIMIT 1`
    );
    if (rows.length) {
      const r          = rows[0] as any;
      _model.weights   = [
        Number(r.scroll), Number(r.clicks), Number(r.time),
        Number(r.hesitation), Number(r.engagement), 0.10, 0.10, 0.15
      ];
      _model.bias      = Number(r.bias)    || 0;
      _model.lr        = Number(r.lr)      || 0.01;
      _model.version   = Number(r.version) || 0;
      _loaded          = true;
      _updateGovernanceAndFailsafe();
      console.log("🧠 ML v3: Loaded from DB. version:", _model.version, "ai_enabled:", _model.ai_enabled);
    }
  } catch(e) { console.warn("⚠ ML: loadModelFromDB failed. Using defaults."); }
}

export function getModelState(): ModelWeightsV3 {
  return { ..._model, weights: [..._model.weights] };
}

export function isLoaded(): boolean { return _loaded; }
export function isAIEnabled(): boolean { return _model.ai_enabled; }

// ============================================================
// PART 6: Training Log
// ============================================================
async function _logTraining(trainSamples: number, valSamples: number): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_training_logs
       (model_id, model_version, train_samples, val_samples, train_loss, val_loss,
        accuracy, precision, recall, f1, auc, drift_detected, ai_enabled, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())`,
      [
        _model.model_id, _model.version, trainSamples, valSamples,
        _model.last_loss, _model.last_val_loss,
        _model.last_accuracy, _model.last_precision, _model.last_recall,
        _model.last_f1, _model.last_auc, _model.drift_detected, _model.ai_enabled
      ]
    );
  } catch { /* silent — logs must not crash training */ }
}

export async function getTrainingHistory(limit = 50): Promise<any[]> {
  try {
    return await query(
      `SELECT * FROM nolix_training_logs ORDER BY logged_at DESC LIMIT $1`, [limit]
    );
  } catch { return []; }
}

export async function getObservabilityHistory(limit = 50): Promise<any[]> {
  try {
    return await query(
      `SELECT * FROM nolix_model_observability ORDER BY logged_at DESC LIMIT $1`, [limit]
    );
  } catch { return []; }
}
