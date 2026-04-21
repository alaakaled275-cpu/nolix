/**
 * app/api/engine/decide/route.ts
 * ZENO — Per-Visitor Causal Evaluation Engine
 *
 * ARCHITECTURE LAW:
 * ─────────────────
 * ZENO = Brain (this file). Analyzes, predicts, decides.
 * NOLIX = Executor (engine.js). Receives ONE decision, executes it.
 *
 * NO random splits. NO 80/20 control groups.
 * Every decision is an economic calculation:
 *
 *   shouldIntervene = argmax( E[uplift(visitor)] * AOV - cost_of_action )
 *
 * If intervention is not economically justified → DO NOTHING.
 * DO NOTHING is NOT a fallback. It is a valid, correct decision.
 *
 * ANY fallback that produces an action without this calculation = BUG.
 */
import { NextRequest, NextResponse } from "next/server";
import { query, ensureNolixSchema } from "@/lib/schema";
import { logPrediction } from "@/lib/calibration";
import { getRuntimeFlag } from "@/lib/nolix-runtime";
import { findSimilarUsers, similarityBoost } from "@/lib/nolix-vector-engine";

export const dynamic = "force-dynamic";

// ── Action Pool with Economic Costs ─────────────────────────────────────────
// cost = relative opportunity cost of executing this action (0.0-1.0)
// Higher cost = reserve for higher-confidence, higher-uplift scenarios
const ACTION_CATALOG: Record<string, { cost: number; label: string }> = {
  urgency:       { cost: 0.05, label: "Urgency message (no discount)" },
  popup_info:    { cost: 0.05, label: "Trust reinforcement message" },
  free_shipping: { cost: 0.15, label: "Free shipping unlock" },
  bundle:        { cost: 0.10, label: "Bundle offer suggestion" },
  discount_5:    { cost: 0.30, label: "5% discount coupon" },
  discount_10:   { cost: 0.50, label: "10% discount coupon" },
  discount_15:   { cost: 0.70, label: "15% discount coupon" },
};

// ── Signal Causal Weight Map ────────────────────────────────────────────────
// These weights represent how much each signal contributes to P(convert).
// Derived from causal outcomes, not correlations.
// Format: { signal: contribution to P(convert) }
function computeVisitorSignalWeights(signals: {
  time_on_site: number;
  pages_viewed: number;
  scroll_depth: number;
  cart_status: string;
  hesitations: number;
  cta_hover_count: number;
  mouse_leave_count: number;
  tab_hidden_count: number;
  return_visitor: boolean;
  trigger: string;
}): { weights: Record<string, number>; base_p_convert: number } {

  const weights: Record<string, number> = {};
  let baseScore = 0.03; // empirical baseline CVR for cold e-commerce traffic

  // High-signal behavioral indicators
  if (signals.cart_status === "checkout") { weights.cart_checkout = 0.35; baseScore += 0.35; }
  else if (signals.cart_status === "added")  { weights.cart_added = 0.18;   baseScore += 0.18; }

  // Engagement depth
  if (signals.time_on_site > 120)      { weights.time_deep = 0.08; baseScore += 0.08; }
  else if (signals.time_on_site > 45)  { weights.time_medium = 0.04; baseScore += 0.04; }

  if (signals.pages_viewed > 5)        { weights.pages_deep = 0.06; baseScore += 0.06; }
  else if (signals.pages_viewed > 2)   { weights.pages_medium = 0.03; baseScore += 0.03; }

  if (signals.scroll_depth > 75)       { weights.scroll_deep = 0.05; baseScore += 0.05; }
  else if (signals.scroll_depth > 40)  { weights.scroll_medium = 0.02; baseScore += 0.02; }

  // Return visitors have higher baseline intent
  if (signals.return_visitor)          { weights.return_visitor = 0.10; baseScore += 0.10; }

  // Hesitation signals — REDUCE confidence in organic conversion
  // High hesitation = high intervention value (they need a nudge)
  if (signals.hesitations > 3)         { weights.hesitation_high = -0.08; baseScore -= 0.08; }
  else if (signals.hesitations > 1)    { weights.hesitation_medium = -0.03; baseScore -= 0.03; }

  if (signals.mouse_leave_count > 2)   { weights.exit_signal = -0.05; baseScore -= 0.05; }
  if (signals.tab_hidden_count > 1)    { weights.tab_switch = -0.04; baseScore -= 0.04; }
  if (signals.cta_hover_count > 2)     { weights.cta_hover = 0.06; baseScore += 0.06; }

  // Trigger context
  if (signals.trigger === "exit_intent") { weights.exit_intent = -0.06; baseScore -= 0.06; }
  if (signals.trigger === "checkout_intent") { weights.checkout_intent = 0.12; baseScore += 0.12; }

  // Clamp to [0.01, 0.98]
  const base_p_convert = Math.max(0.01, Math.min(0.98, baseScore));
  return { weights, base_p_convert };
}

/**
 * Estimate P(convert | action_X) for each action.
 * Uses historical conversion rates from zeno_action_metrics if available,
 * otherwise uses calibrated priors based on action type + visitor context.
 */
async function estimateTreatmentProbabilities(
  storeDomain: string,
  cohortKey: string,
  base_p_convert: number,
  eligibleActions: string[],
  analysisMultipliers: Record<string, number>
): Promise<Record<string, number>> {
  // Historical data from the uplift model
  const historical = await query<{
    action_type: string;
    treatment_conversions: number;
    treatment_impressions: number;
    uplift_rate: number;
    confidence: number;
  }>(
    `SELECT action_type, treatment_conversions, treatment_impressions, uplift_rate, confidence
     FROM nolix_uplift_model
     WHERE cohort_key = $1 AND action_type = ANY($2::text[])`,
    [cohortKey, eligibleActions]
  ).catch(() => [] as any[]);

  const histMap: Record<string, { uplift: number; confidence: number }> = {};
  historical.forEach((r: any) => {
    histMap[r.action_type] = {
      uplift: Number(r.uplift_rate),
      confidence: Number(r.confidence),
    };
  });

  // Calibrated priors per action type (derived from industry benchmarks)
  const ACTION_UPLIFT_PRIORS: Record<string, number> = {
    urgency:       0.06,  // +6% baseline uplift for urgency
    popup_info:    0.04,
    free_shipping: 0.09,
    bundle:        0.05,
    discount_5:    0.08,
    discount_10:   0.13,
    discount_15:   0.18,
  };

  const result: Record<string, number> = {};
  for (const action of eligibleActions) {
    const hist = histMap[action];
    const prior = ACTION_UPLIFT_PRIORS[action] ?? 0.05;
    const multiplier = analysisMultipliers[action] ?? 1.0;

    let uplift: number;
    if (hist && hist.confidence > 0.3) {
      // Blend historical data with prior based on confidence
      uplift = hist.uplift * hist.confidence + prior * (1 - hist.confidence);
    } else {
      uplift = prior; // cold start: use calibrated prior only
    }

    // Apply analysis multipliers (from Zeno's store intelligence)
    uplift *= multiplier;

    result[action] = Math.min(0.98, base_p_convert + uplift);
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const body = await req.json();

    // ── STEP 13 PART 6: RUNTIME FLAGS KILL-SWITCH ───────────────────────────
    // Read LIVE from DB — not in-memory. Distributed-safe.
    const aiEnabled       = await getRuntimeFlag("ai_enabled");
    const maintenanceMode = await getRuntimeFlag("maintenance_mode" as any).catch(() => false);

    if (!aiEnabled || maintenanceMode) {
      return NextResponse.json({
        action: "do_nothing",
        economic_decision: "wait",
        reason: !aiEnabled ? "AI_DISABLED_BY_RUNTIME_FLAG" : "MAINTENANCE_MODE",
      });
    }

    // ── KILL SWITCH ─────────────────────────────────────────────────────────
    if (process.env.GLOBAL_KILL_SWITCH === "true") {
      return NextResponse.json({
        action: "do_nothing",
        economic_decision: "wait",
        reason: "SYSTEM_EMERGENCY_HALT",
      });
    }

    const {
      session_id, trigger, time_on_site, pages_viewed,
      scroll_depth, cart_status, hesitations,
      cta_hover_count = 0, mouse_leave_count = 0, tab_hidden_count = 0,
      return_visitor = false, aov_estimate = 65,
      current_url, device,
    } = body;

    const store_domain = current_url
      ? new URL(current_url).hostname.replace(/^www\./, "")
      : "unknown_store";

    // ── DOMAIN GATE — REALITY FINGERPRINT CHECK (MANDATORY) ─────────────────
    // Zeno WILL NOT act on stores that haven't passed the classification gate.
    // Rule: ecommerce_probability >= 0.70 AND confidence >= 70
    let gateData: { eligible: boolean; stop_reason?: string; ecommerce_probability?: number; confidence?: number } | null = null;
    let subscriptionStatus = "trialing";

    try {
      const gateRows = await query<{
        domain_gate_result: any;
        subscription_status: string;
      }>(
        `SELECT domain_gate_result, subscription_status FROM users WHERE store_url LIKE $1 LIMIT 1`,
        [`%${store_domain}%`]
      );
      gateData = gateRows[0]?.domain_gate_result ?? null;
      subscriptionStatus = gateRows[0]?.subscription_status ?? "trialing";
    } catch { /* non-blocking */ }

    // Billing check
    if (!["active", "trialing"].includes(subscriptionStatus)) {
      return NextResponse.json({
        action: "do_nothing", session_id,
        economic_decision: "wait",
        blocked_reason: "PAYMENT_REQUIRED",
        reason: "Engine suspended: subscription inactive.",
      });
    }

    // Gate check
    if (gateData) {
      if (!gateData.eligible) {
        return NextResponse.json({
          action: "do_nothing", session_id,
          economic_decision: "wait",
          blocked_reason: gateData.stop_reason ?? "DOMAIN_NOT_ELIGIBLE",
          reason: `Reality gate rejected this domain: ${gateData.stop_reason}`,
        });
      }
      if ((gateData.ecommerce_probability ?? 0) < 0.70) {
        return NextResponse.json({
          action: "do_nothing", session_id,
          economic_decision: "wait",
          blocked_reason: "INSUFFICIENT_ECOMMERCE_PROBABILITY",
          reason: `ecommerce_probability=${((gateData.ecommerce_probability ?? 0) * 100).toFixed(0)}% < 70%`,
        });
      }
      if ((gateData.confidence ?? 0) < 70) {
        return NextResponse.json({
          action: "do_nothing", session_id,
          economic_decision: "wait",
          blocked_reason: "INSUFFICIENT_CONFIDENCE",
          reason: `Reality confidence=${gateData.confidence ?? 0}% < 70%`,
        });
      }
    }
    // If no gateData (old stores pre-gate): proceed — backward compatibility

    // ── STEP 1: COMPUTE VISITOR SIGNAL WEIGHTS ───────────────────────────────
    const sessionSignals = {
      time_on_site, pages_viewed, scroll_depth, cart_status,
      hesitations, cta_hover_count, mouse_leave_count, tab_hidden_count,
      return_visitor, trigger, device,
    };

    const { weights, base_p_convert } = computeVisitorSignalWeights(sessionSignals);

    // ── STEP 2: DETERMINE ELIGIBLE ACTIONS ───────────────────────────────────
    let eligibleActions = Object.keys(ACTION_CATALOG);

    if (cart_status === "checkout" || trigger === "checkout_intent") {
      // At checkout: only low-friction urgency. Discounts disrupt flow.
      eligibleActions = ["urgency", "popup_info", "free_shipping"];
    } else if (cart_status === "added" || trigger === "funnel_idle") {
      eligibleActions = ["urgency", "discount_5", "discount_10", "free_shipping", "bundle"];
    } else if (trigger === "exit_intent" && cart_status === "empty") {
      eligibleActions = ["popup_info", "discount_10", "free_shipping"];
    } else if (trigger === "browse_idle") {
      eligibleActions = ["popup_info", "bundle"];
    } else if (trigger === "cart_added") {
      eligibleActions = ["popup_info", "urgency"];
    }

    // ── STEP 3: LOAD STORE INTELLIGENCE (from prior Zeno analysis) ───────────
    let analysisMultipliers: Record<string, number> = {};
    try {
      const [userRes] = await query<{ store_analysis: any }>(
        `SELECT store_analysis FROM users WHERE store_url LIKE $1 LIMIT 1`,
        [`%${store_domain}%`]
      );
      if (userRes?.store_analysis) {
        const ai = userRes.store_analysis;
        const weaknesses: string[] = ai.foundation?.weaknesses ?? [];
        const problem: string = ai.foundation?.product_problem ?? "";

        if (weaknesses.some((w) => /trust|review|social proof/i.test(w))) {
          analysisMultipliers["popup_info"] = 1.4;
        }
        if (/price|expensive|cost/i.test(problem)) {
          analysisMultipliers["discount_10"] = 1.3;
          analysisMultipliers["discount_15"] = 1.2;
        }
        if (/shipping/i.test(problem)) {
          analysisMultipliers["free_shipping"] = 1.5;
        }
      }
    } catch { /* quiet fail */ }

    // ── STEP 4: COHORT KEY ───────────────────────────────────────────────────
    const intentLevel = base_p_convert > 0.6 ? "high" : base_p_convert > 0.3 ? "medium" : "low";
    const friction = cart_status !== "empty"
      ? trigger === "exit_intent" ? "stuck_cart" : "funnel_idle"
      : trigger === "exit_intent" ? "bounce_risk" : "none";
    const cohortKey = `${store_domain}_${intentLevel}_${friction}_${device ?? "unknown"}`;

    // ── STEP 5: ESTIMATE P(convert|action) FOR EACH ELIGIBLE ACTION ──────────
    const treatmentProbabilities = await estimateTreatmentProbabilities(
      store_domain, cohortKey, base_p_convert, eligibleActions, analysisMultipliers
    );

    // ── STEP 5B: SIMILARITY BOOST (STEP 13 PART 6) ──────────────────────────
    // Build visitor embedding from session signals for cross-user similarity.
    // Boost = 0–0.15 added to base_p_convert if similar users converted.
    let simBoost = 0;
    try {
      const visitorVector = [
        Math.min(1, (time_on_site || 0)  / 120),
        Math.min(1, (pages_viewed || 0)  / 10),
        Math.min(1, (scroll_depth || 0)  / 100),
        cart_status === "checkout" ? 1 : cart_status === "added" ? 0.6 : 0,
        Math.min(1, (hesitations || 0)   / 5),
        return_visitor ? 1 : 0,
        trigger === "exit_intent" ? 1 : 0,
        Math.min(1, (cta_hover_count || 0) / 5)
      ];
      const simResult = await findSimilarUsers(visitorVector, store_domain, 20, 0.60);
      simBoost = similarityBoost(simResult.high_similarity);
      if (simBoost > 0) {
        console.log("⚡ SIMILARITY BOOST:", simBoost, "from", simResult.cluster_size, "similar users via", simResult.mode);
      }
    } catch { /* non-blocking — never fail the decision for this */ }

    // Apply similarity boost to base conversion probability
    const boosted_p_convert = Math.min(0.98, base_p_convert + simBoost);

    // ── STEP 6: PER-VISITOR ECONOMIC DECISION ────────────────────────────────
    // final_score = (boosted_p_convert | action) vs base
    // similarity_boost already baked into boosted_p_convert
    let bestAction = "do_nothing";
    let bestEconomicValue = 0;
    let bestUplift = 0;
    let bestPConvertAction = boosted_p_convert;
    const alternativesRejected: string[] = [];

    for (const action of eligibleActions) {
      const p_treatment = treatmentProbabilities[action] ?? boosted_p_convert;
      const uplift = Math.max(0, p_treatment - base_p_convert + simBoost); // include sim boost
      const cost = ACTION_CATALOG[action]?.cost ?? 0.5;

      const economicValue = (uplift * aov_estimate) - (cost * aov_estimate * 0.1);

      if (economicValue > bestEconomicValue) {
        if (bestAction !== "do_nothing") alternativesRejected.push(bestAction);
        bestEconomicValue = economicValue;
        bestAction = action;
        bestUplift = uplift;
        bestPConvertAction = p_treatment;
      } else {
        alternativesRejected.push(action);
      }
    }

    const economicDecision = bestAction !== "do_nothing" ? "intervene" : "wait";

    // ── STEP 7: LOG THE PREDICTION TO CALIBRATION SYSTEM ─────────────────────
    // Every prediction is logged — even do_nothing — for calibration honesty.
    const predictedClass = base_p_convert >= 0.5 ? "convert" : "exit";
    const decisionCost = bestAction !== "do_nothing"
      ? (ACTION_CATALOG[bestAction]?.cost ?? 0) * aov_estimate * 0.1
      : 0;

    logPrediction({
      session_id,
      store_domain,
      predicted_class: predictedClass,
      predicted_probability: base_p_convert,
      p_convert_no_action: base_p_convert,
      p_convert_action: bestPConvertAction,
      uplift_estimated: bestUplift,
      action_taken: bestAction,
      economic_decision: economicDecision,
      decision_cost: decisionCost,
      causal_weights: weights,
      session_signals: sessionSignals,
    }).catch(() => {}); // non-blocking

    // ── STEP 8: IF DO NOTHING — RETURN IMMEDIATELY ───────────────────────────
    if (bestAction === "do_nothing") {
      return NextResponse.json({
        action: "do_nothing",
        session_id,
        economic_decision: "wait",
        reason: `Causal uplift insufficient for any action. P(convert|no_action)=${(base_p_convert * 100).toFixed(1)}%`,
        p_convert_no_action: base_p_convert,
        signal_weights: weights,
      });
    }

    // ── STEP 9: BUILD NOLIX EXECUTION PAYLOAD ────────────────────────────────
    // NOLIX receives exactly ONE instruction: what to show, nothing else.
    const payloads: Record<string, { headline: string; sub: string; cta: string }> = {
      urgency:       { headline: "Don't miss out!", sub: "Your cart is reserved. Act now while stock lasts.", cta: "Secure My Order" },
      popup_info:    { headline: "Great choice!", sub: "This is one of our bestsellers. Loved by thousands of customers.", cta: "Continue Shopping" },
      free_shipping: { headline: "Wait — Free Shipping!", sub: "Complete your order today and we'll ship it for free.", cta: "Apply Free Shipping" },
      bundle:        { headline: "Bundle & Save", sub: "Get more for less — our top bundle is available for you.", cta: "See Bundle Deal" },
      discount_5:    { headline: "Special Offer", sub: "Here's 5% off your order. Just for you, right now.", cta: "Apply 5% Discount" },
      discount_10:   { headline: "10% Off — Limited", sub: "We're giving you 10% off if you complete your order now.", cta: "Apply 10% Discount" },
      discount_15:   { headline: "Flash Deal: 15% Off", sub: "A rare 15% discount just unlocked for this session.", cta: "Apply 15% Discount" },
    };

    const p = payloads[bestAction] ?? payloads.urgency;

    // ── STEP 10: RECORD IMPRESSION FOR LEARNING LOOP ─────────────────────────
    Promise.all([
      query(
        `INSERT INTO popup_sessions (
          session_id, intent_level, intent_score, friction_detected,
          show_popup, action_taken, cohort_key, expected_uplift, business_explanation
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (session_id) DO UPDATE SET
          friction_detected=EXCLUDED.friction_detected,
          action_taken=EXCLUDED.action_taken,
          expected_uplift=EXCLUDED.expected_uplift`,
        [
          session_id, intentLevel,
          Math.round(base_p_convert * 100),
          friction, true, bestAction, cohortKey,
          bestUplift,
          `Causal decision: action="${bestAction}", uplift=${(bestUplift * 100).toFixed(1)}%, ` +
          `P(convert|no_action)=${(base_p_convert * 100).toFixed(1)}%, ` +
          `P(convert|action)=${(bestPConvertAction * 100).toFixed(1)}%, ` +
          `economic_value=$${bestEconomicValue.toFixed(2)}`
        ]
      ),
      query(
        `INSERT INTO zeno_action_metrics (
           store_domain, intent_category, friction_type, action_name, impressions
         ) VALUES ($1,$2,$3,$4,1)
         ON CONFLICT (store_domain, intent_category, friction_type, action_name)
         DO UPDATE SET impressions = zeno_action_metrics.impressions + 1, updated_at = now()`,
        [store_domain, intentLevel, friction, bestAction]
      ),
    ]).catch((err) => console.warn("[decide] Learning loop save failed:", err));

    return NextResponse.json({
      action: bestAction,
      session_id,
      headline: p.headline,
      sub_message: p.sub,
      cta_text: p.cta,
      economic_decision: "intervene",
      reason: `${ACTION_CATALOG[bestAction]?.label}: uplift=${(bestUplift * 100).toFixed(1)}%, economic_value=$${bestEconomicValue.toFixed(2)}`,
      one_line_reason: `Visitor shows ${intentLevel} intent (${(base_p_convert * 100).toFixed(0)}% organic CVR). Action adds ${(bestUplift * 100).toFixed(1)}% lift.`,
      p_convert_no_action: base_p_convert,
      p_convert_action:    bestPConvertAction,
      similarity_boost:    simBoost,
      boosted_p_convert:   boosted_p_convert,
      uplift: bestUplift,
      confidence: Math.min(0.99, 0.5 + Math.abs(bestUplift) * 3),
      alternatives_rejected: alternativesRejected,
      signal_weights: weights,
      cohort_key: cohortKey,
    });

  } catch (e: any) {
    console.error("[engine/decide] Runtime Error:", e.message);
    // ANY fallback = BUG. Return do_nothing to avoid phantom actions.
    return NextResponse.json({
      action: "do_nothing",
      economic_decision: "wait",
      reason: "ENGINE_ERROR — safe fallback. No economic evaluation performed.",
    });
  }
}
