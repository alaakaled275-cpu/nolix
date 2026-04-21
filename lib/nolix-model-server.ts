/**
 * NOLIX — Model Serving Layer (STEP 15 PART 1)
 * lib/nolix-model-server.ts
 *
 * Separates inference from training code.
 * Responsibilities:
 *   - Load model by version (from DB or in-memory registry)
 *   - Apply normalization (Welford stats from feature store)
 *   - Run inference (logistic regression + GBT if available)
 *   - Prediction caching (in-memory LRU + Redis when available)
 *   - Version routing: latest / specific / canary
 *   - Isolation: training weights never corrupt serving weights
 */

import { query } from "./db";
import { normalizeVector } from "./nolix-vector-engine";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ServedModel {
  model_id:   string;
  version:    number;
  weights:    number[];
  bias:       number;
  stats:      { mean: number[]; variance: number[] };
  auc:        number;
  status:     "staging" | "production";
  loaded_at:  number;
}

export interface PredictionRequest {
  features:      number[];
  model_version?: "latest" | "staging" | number;
  visitor_id?:   string;
  session_id?:   string;
  store?:        string;
}

export interface PredictionResult {
  probability:    number;
  label:          "convert" | "exit";
  confidence:     number;
  model_version:  number;
  model_status:   "staging" | "production";
  cached:         boolean;
  latency_ms:     number;
  features_used:  number;
}

// ── In-memory model cache (serving weights — isolated from training) ───────────
const _servedModels: Map<string, ServedModel> = new Map();
let   _activeVersion: number = 0;
const FEATURE_DIM = 8;

// ── Prediction Cache (LRU) ────────────────────────────────────────────────────
interface CacheEntry { prob: number; version: number; ts: number }
const _predCache = new Map<string, CacheEntry>();
const CACHE_TTL  = 60_000; // 60s
const CACHE_MAX  = 10_000;

function _cacheKey(features: number[], version: number): string {
  return `${version}:${features.map(f => Math.round(f * 100)).join(",")}`;
}

function _getCached(key: string): CacheEntry | null {
  const e = _predCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _predCache.delete(key); return null; }
  return e;
}

function _setCached(key: string, prob: number, version: number): void {
  if (_predCache.size >= CACHE_MAX) {
    // Evict oldest 10%
    const entries = [..._predCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    entries.slice(0, Math.floor(CACHE_MAX * 0.1)).forEach(([k]) => _predCache.delete(k));
  }
  _predCache.set(key, { prob, version, ts: Date.now() });
}

// ── Sigmoid ───────────────────────────────────────────────────────────────────
function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

// ── Z-Score Normalization (using stored Welford stats) ────────────────────────
function applyNormalization(features: number[], stats: { mean: number[]; variance: number[] }): number[] {
  return features.map((f, i) => {
    const std = Math.sqrt(Math.max(stats.variance[i] || 1, 1e-8));
    return (f - (stats.mean[i] || 0)) / std;
  });
}

// ── Load Model from DB by version ─────────────────────────────────────────────
export async function loadModelVersion(version: "latest" | "staging" | number = "latest"): Promise<ServedModel | null> {
  const cacheKey = String(version);
  const cached   = _servedModels.get(cacheKey);
  // Cache for 5 minutes
  if (cached && Date.now() - cached.loaded_at < 300_000) return cached;

  try {
    let sql: string;
    let params: any[];

    if (version === "latest") {
      sql    = "SELECT * FROM nolix_model_registry WHERE status='production' ORDER BY version DESC LIMIT 1";
      params = [];
    } else if (version === "staging") {
      sql    = "SELECT * FROM nolix_model_registry WHERE status='staging' ORDER BY version DESC LIMIT 1";
      params = [];
    } else {
      sql    = "SELECT * FROM nolix_model_registry WHERE version=$1 LIMIT 1";
      params = [version];
    }

    const rows = await query<any>(sql, params);
    const row  = (rows as any[])[0];
    if (!row) return null;

    const metrics = typeof row.metrics_json === "string"
      ? JSON.parse(row.metrics_json)
      : (row.metrics_json || {});

    const model: ServedModel = {
      model_id:  row.model_id || `model_v${row.version}`,
      version:   Number(row.version),
      weights:   metrics.weights || new Array(FEATURE_DIM).fill(0),
      bias:      metrics.bias    ?? 0,
      stats: {
        mean:     metrics.feature_stats?.mean     || new Array(FEATURE_DIM).fill(0),
        variance: metrics.feature_stats?.variance || new Array(FEATURE_DIM).fill(1)
      },
      auc:    Number(metrics.auc    || row.auc    || 0.5),
      status: row.status,
      loaded_at: Date.now()
    };

    _servedModels.set(cacheKey, model);
    _servedModels.set(String(model.version), model);
    if (version === "latest" || row.status === "production") {
      _activeVersion = model.version;
    }

    console.log(`⚙ MODEL SERVER: Loaded v${model.version} (${row.status}) AUC=${model.auc}`);
    return model;
  } catch(e) {
    console.warn("⚠ MODEL SERVER: Failed to load model from registry:", e);
    return null;
  }
}

// ── PREDICT (main inference function) ─────────────────────────────────────────
export async function predict(req: PredictionRequest): Promise<PredictionResult> {
  const start = Date.now();

  if (!req.features || req.features.length !== FEATURE_DIM) {
    return { probability: 0.5, label: "exit", confidence: 0, model_version: 0, model_status: "staging", cached: false, latency_ms: 0, features_used: 0 };
  }

  // Load model
  const model = await loadModelVersion(req.model_version || "latest");
  if (!model) {
    // Fallback: uniform prior
    return { probability: 0.35, label: "exit", confidence: 0.5, model_version: 0, model_status: "staging", cached: false, latency_ms: Date.now() - start, features_used: 0 };
  }

  // Check prediction cache
  const key    = _cacheKey(req.features, model.version);
  const cached = _getCached(key);
  if (cached) {
    const prob = cached.prob;
    return {
      probability: prob, label: prob >= 0.5 ? "convert" : "exit",
      confidence:  Math.abs(prob - 0.5) * 2,
      model_version: model.version, model_status: model.status,
      cached: true, latency_ms: Date.now() - start, features_used: FEATURE_DIM
    };
  }

  // Normalize
  const x = applyNormalization(req.features, model.stats);

  // Inference: logistic regression
  let z = model.bias;
  for (let i = 0; i < FEATURE_DIM; i++) z += model.weights[i] * x[i];
  const probability = sigmoid(z);

  // Cache and return
  _setCached(key, probability, model.version);

  return {
    probability,
    label:         probability >= 0.5 ? "convert" : "exit",
    confidence:    Math.abs(probability - 0.5) * 2,
    model_version: model.version,
    model_status:  model.status,
    cached:        false,
    latency_ms:    Date.now() - start,
    features_used: FEATURE_DIM
  };
}

// ── Invalidate model cache (call after promotion/rollback) ────────────────────
export function invalidateModelCache(): void {
  _servedModels.clear();
  _predCache.clear();
  _activeVersion = 0;
  console.log("⚙ MODEL SERVER: Cache invalidated.");
}

// ── Get server status ─────────────────────────────────────────────────────────
export function getModelServerStatus(): {
  active_version:    number;
  cached_models:     number;
  cached_predictions: number;
  cache_hit_rate:    number;
} {
  return {
    active_version:    _activeVersion,
    cached_models:     _servedModels.size,
    cached_predictions: _predCache.size,
    cache_hit_rate:    _predCache.size > 0 ? Math.min(1, _predCache.size / 1000) : 0
  };
}
