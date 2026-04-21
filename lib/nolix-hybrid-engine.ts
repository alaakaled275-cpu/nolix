/**
 * NOLIX — Hybrid Decision Engine (STEP 15 PART 6)
 * lib/nolix-hybrid-engine.ts
 *
 * Replaces pure logistic regression with multi-signal fusion:
 *
 *   final_score =
 *     w1 * ML_probability          (logistic regression)
 *   + w2 * GBT_probability         (gradient boosted trees)
 *   + w3 * similarity_boost        (cross-visitor embedding)
 *   + w4 * revenue_weight          (ranking model)
 *   - w5 * fraud_penalty           (anomaly detection)
 *
 * Weights tuned to maximize revenue uplift, not just AUC.
 */

import { predict as servingPredict }      from "./nolix-model-server";
import { predictGBT, rankVisitor }        from "./nolix-advanced-models";
import { findSimilarUsers, similarityBoost } from "./nolix-vector-engine";
import { featureMapToVector, FeatureMap } from "./nolix-feature-store-v2";

// ── Fusion Weights ────────────────────────────────────────────────────────────
const HYBRID_WEIGHTS = {
  logistic:   0.35,  // LR model (stable, well-calibrated)
  gbt:        0.30,  // GBT model (captures non-linearities)
  similarity: 0.20,  // cross-user ANN similarity
  revenue:    0.10,  // multi-objective ranking
  fraud:     -0.05   // fraud/bot penalty
};

export interface HybridPrediction {
  // Final fused score
  final_score:   number;

  // Component breakdown
  components: {
    logistic_prob:    number;
    gbt_prob:         number | null;
    similarity_boost: number;
    revenue_weight:   number;
    fraud_penalty:    number;
  };

  // Decision metadata
  label:           "convert" | "exit";
  confidence:      number;
  rank:            "high" | "medium" | "low";
  model_version:   number;
  latency_ms:      number;

  // Recommended action from ranking model
  recommended_action: string;
}

// ── Fraud / Bot Detection ────────────────────────────────────────────────────
function computeFraudPenalty(features: number[], visitorId?: string): number {
  let penalty = 0;

  // Anomaly signals
  const timeOnSite   = features[0] * 120;
  const pagesViewed  = features[1] * 10;
  const hesitations  = features[4] * 5;

  // Bot: 0 time, 0 hesitations, many pages
  if (timeOnSite < 2 && pagesViewed > 5) penalty += 0.3;

  // Unrealistic speed
  if (timeOnSite < 1 && pagesViewed > 3) penalty += 0.2;

  // Zero engagement: no scroll, no hover, no hesitation
  const engagementSignals = features[0] + features[1] + features[2] + features[4] + features[7];
  if (engagementSignals < 0.05) penalty += 0.15;

  return Math.min(0.5, penalty);
}

// ── MAIN HYBRID PREDICTION ────────────────────────────────────────────────────
export async function hybridPredict(
  featureMap:   FeatureMap,
  opts: {
    visitor_id?:    string;
    store?:         string;
    aov_estimate?:  number;
    model_version?: "latest" | "staging" | number;
  } = {}
): Promise<HybridPrediction> {
  const start    = Date.now();
  const features = featureMapToVector(featureMap);

  // ── SIGNAL 1: Logistic Regression (model server) ──────────────────────────
  const lrResult = await servingPredict({
    features,
    model_version: opts.model_version || "latest",
    visitor_id:    opts.visitor_id,
    store:         opts.store
  });
  const logisticProb = lrResult.probability;

  // ── SIGNAL 2: GBT ─────────────────────────────────────────────────────────
  const gbtProb = predictGBT(features); // null if no model trained yet

  // ── SIGNAL 3: Cross-user Similarity ──────────────────────────────────────
  let simBoost = 0;
  try {
    const simResult = await findSimilarUsers(features, opts.store, 20, 0.65);
    simBoost = similarityBoost(simResult.high_similarity);
  } catch { /* non-blocking */ }

  // ── SIGNAL 4: Revenue Ranking ─────────────────────────────────────────────
  const rankResult = rankVisitor(features, logisticProb, opts.aov_estimate || 65);
  const revenueWeight = rankResult.revenue_score;

  // ── SIGNAL 5: Fraud Penalty ───────────────────────────────────────────────
  const fraudPenalty = computeFraudPenalty(features, opts.visitor_id);

  // ── FUSION ────────────────────────────────────────────────────────────────
  let finalScore =
    HYBRID_WEIGHTS.logistic   * logisticProb         +
    HYBRID_WEIGHTS.gbt        * (gbtProb ?? logisticProb) +  // fallback to LR if no GBT
    HYBRID_WEIGHTS.similarity * simBoost             +
    HYBRID_WEIGHTS.revenue    * revenueWeight        +
    HYBRID_WEIGHTS.fraud      * fraudPenalty;

  finalScore = Math.max(0, Math.min(1, finalScore));

  return {
    final_score: Math.round(finalScore * 10000) / 10000,

    components: {
      logistic_prob:    Math.round(logisticProb  * 10000) / 10000,
      gbt_prob:         gbtProb !== null ? Math.round(gbtProb * 10000) / 10000 : null,
      similarity_boost: Math.round(simBoost       * 10000) / 10000,
      revenue_weight:   Math.round(revenueWeight  * 10000) / 10000,
      fraud_penalty:    Math.round(fraudPenalty   * 10000) / 10000,
    },

    label:              finalScore >= 0.45 ? "convert" : "exit",
    confidence:         Math.abs(finalScore - 0.45) * 2,
    rank:               rankResult.rank_label,
    model_version:      lrResult.model_version,
    latency_ms:         Date.now() - start,
    recommended_action: rankResult.recommended_action
  };
}
