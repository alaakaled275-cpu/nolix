/**
 * lib/decision-explainer.ts
 * ─────────────────────────────────────────────────────────────────
 * DECISION EXPLAINABILITY LAYER
 *
 * "أنت الآن لا تحتاج نظام أذكى… بل تحتاج نظام يشرح نفسه ويبرر قراراته رياضيًا"
 *
 * This module produces a DecisionTrace for EVERY decision made by the system.
 * The trace answers:
 *   - Which signals drove the decision? (with numerical contribution weights)
 *   - Why was THIS action chosen over alternatives? (with counterfactual comparison)
 *   - What is the causal revenue attribution? (not just "converted", but incremental revenue)
 *   - What could make this decision wrong? (risk factors)
 *
 * This is NOT narrative generation. This is mathematical audit of the decision.
 * ─────────────────────────────────────────────────────────────────
 */

import { query } from "./db";
import { SessionSignals, CausalDecision, UpliftRecord, ALL_ACTIONS, type ActionType } from "./causal-engine";

// ── Signal Contribution Weight ───────────────────────────────────────────────
// Explains numerically HOW MUCH each raw signal pushed the decision.
// This is the "why this session" layer.
export interface SignalContribution {
  signal: string;
  value: string | number;
  weight: number;          // 0–100: how much this signal influenced the outcome
  direction: "toward_action" | "against_action" | "neutral";
  explanation: string;
}

// ── Alternative Action Comparison ───────────────────────────────────────────
// For each action NOT chosen, explain why it lost.
export interface AlternativeConsideration {
  action: ActionType;
  estimated_uplift: number;
  confidence: number;
  stability_score: number;
  rejection_reason: string;  // "low_confidence" | "negative_uplift" | "inferior_score"
}

// ── Causal Revenue Attribution ───────────────────────────────────────────────
// The financial proof of causality. Not "who converted" but "what we caused."
export interface CausalRevenueAttribution {
  treatment_cvr: number;            // CVR with action
  control_cvr: number;              // CVR without action (counterfactual)
  incremental_cvr: number;          // treatment_cvr - control_cvr (causal effect)
  incremental_cvr_pct: string;      // formatted
  estimated_aov: number;            // Average Order Value for this cohort
  causal_revenue_per_100: number;   // incremental revenue per 100 visitors
  counterfactual_revenue_loss: number; // what we would have lost without acting
  confidence_interval: string;      // e.g. "±3.2% at 85% confidence"
  attribution_validity: "high" | "medium" | "low" | "insufficient_data";
}

// ── Risk Factors ─────────────────────────────────────────────────────────────
// What assumptions could be wrong? What would invalidate this decision?
export interface RiskFactor {
  type: "temporal_bias" | "selection_bias" | "small_sample" | "cohort_drift" | "model_assumption";
  severity: "low" | "medium" | "high";
  description: string;
  mitigation: string;
}

// ── Full Decision Trace ───────────────────────────────────────────────────────
export interface DecisionTrace {
  session_id: string;
  timestamp: string;
  // Core decision
  decision: CausalDecision;
  // Signal analysis
  signal_contributions: SignalContribution[];
  dominant_signal: string;
  // Action comparison
  alternatives_considered: AlternativeConsideration[];
  action_selection_score_formula: string;  // The actual math formula used
  // Revenue attribution
  revenue_attribution: CausalRevenueAttribution;
  // Risk assessment
  risk_factors: RiskFactor[];
  overall_risk: "low" | "medium" | "high";
  // Summary for humans
  one_line_reason: string;
}

// ── Signal Contribution Calculator ──────────────────────────────────────────
function explainSignals(signals: SessionSignals, decision: CausalDecision): SignalContribution[] {
  const contributions: SignalContribution[] = [];
  const isActing = decision.action !== "do_nothing";

  // Intent Level
  const intentWeight = signals.intent_level === "high" ? 85
    : signals.intent_level === "medium" ? 50 : 15;
  contributions.push({
    signal: "intent_level",
    value: signals.intent_level,
    weight: intentWeight,
    direction: signals.intent_level === "low" ? "against_action" : "toward_action",
    explanation: signals.intent_level === "high"
      ? "High intent detected — strong purchase signal. Urgency preferred over incentives."
      : signals.intent_level === "medium"
      ? "Medium intent — visitor is evaluating. Intervention may tip the decision."
      : "Low intent — visitor is browsing. Intervention unlikely to help.",
  });

  // Friction Type
  const frictionWeight = signals.friction === "stuck_cart" ? 90
    : signals.friction === "hesitant" ? 65
    : signals.friction === "bounce_risk" ? 5 : 30;
  contributions.push({
    signal: "friction",
    value: signals.friction,
    weight: frictionWeight,
    direction: signals.friction === "bounce_risk" ? "against_action" : "toward_action",
    explanation: signals.friction === "stuck_cart"
      ? "Cart abandoned: visitor added items but didn't checkout. Recovery action justified."
      : signals.friction === "hesitant"
      ? "Hesitation detected: browsed multiple pages but cart empty. Value demonstration may help."
      : signals.friction === "bounce_risk"
      ? "Bounce risk: too early to interrupt. Any action would increase friction, not reduce it."
      : "No friction — visitor progressing normally.",
  });

  // Return Visitor
  if (signals.return_visitor !== undefined) {
    contributions.push({
      signal: "return_visitor",
      value: signals.return_visitor ? "yes" : "no",
      weight: signals.return_visitor ? 70 : 30,
      direction: signals.return_visitor ? "toward_action" : "neutral",
      explanation: signals.return_visitor
        ? "Return visitor: already knows the brand. Higher intent baseline. Familiarity increases conversion probability."
        : "First-time visitor: unknown intent baseline. Caution on aggressive offers.",
    });
  }

  // Scroll Depth
  if (signals.scroll_depth_pct !== undefined) {
    const scrollWeight = signals.scroll_depth_pct >= 70 ? 75
      : signals.scroll_depth_pct >= 40 ? 50 : 20;
    contributions.push({
      signal: "scroll_depth",
      value: `${signals.scroll_depth_pct}%`,
      weight: scrollWeight,
      direction: signals.scroll_depth_pct >= 40 ? "toward_action" : "neutral",
      explanation: signals.scroll_depth_pct >= 70
        ? "Deep scroll: visitor engaged with most of the page content. Strong interest signal."
        : signals.scroll_depth_pct >= 40
        ? "Moderate scroll: partial engagement. Visitor is evaluating."
        : "Shallow scroll: minimal engagement. Visitor may not be ready.",
    });
  }

  // Price Bucket
  if (signals.price_bucket) {
    contributions.push({
      signal: "price_bucket",
      value: signals.price_bucket,
      weight: signals.price_bucket === "high" ? 80 : signals.price_bucket === "mid" ? 50 : 35,
      direction: signals.price_bucket === "high" ? "toward_action" : "neutral",
      explanation: signals.price_bucket === "high"
        ? "High-price item: discount hesitation is more common. Recovery action has higher absolute value."
        : signals.price_bucket === "mid"
        ? "Mid-price item: standard conversion patterns apply."
        : "Low-price item: discount offers may erode margin unnecessarily.",
    });
  }

  // Causal Model Override
  contributions.push({
    signal: "causal_model",
    value: decision.decision_mode,
    weight: decision.uplift_confidence * 100,
    direction: decision.expected_uplift > 0 ? "toward_action" : "neutral",
    explanation: decision.decision_mode === "causal"
      ? `Causal model active: ${decision.reasoning}`
      : decision.decision_mode === "exploration"
      ? "Exploration mode: gathering new causal data for this cohort."
      : decision.decision_mode === "drift_reset"
      ? "Drift detected: cohort behavior has shifted. Re-establishing baseline."
      : "Cold-start: using rule heuristics while causal model accumulates data.",
  });

  return contributions.sort((a, b) => b.weight - a.weight);
}

// ── Alternative Actions Comparison ───────────────────────────────────────────
async function explainAlternatives(
  cohortKey: string,
  decision: CausalDecision,
  cohortData: UpliftRecord[]
): Promise<AlternativeConsideration[]> {
  const alternatives: AlternativeConsideration[] = [];

  for (const action of ALL_ACTIONS) {
    if (action === decision.action) continue; // Skip chosen action

    const record = cohortData.find(r => r.action_type === action);
    if (!record) {
      alternatives.push({
        action,
        estimated_uplift: 0,
        confidence: 0,
        stability_score: 0,
        rejection_reason: "no_data_for_this_cohort",
      });
      continue;
    }

    const tCvr = record.treatment_impressions > 0
      ? record.treatment_conversions / record.treatment_impressions : 0;
    const cCvr = record.control_impressions > 0
      ? record.control_conversions / record.control_impressions : 0;
    const uplift = tCvr - cCvr;

    let rejection: string;
    if (record.confidence < 0.55) {
      rejection = `insufficient_confidence (${(record.confidence * 100).toFixed(0)}% < 55%)`;
    } else if (uplift <= 0) {
      rejection = `negative_uplift (${(uplift * 100).toFixed(1)}%)`;
    } else if (uplift < decision.expected_uplift) {
      rejection = `inferior_uplift (+${(uplift * 100).toFixed(1)}% vs chosen +${(decision.expected_uplift * 100).toFixed(1)}%)`;
    } else {
      rejection = `lower_stability (${(record.stability_score * 100).toFixed(0)}% vs chosen ${(decision.stability_score * 100).toFixed(0)}%)`;
    }

    alternatives.push({
      action,
      estimated_uplift: uplift,
      confidence: record.confidence,
      stability_score: record.stability_score ?? 0,
      rejection_reason: rejection,
    });
  }

  return alternatives.sort((a, b) => b.estimated_uplift - a.estimated_uplift).slice(0, 4);
}

// ── Revenue Attribution Calculator ──────────────────────────────────────────
function calculateRevenueAttribution(
  cohortData: UpliftRecord[],
  actionType: string,
  estimatedAov: number = 65 // default AOV if unknown
): CausalRevenueAttribution {
  const record = cohortData.find(r => r.action_type === actionType);

  if (!record || record.treatment_impressions < 10 || record.control_impressions < 5) {
    return {
      treatment_cvr: 0,
      control_cvr: 0,
      incremental_cvr: 0,
      incremental_cvr_pct: "INSUFFICIENT_DATA",
      estimated_aov: estimatedAov,
      causal_revenue_per_100: 0,
      counterfactual_revenue_loss: 0,
      confidence_interval: "N/A",
      attribution_validity: "insufficient_data",
    };
  }

  const tCvr = record.treatment_conversions / record.treatment_impressions;
  const cCvr = record.control_conversions   / record.control_impressions;
  const incremental = tCvr - cCvr;

  // Standard Error of the difference in proportions
  const n1 = record.treatment_impressions;
  const n2 = record.control_impressions;
  const se = Math.sqrt((tCvr * (1 - tCvr) / n1) + (cCvr * (1 - cCvr) / n2));
  const z95 = 1.96;
  const ciMargin = z95 * se;

  // Incremental revenue per 100 visitors (causal attribution)
  const causalRevPer100 = incremental * 100 * estimatedAov;
  // What we would lose if we stopped all interventions
  const lossPerHundredWithoutSystem = incremental * 100 * estimatedAov;

  const validity: CausalRevenueAttribution["attribution_validity"] =
    record.confidence >= 0.80 ? "high"
    : record.confidence >= 0.60 ? "medium"
    : record.confidence >= 0.40 ? "low"
    : "insufficient_data";

  return {
    treatment_cvr: tCvr,
    control_cvr: cCvr,
    incremental_cvr: incremental,
    incremental_cvr_pct: `${incremental >= 0 ? "+" : ""}${(incremental * 100).toFixed(1)}%`,
    estimated_aov: estimatedAov,
    causal_revenue_per_100: Math.round(causalRevPer100 * 100) / 100,
    counterfactual_revenue_loss: Math.round(lossPerHundredWithoutSystem * 100) / 100,
    confidence_interval: `±${(ciMargin * 100).toFixed(1)}% at 95% CI`,
    attribution_validity: validity,
  };
}

// ── Risk Factor Assessment ────────────────────────────────────────────────────
function assessRiskFactors(
  decision: CausalDecision,
  cohortData: UpliftRecord[],
  signals: SessionSignals
): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const record = cohortData.find(r => r.action_type === decision.action);

  // Small sample risk
  if ((record?.sample_size ?? 0) < 50) {
    risks.push({
      type: "small_sample",
      severity: (record?.sample_size ?? 0) < 20 ? "high" : "medium",
      description: `Only ${record?.sample_size ?? 0} sessions in this cohort. Statistical conclusions may be unstable.`,
      mitigation: "Confidence threshold enforced. Decision falls back to rules below 55% confidence.",
    });
  }

  // Temporal bias
  if (record?.updated_at) {
    const daysOld = (Date.now() - new Date(record.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld > 7) {
      risks.push({
        type: "temporal_bias",
        severity: daysOld > 21 ? "high" : "medium",
        description: `Uplift data is ${Math.round(daysOld)} days old. Time decay applied (weight = ${(Math.pow(0.5, daysOld / 14) * 100).toFixed(0)}%).`,
        mitigation: "Exponential time decay reduces influence of old data. Recent data gets full weight.",
      });
    }
  }

  // Exploration mode risk
  if (decision.decision_mode === "exploration") {
    risks.push({
      type: "model_assumption",
      severity: "low",
      description: "This session is in exploration mode. The action was randomly selected, not optimized.",
      mitigation: "Exploration is necessary for discovering new causal patterns. Result fed back to model.",
    });
  }

  // Drift risk
  if (decision.decision_mode === "drift_reset") {
    risks.push({
      type: "cohort_drift",
      severity: "high",
      description: "Cohort baseline has shifted >15%. Previous uplift data may not represent current behavior.",
      mitigation: "System forced re-exploration. New data being collected to re-establish causal baseline.",
    });
  }

  // Control group caveat
  risks.push({
    type: "selection_bias",
    severity: "low",
    description: "Control group (20% holdout) estimates the counterfactual, but is not perfect ground truth. Selection bias may exist if control/treatment groups have unobserved differences.",
    mitigation: "Random group assignment at session start minimizes systematic bias.",
  });

  return risks.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return sev[b.severity] - sev[a.severity];
  });
}

// ── MAIN: Build Full Decision Trace ──────────────────────────────────────────
export async function buildDecisionTrace(params: {
  sessionId: string;
  signals: SessionSignals;
  decision: CausalDecision;
  cohortData: UpliftRecord[];
  estimatedAov?: number;
}): Promise<DecisionTrace> {
  const { sessionId, signals, decision, cohortData, estimatedAov } = params;

  const signalContributions = explainSignals(signals, decision);
  const alternatives        = await explainAlternatives(decision.cohort_key, decision, cohortData);
  const revenueAttribution  = calculateRevenueAttribution(cohortData, decision.action, estimatedAov ?? 65);
  const riskFactors         = assessRiskFactors(decision, cohortData, signals);

  const dominant = signalContributions[0];
  const overallRisk: DecisionTrace["overall_risk"] =
    riskFactors.some(r => r.severity === "high") ? "high"
    : riskFactors.some(r => r.severity === "medium") ? "medium"
    : "low";

  // One-line human explanation of the decision
  const oneLine = buildOneLiner(signals, decision, revenueAttribution);

  const scoreFormula = decision.decision_mode === "causal"
    ? `score = uplift(${(decision.expected_uplift * 100).toFixed(1)}%) × decay × stability(${(decision.stability_score * 100).toFixed(0)}%) + UCB_bonus`
    : `score = rules_heuristic (mode: ${decision.decision_mode})`;

  return {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    decision,
    signal_contributions: signalContributions,
    dominant_signal: dominant?.signal ?? "unknown",
    alternatives_considered: alternatives,
    action_selection_score_formula: scoreFormula,
    revenue_attribution: revenueAttribution,
    risk_factors: riskFactors,
    overall_risk: overallRisk,
    one_line_reason: oneLine,
  };
}

function buildOneLiner(
  signals: SessionSignals,
  decision: CausalDecision,
  revenue: CausalRevenueAttribution
): string {
  if (decision.group_assignment === "control") {
    return "Control group: no action taken. This session measures baseline behavior without intervention.";
  }
  if (decision.decision_mode === "drift_reset") {
    return "Cohort behavior shifted — system reset and collecting new data before making causal decisions.";
  }
  if (decision.decision_mode === "exploration") {
    return `Exploring "${decision.action}" in this cohort — not enough data yet to make a confident causal decision.`;
  }
  const upliftStr = revenue.attribution_validity !== "insufficient_data"
    ? ` Expected incremental CVR: ${revenue.incremental_cvr_pct}.`
    : "";
  return `${signals.friction === "stuck_cart" ? "Cart rescue" : signals.friction === "hesitant" ? "Hesitation recovery" : "Engagement"}: "${decision.action}" selected with ${(decision.uplift_confidence * 100).toFixed(0)}% confidence and ${(decision.stability_score * 100).toFixed(0)}% stability.${upliftStr}`;
}

// ── Store Decision Trace (async, non-blocking) ────────────────────────────────
// Persists the trace for the dashboard/explainability API
export async function persistDecisionTrace(sessionId: string, trace: DecisionTrace): Promise<void> {
  try {
    await query(
      `UPDATE popup_sessions
       SET reasoning = $1
       WHERE session_id = $2`,
      [JSON.stringify({
        one_line:    trace.one_line_reason,
        formula:     trace.action_selection_score_formula,
        top_signal:  trace.dominant_signal,
        risk:        trace.overall_risk,
        incremental_cvr: trace.revenue_attribution.incremental_cvr_pct,
        validity:    trace.revenue_attribution.attribution_validity,
      }), sessionId]
    );
  } catch (e) {
    console.warn("[decision-explainer] Failed to persist trace:", e);
  }
}
