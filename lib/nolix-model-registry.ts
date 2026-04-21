/**
 * NOLIX — Model Registry System (STEP 15 PART 2)
 * lib/nolix-model-registry.ts
 *
 * Tracks all trained models with:
 *   - Version numbers (auto-increment)
 *   - Status: staging → production (promotion) or rollback
 *   - AUC-based auto-promotion: AUC > 0.65 && no drift → promote
 *   - Rollback: revert to previous production version
 *   - Metrics JSON: weights, bias, auc, drift, feature_stats
 */

import { query }               from "./db";
import { invalidateModelCache } from "./nolix-model-server";
import { logMetric }            from "./nolix-metrics";

export interface ModelRecord {
  model_id:     string;
  version:      number;
  status:       "staging" | "production" | "archived" | "failed";
  auc:          number;
  drift:        number;
  train_samples: number;
  metrics_json: Record<string, any>;
  promoted_by:  string | null;
  created_at:   string;
  promoted_at:  string | null;
}

// ── Register new model (after training) ──────────────────────────────────────
export async function registerModel(
  metrics: {
    weights:       number[];
    bias:          number;
    auc:           number;
    drift:         number;
    train_samples: number;
    val_loss:      number;
    feature_stats: { mean: number[]; variance: number[] };
    [key: string]: any;
  },
  registeredBy: string = "auto_training"
): Promise<{ version: number; status: "staging" | "production"; auto_promoted: boolean }> {

  try {
    // Get next version
    const vRes = await query<any>(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM nolix_model_registry"
    );
    const version  = Number((vRes as any[])[0]?.next_version) || 1;
    const model_id = `nolix_v${version}_${Date.now()}`;

    await query(
      `INSERT INTO nolix_model_registry
       (model_id, version, status, auc, drift, train_samples, metrics_json, created_at, registered_by)
       VALUES ($1, $2, 'staging', $3, $4, $5, $6, NOW(), $7)`,
      [model_id, version, metrics.auc, metrics.drift, metrics.train_samples, JSON.stringify(metrics), registeredBy]
    );

    console.log(`📝 MODEL REGISTRY: Registered v${version} (staging) AUC=${metrics.auc}`);
    await logMetric("model_registered", metrics.auc, { version, status: "staging" }).catch(() => {});

    // Auto-promote if quality criteria met
    const autoPromoted = await _tryAutoPromote(version, metrics.auc, metrics.drift);

    return { version, status: autoPromoted ? "production" : "staging", auto_promoted: autoPromoted };
  } catch(e) {
    console.error("❌ MODEL REGISTRY: registerModel failed:", e);
    throw e;
  }
}

// ── Auto-promote staging → production ────────────────────────────────────────
async function _tryAutoPromote(version: number, auc: number, drift: number): Promise<boolean> {
  // Promotion criteria: AUC > 0.65 AND drift ≤ 0.30
  if (auc <= 0.65 || drift > 0.30) {
    console.log(`⚙ REGISTRY: v${version} NOT auto-promoted. AUC=${auc} drift=${drift}`);
    return false;
  }

  return promoteModel(version, "auto_promotion");
}

// ── Promote model to production ───────────────────────────────────────────────
export async function promoteModel(version: number, promotedBy: string = "admin"): Promise<boolean> {
  try {
    // Archive current production
    await query(
      "UPDATE nolix_model_registry SET status='archived' WHERE status='production'",
    );

    // Promote this version
    await query(
      "UPDATE nolix_model_registry SET status='production', promoted_by=$1, promoted_at=NOW() WHERE version=$2",
      [promotedBy, version]
    );

    // Invalidate model server cache so it reloads
    invalidateModelCache();

    console.log(`🟢 MODEL REGISTRY: v${version} PROMOTED to production by ${promotedBy}`);
    await logMetric("model_promoted", version, { promoted_by: promotedBy }).catch(() => {});
    return true;
  } catch(e) {
    console.error("❌ MODEL REGISTRY: promotedModel failed:", e);
    return false;
  }
}

// ── Rollback to previous production version ───────────────────────────────────
export async function rollbackModel(by: string = "admin"): Promise<{ rolled_back_to: number } | null> {
  try {
    // Find the most recent archived model (previous production)
    const rows = await query<any>(
      "SELECT version FROM nolix_model_registry WHERE status='archived' ORDER BY promoted_at DESC NULLS LAST, version DESC LIMIT 1"
    );
    const prev = (rows as any[])[0];
    if (!prev) {
      console.warn("⚠ REGISTRY: No archived version to rollback to.");
      return null;
    }

    // Archive current production
    await query("UPDATE nolix_model_registry SET status='archived' WHERE status='production'");

    // Restore previous
    await query(
      "UPDATE nolix_model_registry SET status='production', promoted_by=$1, promoted_at=NOW() WHERE version=$2",
      [`rollback_by_${by}`, prev.version]
    );

    invalidateModelCache();
    console.log(`🔄 MODEL REGISTRY: ROLLBACK to v${prev.version} by ${by}`);
    await logMetric("model_rollback", prev.version, { rolled_back_by: by }).catch(() => {});
    return { rolled_back_to: prev.version };
  } catch(e) {
    console.error("❌ MODEL REGISTRY: rollbackModel failed:", e);
    return null;
  }
}

// ── Get production model ──────────────────────────────────────────────────────
export async function getProductionModel(): Promise<ModelRecord | null> {
  try {
    const rows = await query<any>(
      "SELECT * FROM nolix_model_registry WHERE status='production' ORDER BY version DESC LIMIT 1"
    );
    return (rows as any[])[0] || null;
  } catch { return null; }
}

// ── List all models ───────────────────────────────────────────────────────────
export async function listModels(limit = 20): Promise<ModelRecord[]> {
  try {
    return await query<ModelRecord>(
      "SELECT * FROM nolix_model_registry ORDER BY version DESC LIMIT $1",
      [limit]
    ) as ModelRecord[];
  } catch { return []; }
}

// ── Mark model as failed ──────────────────────────────────────────────────────
export async function markModelFailed(version: number, reason: string): Promise<void> {
  try {
    await query(
      "UPDATE nolix_model_registry SET status='failed', metrics_json = metrics_json || $1::jsonb WHERE version=$2",
      [JSON.stringify({ failure_reason: reason }), version]
    );
  } catch {}
}

// ── Get model comparison (staging vs production) ──────────────────────────────
export async function compareModels(): Promise<{ production: ModelRecord | null; staging: ModelRecord | null; recommendation: string }> {
  const prod    = await getProductionModel();
  const stagRows = await query<any>("SELECT * FROM nolix_model_registry WHERE status='staging' ORDER BY version DESC LIMIT 1").catch(() => []);
  const stag = (stagRows as any[])[0] || null;

  let recommendation = "No staging model available";
  if (prod && stag) {
    const aucDelta = Number(stag.auc) - Number(prod.auc);
    const driftOk  = Number(stag.drift) <= 0.30;
    if (aucDelta > 0.02 && driftOk) {
      recommendation = `PROMOTE v${stag.version}: AUC improved by ${(aucDelta*100).toFixed(1)}%`;
    } else if (aucDelta < -0.03) {
      recommendation = `KEEP v${prod.version}: staging AUC worse by ${(Math.abs(aucDelta)*100).toFixed(1)}%`;
    } else {
      recommendation = `Monitor: AUC delta=${(aucDelta*100).toFixed(1)}% (threshold: +2%)`;
    }
  }

  return { production: prod, staging: stag, recommendation };
}
