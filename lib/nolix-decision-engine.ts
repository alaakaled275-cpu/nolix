/**
 * NOLIX — Revenue Brain Decision Engine (STEP 11 PART 10)
 * lib/nolix-decision-engine.ts
 *
 * THE FINAL SCORING LAYER.
 * Combines: ML probability + cross-user similarity boost + fraud penalty + revenue weight
 *
 * final_score = model_probability + similarity_boost - fraud_penalty + revenue_weight
 *
 * This score governs:
 * - Whether to show popup
 * - What discount level to offer
 * - Whether to block (fraud)
 */

import { predict }        from "./nolix-ml-engine";
import { embeddingDB }    from "./nolix-embedding-db";
import { getABGroup }     from "./nolix-ab-engine";

// ============================================================
// DECISION WEIGHTS (tunable constants)
// ============================================================
const WEIGHTS = {
  SIMILARITY_BOOST:   0.10,  // max score boost from cross-user similarity
  FRAUD_PENALTY:      0.40,  // hard penalty for known abusers
  SOFT_FRAUD_PENALTY: 0.15,  // soft penalty for mild abuse risk
  REVENUE_WEIGHT:     0.05,  // small boost for high-LTV visitors
  HIGH_INTENT_THRESH: 0.65,  // score above this = show popup
  BLOCK_THRESH:       0.20,  // score below this AND fraud = hard block
};

// Discount tiers based on final_score
const DISCOUNT_TIERS = [
  { min: 0.80, discount: 15, label: "aggressive" },
  { min: 0.65, discount: 10, label: "standard"   },
  { min: 0.50, discount:  5, label: "soft"       },
  { min: 0.00, discount:  0, label: "none"        }
];

export interface DecisionResult {
  final_score:       number;
  ml_score:          number;
  similarity_boost:  number;
  fraud_penalty:     number;
  revenue_weight:    number;
  action:            "show_popup" | "block" | "observe";
  discount_pct:      number;
  discount_tier:     string;
  ab_group:          "ml" | "control";
  reason:            string;
  confidence:        number;
  model_version:     number;
}

export interface DecisionInput {
  visitor_id:          string;
  features:            number[];           // 8D feature vector
  coupon_abuse_severity: number;           // 0-3
  visit_count:         number;
  current_vector?:     number[];           // for similarity search
  store?:              string;
}

// ============================================================
// MAIN DECISION FUNCTION
// ============================================================
export async function makeDecision(input: DecisionInput): Promise<DecisionResult> {
  const { visitor_id, features, coupon_abuse_severity, visit_count, current_vector, store } = input;

  // ── A/B GROUP CHECK FIRST (control group gets no ML) ──────────────────
  const abGroup = getABGroup(visitor_id);
  if (abGroup === "control") {
    return {
      final_score: 0, ml_score: 0, similarity_boost: 0,
      fraud_penalty: 0, revenue_weight: 0,
      action: "observe", discount_pct: 0,
      discount_tier: "none", ab_group: "control",
      reason: "control_group_no_intervention",
      confidence: 0, model_version: 0
    };
  }

  // ── STEP 1: ML BASE SCORE ───────────────────────────────────────────────
  const prediction = predict(features);
  let finalScore   = prediction.score;
  let mlScore      = prediction.score;

  // ── STEP 2: CROSS-USER SIMILARITY BOOST ────────────────────────────────
  // If this visitor looks like past high-converting visitors → boost score
  let similarityBoost = 0;
  if (current_vector && current_vector.length > 0) {
    try {
      const similar = await embeddingDB.searchSimilar(current_vector, store, 5);
      if (similar.length > 0) {
        // Average similarity of top-5 most similar visitors
        const avgSim  = similar.reduce((s, r) => s + r.similarity, 0) / similar.length;
        similarityBoost = Math.round(avgSim * WEIGHTS.SIMILARITY_BOOST * 1000) / 1000;
        finalScore     += similarityBoost;
      }
    } catch(e) { /* non-critical — proceed without boost */ }
  }

  // ── STEP 3: FRAUD PENALTY ───────────────────────────────────────────────
  let fraudPenalty = 0;
  if (coupon_abuse_severity >= 3) {
    fraudPenalty = WEIGHTS.FRAUD_PENALTY;       // hard blocker
  } else if (coupon_abuse_severity >= 2) {
    fraudPenalty = WEIGHTS.SOFT_FRAUD_PENALTY;  // soft blocker
  } else if (coupon_abuse_severity === 1) {
    fraudPenalty = WEIGHTS.SOFT_FRAUD_PENALTY * 0.5; // minor risk
  }
  finalScore -= fraudPenalty;

  // ── STEP 4: REVENUE WEIGHT (loyal visitor slight boost) ─────────────────
  // Visitors with 3+ visits who have NOT abused get a tiny LTV boost
  let revenueWeight = 0;
  if (visit_count >= 3 && coupon_abuse_severity === 0) {
    revenueWeight = WEIGHTS.REVENUE_WEIGHT;
    finalScore   += revenueWeight;
  }

  // ── CLAMP FINAL SCORE ───────────────────────────────────────────────────
  finalScore = Math.max(0, Math.min(1, Math.round(finalScore * 1000) / 1000));

  // ── STEP 5: ACTION DECISION ─────────────────────────────────────────────
  let action:   "show_popup" | "block" | "observe" = "observe";
  let reason    = "";

  if (coupon_abuse_severity >= 3) {
    action = "block";
    reason = `fraud_block: abuse_severity=${coupon_abuse_severity}`;
  } else if (finalScore >= WEIGHTS.HIGH_INTENT_THRESH) {
    action = "show_popup";
    reason = `high_intent: score=${finalScore}`;
  } else {
    action  = "observe";
    reason  = `low_intent: score=${finalScore} (threshold: ${WEIGHTS.HIGH_INTENT_THRESH})`;
  }

  // ── STEP 6: DISCOUNT TIER ───────────────────────────────────────────────
  const tier = DISCOUNT_TIERS.find(t => finalScore >= t.min) || DISCOUNT_TIERS[3];

  return {
    final_score:      finalScore,
    ml_score:         mlScore,
    similarity_boost: similarityBoost,
    fraud_penalty:    fraudPenalty,
    revenue_weight:   revenueWeight,
    action,
    discount_pct:     action === "block" ? 0 : tier.discount,
    discount_tier:    action === "block" ? "none" : tier.label,
    ab_group:         "ml",
    reason,
    confidence:       prediction.confidence,
    model_version:    prediction.model_version
  };
}

// ============================================================
// DISCOUNT LABEL (for popup display)
// ============================================================
export function discountLabel(pct: number): string {
  if (pct >= 15) return "🔥 خصم حصري 15%!";
  if (pct >= 10) return "⚡ خصم 10% لفترة محدودة";
  if (pct >= 5)  return "🎁 خصم 5% احتفالاً بزيارتك";
  return "";
}
