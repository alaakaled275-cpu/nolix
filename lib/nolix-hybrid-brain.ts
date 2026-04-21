/**
 * NOLIX — Hybrid Decision Brain (Core Orchestrator)
 * lib/nolix-hybrid-brain.ts
 *
 * ⚔️ THIS IS THE ARCHITECTURAL TRUTH OF NOLIX:
 *
 * ZENO = Commander (Behavioral Rules + Context)
 * ML   = Intelligence Advisor (Signal Enhancer)
 *
 * Decision Formula:
 * ─────────────────
 * Step 1: Behavior Assessment (ALWAYS runs, no ML needed)
 *         → intent, friction, eligibility
 *
 * Step 2: Context Logic (ALWAYS runs, narrows action space)
 *         → eligible actions with base priorities
 *
 * Step 3: ML Signal Enhancement (runs IF eligible AND ml_enabled)
 *         → boosts/penalizes candidate actions
 *         → ML can ENHANCE but never OVERRIDE behavior gate
 *
 * Step 4: Economic Decision (ALWAYS final authority)
 *         → E[uplift] * AOV > cost → intervene
 *         → otherwise → do_nothing (valid decision)
 *
 * THE LAW:
 *   ✅ ML can boost a LOW action to HIGH (if confidence is sufficient)
 *   ✅ ML can reduce priority of a HIGH action (if confidence is low)
 *   ❌ ML CANNOT intervene when behavior gate = BLOCKED
 *   ❌ ML CANNOT intervene when intent = NONE or LOW
 *   ❌ ML score alone NEVER triggers any action
 *
 * Example:
 *   BAD:  if (ml_score > 0.7) show_popup()
 *   GOOD: if (intent == HIGH && friction == PRICE && ml_boost > 0.1) show_discount()
 */

import { NolixSignalV1 }               from "./nolix-signal-schema";
import { assessBehavior, BehavioralAssessment } from "./nolix-behavioral-rules";
import { applyContextLogic, TriggerType, VisitorSegmentLabel, ActionCandidate, ContextDecision } from "./nolix-context-logic";
import { hybridPredict }               from "./nolix-hybrid-engine";
import { findSimilarUsers }            from "./nolix-vector-engine";
import { signalToFeatureVector }       from "./nolix-signal-normalizer";
import { getRuntimeFlag }              from "./nolix-runtime";
import { logPrediction }               from "./calibration";
import { assignVariant, applyVariantOverrides, VariantConfig } from "./nolix-experiment-engine";
import { getUserIdentity, applyStrategy, updateIdentity } from "./nolix-identity-engine";
import { computeOptimalDiscount, logPricingDecision } from "./nolix-pricing-engine";
import { logAttributionEvent } from "./nolix-attribution-engine";
import { emitEvent } from "./nolix-event-logger";
import { createTraceContext } from "./nolix-trace-context";

// ── Types ─────────────────────────────────────────────────────────────────────
export type BrainAction =
  | "show_popup"
  | "block"
  | "do_nothing"
  | "observe";

export interface BrainInput {
  // Core signal
  signal:             NolixSignalV1;

  // Context
  trigger:            TriggerType;
  segment:            VisitorSegmentLabel;
  aov_estimate:       number;
  visit_count:        number;
  coupon_abuse?:      number;
  return_visitor?:    boolean;
  hesitations?:       number;
  mouse_leave_count?: number;
  tab_hidden_count?:  number;
  store_type?:        "fashion" | "electronics" | "food" | "general";
}

export interface BrainDecision {
  // Final output
  action:             BrainAction;
  recommended_popup:  string | null;   // which popup/offer to show
  discount_pct:       number;          // 0, 5, 10, or 15

  // Reasoning chain (complete audit trail)
  behavior:           BehavioralAssessment;
  context:            ContextDecision;
  ml_boost:           number;          // how much ML moved the final score
  ml_used:            boolean;         // was ML consulted?
  final_score:        number;          // composite 0–1

  // Economic justification
  economic_justified: boolean;
  expected_uplift:    number;          // E[uplift] * AOV
  action_cost:        number;

  // Meta
  trace_id:           string;
  latency_ms:         number;
  decision_path:      string[];        // step-by-step audit
  decision_source?:   "rules" | "ml" | "experiment" | "personalization";
  ml_training_allowed?: boolean;
}

// ── Economic cost of each action ─────────────────────────────────────────────
const ACTION_COSTS: Record<string, number> = {
  urgency:       0.05,
  popup_info:    0.05,
  free_shipping: 0.15,
  bundle:        0.10,
  discount_5:    0.30,
  discount_10:   0.50,
  discount_15:   0.70,
  do_nothing:    0.00
};

const ACTION_DISCOUNT: Record<string, number> = {
  discount_15: 15, discount_10: 10, discount_5: 5,
  free_shipping: 0, bundle: 0, urgency: 0, popup_info: 0, do_nothing: 0
};

// ── Similarity boost from vector search ───────────────────────────────────────
const SIMILARITY_WEIGHT = 0.15;   // max 15% boost from similar users
const ML_WEIGHT         = 0.35;   // ML contributes max 35% to final boost
const MIN_ECONOMIC_RATIO = 1.20;  // expected return must be > 1.2x cost

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: HYBRID DECISION BRAIN
// ═══════════════════════════════════════════════════════════════════════════════
export async function runHybridBrain(input: BrainInput): Promise<BrainDecision> {
  const traceCtx    = createTraceContext({ visitor_id: input.signal.visitor_id, source: "decide" });
  const traceId     = traceCtx.trace_id;
  const start       = Date.now();
  const decisionPath: string[] = [];

  // ── STEP 1: BEHAVIORAL ASSESSMENT (Primary — always runs) ─────────────────
  decisionPath.push("STEP_1: Behavioral Assessment");

  const behavior = assessBehavior(input.signal, {
    hesitations:       input.hesitations,
    return_visitor:    input.return_visitor,
    mouse_leave_count: input.mouse_leave_count,
    tab_hidden_count:  input.tab_hidden_count,
    trigger:           input.trigger,
    coupon_abuse:      input.coupon_abuse,
    visit_count:       input.visit_count
  });

  decisionPath.push(`  → intent=${behavior.intent} friction=${behavior.friction} eligible=${behavior.eligible_for_intervention}`);

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: traceId,
    type: "BEHAVIOR_ANALYZED",
    level: "INFO",
    timestamp: Date.now(),
    payload: { intent: behavior.intent, friction: behavior.friction, score: behavior.intent_score, rules_fired: behavior.rules_fired }
  });

  // ── HARD BLOCK from behavior (no ML appeal) ───────────────────────────────
  if (!behavior.eligible_for_intervention) {
    const action: BrainAction = (behavior.ineligible_reason === "COUPON_ABUSE_BLOCKED" || behavior.ineligible_reason === "BOT_SUSPECT") ? "block" : "do_nothing";
    decisionPath.push(`  → HARD_BLOCK: ${behavior.ineligible_reason} → ${action}`);

    const decision: BrainDecision = {
      action, recommended_popup: null, discount_pct: 0,
      behavior, context: { eligible_actions: [], context_modifiers: {}, should_observe: true, observe_reason: behavior.ineligible_reason },
      ml_boost: 0, ml_used: false, final_score: 0,
      economic_justified: false, expected_uplift: 0, action_cost: 0,
      trace_id: traceId, latency_ms: Date.now() - start, decision_path: decisionPath
    };

    await _logDecision(traceId, input.signal.visitor_id, "BRAIN_DECIDE", input.signal, decision, `HARD_BLOCK: ${behavior.ineligible_reason}`, Date.now() - start);
    return decision;
  }

  // ── STEP 2: CONTEXT LOGIC (Layer 2 — narrows action space) ───────────────
  decisionPath.push("STEP_2: Context Logic");

  const contextDecision = applyContextLogic(behavior, {
    trigger:           input.trigger,
    segment:           input.segment,
    aov_estimate:      input.aov_estimate,
    visit_count:       input.visit_count,
    store_type:        input.store_type,
    hour_of_day:       new Date().getHours(),
  });

  decisionPath.push(`  → eligible_actions=${contextDecision.eligible_actions.map(a=>a.action).join(",") || "NONE"} observe=${contextDecision.should_observe}`);

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: traceId,
    type: "CONTEXT_APPLIED",
    level: "INFO",
    timestamp: Date.now(),
    payload: { eligible_actions: contextDecision.eligible_actions.map(a=>a.action), modifiers: contextDecision.context_modifiers }
  });

  // ── If context says observe (no viable actions) ────────────────────────────
  if (contextDecision.should_observe || contextDecision.eligible_actions.length === 0) {
    decisionPath.push(`  → CONTEXT_GATE: ${contextDecision.observe_reason || "no_eligible_actions"} → do_nothing`);
    const decision: BrainDecision = {
      action: "do_nothing", recommended_popup: null, discount_pct: 0,
      behavior, context: contextDecision,
      ml_boost: 0, ml_used: false, final_score: behavior.intent_score,
      economic_justified: false, expected_uplift: 0, action_cost: 0,
      trace_id: traceId, latency_ms: Date.now() - start, decision_path: decisionPath
    };
    await _logDecision(traceId, input.signal.visitor_id, "BRAIN_DECIDE", input.signal, decision, `CONTEXT_GATE: ${contextDecision.observe_reason}`, Date.now() - start);
    return decision;
  }

  // ── STEP 3: ML SIGNAL ENHANCEMENT (Secondary — enhances, never controls) ──
  decisionPath.push("STEP_3: ML Signal Enhancement");

  let mlBoost        = 0;
  let mlUsed         = false;
  let similarityBoost = 0;

  const mlEnabled = await getRuntimeFlag("ai_enabled").catch(() => true);

  if (mlEnabled) {
    // Build feature map for ML (using the canonified signal)
    const featureMap = {
      time_on_site:    input.signal.time_on_page,
      pages_viewed:    input.signal.page_views,
      scroll_depth:    input.signal.scroll_depth * 100,
      cart_status:     input.signal.checkout_started ? "checkout" : "viewing",
      hesitations:     input.hesitations || 0,
      return_visitor:  input.return_visitor || false,
      exit_intent:     (input.mouse_leave_count || 0) > 2,
      cta_hover_count: input.signal.clicks
    };

    // ML prediction
    try {
      const mlResult = await hybridPredict(featureMap, {
        visitor_id: input.signal.visitor_id,
        store:      input.signal.store_domain,
        aov_estimate: input.aov_estimate
      });
      // ML boost = deviation from neutral (0.35 baseline)
      mlBoost = (mlResult.final_score - 0.35) * ML_WEIGHT;
      mlUsed  = true;
      decisionPath.push(`  → ML: p_convert=${mlResult.final_score.toFixed(3)} boost=${mlBoost.toFixed(3)}`);
    } catch(e) {
      decisionPath.push(`  → ML: FAILED (${e}) — continuing without`);
    }

    // Similarity boost from vector search
    try {
      const vector = signalToFeatureVector(input.signal);
      const simResult = await findSimilarUsers(vector, input.signal.store_domain, 10, 0.65);
      similarityBoost = (simResult.boost || 0) * SIMILARITY_WEIGHT;
      decisionPath.push(`  → Similarity: boost=${similarityBoost.toFixed(3)}`);
    } catch {
      decisionPath.push(`  → Similarity: FAILED — skipped`);
    }
  } else {
    decisionPath.push(`  → ML DISABLED (ai_enabled=false) — behavioral-only mode`);
  }

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: traceId,
    type: "ML_EVALUATED",
    level: "INFO",
    timestamp: Date.now(),
    payload: { ml_boost: mlBoost, similarity_boost: similarityBoost, used: mlUsed }
  });

  // ── STEP 4: SELECT BEST ACTION with ML Enhancement ─────────────────────────
  decisionPath.push("STEP_4: Action Selection + Economic Gate");

  // Compute enhanced score per candidate
  const enhancedCandidates = contextDecision.eligible_actions.map(candidate => {
    let enhancedPriority = candidate.base_priority;

    // Apply ML boost ONLY if action allows ML influence
    // ML boost is additive, capped at +0.20
    const totalBoost = Math.min(0.20, mlBoost + similarityBoost);
    enhancedPriority += totalBoost;

    // If requires_ml_confirm AND ml_boost is negative or zero → penalize
    if (candidate.requires_ml_confirm && mlBoost <= 0) {
      enhancedPriority *= 0.60;  // 40% penalty without ML confirmation
      decisionPath.push(`  → [${candidate.action}] requires_ml_confirm=true but ML boost=${mlBoost.toFixed(3)} → priority reduced`);
    }

    return { ...candidate, enhanced_priority: Math.min(0.98, Math.max(0, enhancedPriority)) };
  }).sort((a, b) => b.enhanced_priority - a.enhanced_priority);

  // ── ECONOMIC GATE: E[uplift] * AOV > action_cost ──────────────────────────
  let selectedAction:  ActionCandidate | null = null;
  let finalScore       = behavior.intent_score;
  let economicJustified = false;

  for (const candidate of enhancedCandidates) {
    const cost    = ACTION_COSTS[candidate.action] || 0.10;
    const uplift  = (candidate.enhanced_priority - behavior.intent_score); // incremental lift
    const revenue = uplift * input.aov_estimate;

    decisionPath.push(`  → [${candidate.action}] priority=${candidate.enhanced_priority.toFixed(3)} uplift=${uplift.toFixed(3)} revenue=$${revenue.toFixed(2)} cost=${(cost*input.aov_estimate).toFixed(2)}`);

    if (revenue > cost * input.aov_estimate * MIN_ECONOMIC_RATIO) {
      selectedAction   = candidate;
      finalScore       = candidate.enhanced_priority;
      economicJustified = true;
      decisionPath.push(`  → ECONOMIC_JUSTIFIED: ${candidate.action} selected`);
      break;
    }
  }

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: traceId,
    type: "ECONOMIC_VALIDATED",
    level: "INFO",
    timestamp: Date.now(),
    payload: { justified: economicJustified, final_score: finalScore, selected_action: selectedAction?.action || null }
  });

  // ── FINAL DECISION ────────────────────────────────────────────────────────
  let finalAction:     BrainAction = "do_nothing";
  let finalPopup:      string | null = null;
  let finalDiscount = 0;
  let actionCost  = 0;
  let finalUplift = 0;

  if (selectedAction && economicJustified) {
    finalAction     = "show_popup";
    finalPopup  = selectedAction.action;
    finalDiscount = ACTION_DISCOUNT[selectedAction.action] || 0;
    actionCost  = ACTION_COSTS[selectedAction.action] || 0;
    finalUplift = ((selectedAction.enhanced_priority ?? selectedAction.base_priority) - behavior.intent_score) * input.aov_estimate;
    decisionPath.push(`  → FINAL: show_popup type=${finalPopup} discount=${finalDiscount}%`);
  } else {
    decisionPath.push(`  → FINAL: do_nothing (no economically justified action)`);
  }

  // ── COMMAND 08 STEP 3: PERSONALIZATION LAYER ────────────────────────────
  let finalDecisionSource = mlBoost > 0 ? "ml" : "rules";
  let finalMlTrainingAllowed = true;
  let identity: any = null;

  try {
     identity = await getUserIdentity(input.signal.visitor_id);
     if (identity) {
        const stratResult = applyStrategy({ action: finalAction, discount_pct: finalDiscount, recommended_popup: finalPopup }, identity.strategy);
        finalAction = stratResult.decision.action;
        finalDiscount = stratResult.decision.discount_pct;
        finalPopup = stratResult.decision.recommended_popup;
        if (stratResult.strategy_applied) {
           decisionPath.push(`[IDENTITY OVERRIDE] Strategy Applied: ${stratResult.strategy}`);
           finalDecisionSource = "personalization";
        }
     }
  } catch (err) {
     console.error("Identity Engine failed:", err);
  }

  // ── COMMAND 07 STEP 3: EXPERIMENT ENGINE OVERRIDE ───────────────────────────
  try {
     const { assignVariant, applyVariantOverrides } = await import("./nolix-experiment-engine");
     const variant = await assignVariant(input.signal.visitor_id, "global_discount_test");
     if (variant) {
        const testDecision = applyVariantOverrides(
          { action: finalAction, discount_pct: finalDiscount, recommended_popup: finalPopup }, 
          variant.config
        );
        finalAction = testDecision.action;
        finalDiscount = testDecision.discount_pct;
        finalPopup = testDecision.recommended_popup;
        decisionPath.push(`[EXPERIMENT OVERRIDE] Assigned Variant: ${variant.name}`);
        finalDecisionSource = "experiment";
        finalMlTrainingAllowed = false; // COMMAND X - ML POLLUTION SHIELD
     }
  } catch (err) {
     console.error("Experiment Engine execution failed:", err);
  }

  // ── COMMAND 09 STEP 6: PRICING ENGINE (ROI-DRIVEN) ────────────────────────
  let finalBasePrice = input.aov_estimate || 50; 
  let pricingExpectedRevenue = 0;
  
  if (finalAction !== "do_nothing" && finalDecisionSource !== "experiment") {
    try {
      const hesitations = input.hesitations || 0;
      const visit_count = input.visit_count || 1;
      const pSensitivity = identity ? identity.price_sensitivity : (hesitations / visit_count);
      const pricing = computeOptimalDiscount({
         base_price: finalBasePrice,
         conversion_prob: behavior.intent_score,
         sensitivity: pSensitivity
      });

      finalDiscount = pricing.discount;
      pricingExpectedRevenue = pricing.expected_revenue;
      decisionPath.push(`[PRICING ENGINE] Computed Optimal Discount: ${pricing.discount}% (ExpRev: $${pricing.expected_revenue.toFixed(2)})`);
      
      // COMMAND 09 STEP 7: ECONOMIC GATE (نسخة أقوى)
      if (pricing.expected_revenue < finalBasePrice * 0.9 && finalAction === "show_popup") {
         finalAction = "do_nothing";
         finalDiscount = 0;
         finalPopup = null;
         decisionPath.push(`[ECONOMIC GATE] Rejected: Exp Revenue ($${pricing.expected_revenue.toFixed(2)}) is below 90% of base price.`);
      }

      // Log the pricing framework decision asynchronously
      logPricingDecision(
        traceId, input.signal.visitor_id, finalBasePrice, finalDiscount, 
        finalBasePrice * (1 - finalDiscount/100), pricing.prob, 
        0, pricing.expected_revenue, finalDecisionSource
      ).catch(console.error);

    } catch (err) {
      console.error("Pricing Engine failed:", err);
    }
  }

  // ── COMMAND X PART 2: TRUE ATTRIBUTION TRIGGER ─────────────────────────────
  logAttributionEvent(input.signal.visitor_id, traceId, finalAction).catch(console.error);
  updateIdentity(input.signal.visitor_id, input.signal, { action: finalAction } as any).catch(console.error);

  const totalLatency = Date.now() - start;
  mlUsed = mlBoost > 0;

  const decision: BrainDecision = {
    action:             finalAction,
    recommended_popup:  finalPopup,
    discount_pct:       finalDiscount,
    behavior,
    context:            contextDecision,
    ml_boost:           Math.round(mlBoost * 10000) / 10000,
    ml_used:            mlUsed,
    final_score:        Math.round(finalScore * 10000) / 10000,
    economic_justified: economicJustified,
    expected_uplift:    Math.round(finalUplift * 100) / 100,
    action_cost:        actionCost,
    trace_id:           traceId,
    latency_ms:         totalLatency,
    decision_path:      decisionPath,
    decision_source:    finalDecisionSource as any,
    ml_training_allowed: finalMlTrainingAllowed
  };

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: traceId,
    type: "DECISION_MADE",
    level: "INFO",
    timestamp: Date.now(),
    payload: { action: finalAction, popup_type: finalPopup, discount: finalDiscount, final_score: finalScore }
  });

  const reasoning = `intent=${behavior.intent} friction=${behavior.friction} action=${finalAction} popup=${finalPopup} ml_boost=${mlBoost.toFixed(3)} final=${finalScore.toFixed(3)}`;
  await _logDecision(traceId, input.signal.visitor_id, "BRAIN_DECIDE", input.signal, decision, reasoning, totalLatency);

  // Log to calibration (for accuracy tracking)
  logPrediction({
    session_id: input.signal.visitor_id,
    store_domain: input.signal.store_domain,
    predicted_class: finalAction === "show_popup" ? "convert" : "exit",
    predicted_probability: finalScore,
    p_convert_no_action: behavior.intent_score,
    p_convert_action: finalScore,
    uplift_estimated: mlBoost + similarityBoost,
    action_taken: finalPopup || "do_nothing",
    economic_decision: economicJustified ? "intervene" : "wait",
    decision_cost: actionCost,
    causal_weights: behavior.weights_applied,
    session_signals: input.signal as any
  }).catch(() => {});

  return decision;
}

// ── Helper: log to decision trace ─────────────────────────────────────────────
async function _logDecision(traceId: string, visitorId: string, command: string, input: any, output: any, reasoning: string, latencyMs: number) {
  try {
    const { logDecision } = await import("./nolix-decision-trace");
    await logDecision({ trace_id: traceId, visitor_id: visitorId, command, input, output, reasoning, latency_ms: latencyMs });
  } catch {}
}

// ── Explain decision (human-readable) ─────────────────────────────────────────
export function explainDecision(d: BrainDecision): string {
  const lines: string[] = [
    `⚔️ ZENO HYBRID BRAIN DECISION`,
    `────────────────────────────────`,
    `Intent:    ${d.behavior.intent} (score=${d.behavior.intent_score})`,
    `Friction:  ${d.behavior.friction}`,
    `Engagement: ${d.behavior.engagement_depth}`,
    `Exit Risk: ${d.behavior.is_exit_risk}`,
    `ML Used:   ${d.ml_used} (boost=${d.ml_boost})`,
    `────────────────────────────────`,
    `Action:    ${d.action.toUpperCase()}`,
    d.recommended_popup ? `Popup:     ${d.recommended_popup} (${d.discount_pct}% discount)` : `Popup:     none`,
    `Economic:  ${d.economic_justified ? "JUSTIFIED" : "NOT_JUSTIFIED"} (uplift=$${d.expected_uplift})`,
    `────────────────────────────────`,
    `Rules Fired:`,
    ...d.behavior.rules_fired.map(r => `  • ${r}`),
    `Decision Path:`,
    ...d.decision_path.map(p => `  ${p}`)
  ];
  return lines.join("\n");
}
