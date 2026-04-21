/**
 * NOLIX — Feature Statistics System (STEP 11.1 PART 1)
 * lib/nolix-feature-stats.ts
 *
 * Online Welford's Algorithm for tracking mean + variance per feature.
 * Used to perform z-score normalization on feature vectors.
 *
 * WHY WELFORD? Because we can't store every data point.
 * Welford's runs in O(1) memory and updates mean/variance
 * incrementally with each new sample.
 *
 * Final normalize formula:
 *   z = (x - mean) / (std + 1e-9)
 *   clamped to [-3, 3] (3 standard deviations)
 */

import { query } from "./db";

// Feature dimension names (matches 8D model vector)
export const FEATURE_NAMES = [
  "scroll",
  "clicks",
  "dwell",
  "hesitation",
  "engagement",
  "recency",
  "loyalty",
  "trust"
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

// In-memory Welford state (fast read path — backed by DB)
interface WelfordState {
  n:    number;   // count of samples seen
  mean: number;
  M2:   number;   // sum of squared differences from mean (Welford)
}

// One Welford state per feature dimension
const _stats: WelfordState[] = FEATURE_NAMES.map(() => ({
  n: 0, mean: 0, M2: 0
}));

// Stats loaded from DB flag
let _loaded = false;

// ============================================================
// WELFORD ONLINE UPDATE
// Updates mean and variance incrementally with a new sample.
// ============================================================
function welfordUpdate(state: WelfordState, x: number): void {
  state.n++;
  const delta  = x - state.mean;
  state.mean  += delta / state.n;
  const delta2 = x - state.mean;
  state.M2    += delta * delta2;
}

function welfordStd(state: WelfordState): number {
  if (state.n < 2) return 1.0;  // default std=1 if insufficient data
  return Math.sqrt(state.M2 / (state.n - 1));
}

// ============================================================
// NORMALIZE FEATURES — Z-SCORE NORMALIZATION
// z = (x - mean) / (std + epsilon)
// Clamped to [-3, 3] to remove extreme outliers
// ============================================================
export function normalizeVector(features: number[]): number[] {
  return features.map((x, i) => {
    const state = _stats[i];
    if (!state || state.n < 5) {
      // Insufficient data: use min-max [0,1] passthrough
      return Math.max(0, Math.min(1, isNaN(x) ? 0 : x));
    }
    const std = welfordStd(state);
    const z   = (x - state.mean) / (std + 1e-9);
    // Clamp z to [-3, 3] standard deviations (removes extreme outliers)
    return Math.max(-3, Math.min(3, isNaN(z) ? 0 : z));
  });
}

// ============================================================
// UPDATE STATS WITH NEW FEATURE VECTOR
// Called from queue worker on every real event
// ============================================================
export function updateFeatureStats(features: number[]): void {
  for (let i = 0; i < Math.min(features.length, _stats.length); i++) {
    if (!isNaN(features[i])) {
      welfordUpdate(_stats[i], features[i]);
    }
  }
}

// ============================================================
// PERSIST STATS TO DB (called periodically after batch)
// ============================================================
export async function saveFeatureStatsToDB(): Promise<void> {
  try {
    for (let i = 0; i < FEATURE_NAMES.length; i++) {
      const state = _stats[i];
      const std   = welfordStd(state);
      await query(
        `INSERT INTO nolix_feature_stats
         (feature, n, mean, std, m2, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (feature) DO UPDATE SET
           n=EXCLUDED.n, mean=EXCLUDED.mean,
           std=EXCLUDED.std, m2=EXCLUDED.m2, updated_at=NOW()`,
        [FEATURE_NAMES[i], state.n, state.mean, std, state.M2]
      );
    }
    console.log("💾 FEATURE STATS: Saved to DB.");
  } catch(e) { console.warn("⚠ FEATURE STATS: DB save failed:", e); }
}

// ============================================================
// LOAD STATS FROM DB (called on server boot)
// ============================================================
export async function loadFeatureStatsFromDB(): Promise<void> {
  if (_loaded) return;
  try {
    const rows = await query<any>(
      `SELECT feature, n, mean, std, m2 FROM nolix_feature_stats`
    );
    for (const row of rows as any[]) {
      const idx = FEATURE_NAMES.indexOf(row.feature as FeatureName);
      if (idx !== -1) {
        _stats[idx].n    = Number(row.n)    || 0;
        _stats[idx].mean = Number(row.mean) || 0;
        _stats[idx].M2   = Number(row.m2)   || 0;
      }
    }
    _loaded = true;
    console.log("📊 FEATURE STATS: Loaded from DB. Samples:", _stats[0].n);
  } catch(e) { console.warn("⚠ FEATURE STATS: Load from DB failed. Using defaults."); }
}

// ============================================================
// GET CURRENT STATS SNAPSHOT (for observability)
// ============================================================
export function getFeatureStatsSnapshot(): Record<FeatureName, { n: number; mean: number; std: number }> {
  const snap = {} as Record<FeatureName, { n: number; mean: number; std: number }>;
  FEATURE_NAMES.forEach((name, i) => {
    snap[name] = {
      n:    _stats[i].n,
      mean: Math.round(_stats[i].mean * 10000) / 10000,
      std:  Math.round(welfordStd(_stats[i]) * 10000) / 10000
    };
  });
  return snap;
}
