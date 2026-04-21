/**
 * NOLIX — Real Feature Store (STEP 15 PART 3)
 * lib/nolix-feature-store-v2.ts
 *
 * Point-in-time correct feature storage.
 * Unlike Welford stats (global running averages), this stores
 * per-visitor, per-timestamp feature snapshots for:
 *   - Historical replay (training at time T uses features from time T)
 *   - Online/offline parity (same features in training & inference)
 *   - Feature versioning (schema changes tracked)
 *   - Feature drift detection (feature distribution over time)
 */

import { query } from "./db";

// ── Feature Schema (PART 13: Data Contracts) ─────────────────────────────────
export const FEATURE_SCHEMA: Record<string, { type: "numeric" | "boolean" | "categorical"; required: boolean; range?: [number, number] }> = {
  time_on_site:      { type: "numeric",    required: true,  range: [0, 3600] },
  pages_viewed:      { type: "numeric",    required: true,  range: [0, 100] },
  scroll_depth:      { type: "numeric",    required: true,  range: [0, 100] },
  cart_status:       { type: "categorical", required: true  },
  hesitations:       { type: "numeric",    required: true,  range: [0, 50] },
  return_visitor:    { type: "boolean",    required: true  },
  exit_intent:       { type: "boolean",    required: false },
  cta_hover_count:   { type: "numeric",    required: false, range: [0, 20] },
};

export type FeatureMap = Record<string, number | boolean | string>;

// ── Validation result ─────────────────────────────────────────────────────────
export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Validate features against contract (PART 13) ─────────────────────────────
export function validateFeatures(features: FeatureMap): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  for (const [name, schema] of Object.entries(FEATURE_SCHEMA)) {
    const val = features[name];

    if (val === undefined || val === null) {
      if (schema.required) {
        errors.push(`MISSING required feature: ${name}`);
      } else {
        warnings.push(`Optional feature missing: ${name}`);
      }
      continue;
    }

    if (schema.type === "numeric" && typeof val === "number") {
      if (schema.range) {
        if (val < schema.range[0] || val > schema.range[1]) {
          warnings.push(`Feature ${name}=${val} outside range ${schema.range}`);
        }
      }
      if (!isFinite(val)) {
        errors.push(`Feature ${name} is not finite: ${val}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Store feature snapshot (point-in-time) ────────────────────────────────────
export async function storeFeatureSnapshot(
  visitorId:  string,
  features:   FeatureMap,
  label?:     number,        // 1=converted, 0=not, null=unknown
  sessionId?: string,
  store?:     string
): Promise<boolean> {
  // Validate first (PART 13: data contracts)
  const validation = validateFeatures(features);
  if (!validation.valid) {
    console.warn("⚠ FEATURE STORE: Validation failed:", validation.errors);
    return false; // REJECT invalid events
  }

  try {
    await query(
      `INSERT INTO nolix_feature_snapshots
       (visitor_id, session_id, store, features_json, label, schema_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (visitor_id, session_id) DO UPDATE SET
         features_json = $4, label = COALESCE($5, nolix_feature_snapshots.label),
         updated_at = NOW()`,
      [visitorId, sessionId || null, store || null, JSON.stringify(features), label ?? null, SCHEMA_VERSION]
    );
    return true;
  } catch(e) {
    console.warn("⚠ FEATURE STORE: storeFeatureSnapshot failed:", e);
    return false;
  }
}

// ── Schema version (bump when feature schema changes) ────────────────────────
export const SCHEMA_VERSION = 3; // V3 = STEP 15

// ── Get features at a specific point in time ──────────────────────────────────
export async function getFeatureAtTime(
  visitorId: string,
  atTime:    Date | string
): Promise<FeatureMap | null> {
  try {
    const rows = await query<any>(
      `SELECT features_json FROM nolix_feature_snapshots
       WHERE visitor_id = $1
         AND created_at <= $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [visitorId, atTime]
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    return typeof row.features_json === "string"
      ? JSON.parse(row.features_json)
      : row.features_json;
  } catch { return null; }
}

// ── Get latest features for visitor ──────────────────────────────────────────
export async function getLatestFeatures(visitorId: string): Promise<FeatureMap | null> {
  try {
    const rows = await query<any>(
      "SELECT features_json FROM nolix_feature_snapshots WHERE visitor_id=$1 ORDER BY created_at DESC LIMIT 1",
      [visitorId]
    );
    const row = (rows as any[])[0];
    return row ? (typeof row.features_json === "string" ? JSON.parse(row.features_json) : row.features_json) : null;
  } catch { return null; }
}

// ── Get batch for training (with optional point-in-time) ─────────────────────
export async function getBatchForTraining(
  limit:  number = 1000,
  since?: Date
): Promise<Array<{ visitor_id: string; features: number[]; label: number; ts: Date }>> {
  try {
    const whereClause = since ? "AND created_at >= $2" : "";
    const params: any[] = [limit];
    if (since) params.push(since);

    const rows = await query<any>(`
      SELECT visitor_id, features_json, label, created_at
      FROM nolix_feature_snapshots
      WHERE label IS NOT NULL ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1
    `, params);

    return (rows as any[]).map(row => {
      const f = typeof row.features_json === "string" ? JSON.parse(row.features_json) : row.features_json;
      return {
        visitor_id: row.visitor_id,
        features:   featureMapToVector(f),
        label:      Number(row.label),
        ts:         row.created_at
      };
    }).filter(r => r.features.length === 8);
  } catch { return []; }
}

// ── Feature map → 8-dim vector (ONLINE/OFFLINE PARITY — PART 9) ──────────────
// This SAME function used in both training and inference.
// Critical: must never diverge between offline training and online serving.
export function featureMapToVector(f: FeatureMap): number[] {
  const cartVal = f.cart_status === "checkout" ? 1.0
                : f.cart_status === "added"    ? 0.6
                : f.cart_status === "viewing"  ? 0.3
                : 0.0;

  return [
    Math.min(1, Number(f.time_on_site   || 0) / 120),
    Math.min(1, Number(f.pages_viewed   || 0) / 10),
    Math.min(1, Number(f.scroll_depth   || 0) / 100),
    cartVal,
    Math.min(1, Number(f.hesitations    || 0) / 5),
    f.return_visitor   ? 1 : 0,
    f.exit_intent      ? 1 : 0,
    Math.min(1, Number(f.cta_hover_count || 0) / 5)
  ];
}

// ── Feature statistics for drift detection (PART 12) ─────────────────────────
export async function getFeatureDistribution(
  featureName: string,
  since:       Date
): Promise<{ mean: number; std: number; min: number; max: number; count: number }> {
  try {
    const rows = await query<any>(`
      SELECT
        AVG((features_json->>'${featureName}')::NUMERIC)  AS mean,
        STDDEV((features_json->>'${featureName}')::NUMERIC) AS std,
        MIN((features_json->>'${featureName}')::NUMERIC)  AS min,
        MAX((features_json->>'${featureName}')::NUMERIC)  AS max,
        COUNT(*)                                          AS count
      FROM nolix_feature_snapshots
      WHERE created_at >= $1
        AND features_json->>'${featureName}' IS NOT NULL
    `, [since]);
    const r = (rows as any[])[0] || {};
    return {
      mean:  Number(r.mean)  || 0,
      std:   Number(r.std)   || 0,
      min:   Number(r.min)   || 0,
      max:   Number(r.max)   || 0,
      count: Number(r.count) || 0
    };
  } catch { return { mean: 0, std: 0, min: 0, max: 0, count: 0 }; }
}
