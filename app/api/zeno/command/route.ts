/**
 * app/api/zeno/command/route.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * ZENO COMMAND SYSTEM — Version 2.0 (COMPLETE BUILD)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ROLE DEFINITION (IMMUTABLE):
 * ─────────────────────────────
 * ZENO = Pure Behavioral Intelligence Processor.
 *   1. Receive structured behavioral data from external API
 *   2. Analyze visitor behavior using CMD_01 → CMD_10 ONLY
 *   3. Produce structured intelligence outputs
 *   4. Return ONLY decision-ready JSON responses
 *
 * ZENO IS NOT:
 *   ✗ A developer
 *   ✗ A strategist
 *   ✗ An executor (that is NOLIX's job)
 *   ✗ Allowed to modify scripts, architecture, or business logic
 *
 * STRICT ENFORCEMENT:
 *   Any command outside CMD_01 → CMD_10:
 *   → "OUT_OF_SCOPE — COMMAND_REJECTION"
 *
 * PIPELINE ORDER (called by CMD_09):
 *   CMD_01 → CMD_02 → CMD_03 → CMD_04 → CMD_05 → CMD_06 → CMD_07 → CMD_09
 *
 * INPUT:  JSON { command: string, signals: VisitorSignals }
 * OUTPUT: Deterministic structured JSON (no prose unless requested)
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — COMMAND REGISTRY (IMMUTABLE)
// ══════════════════════════════════════════════════════════════════════════════

const VALID_COMMANDS = [
  "CMD_01_CLASSIFY_VISITOR",     // Identity Layer: Who is this visitor?
  "CMD_02_SCORE_INTENT",         // Intent Layer: How strong is their intent?
  "CMD_03_DETECT_FRICTION",      // Friction Layer: Where are they stuck?
  "CMD_04_EVALUATE_TRIGGER",     // Trigger Layer: Does this moment justify action?
  "CMD_05_SELECT_ACTION",        // Action Layer: What is the optimal response?
  "CMD_06_COMPUTE_UPLIFT",       // Economics Layer: What is the expected ROI?
  "CMD_07_CALIBRATE_CONFIDENCE", // Confidence Layer: How certain is the system?
  "CMD_08_AUDIT_SESSION",        // Audit Layer: Full behavioral snapshot
  "CMD_09_RETURN_DECISION",      // Decision Layer: Final NOLIX execution signal
  "CMD_10_HEALTH_CHECK",         // System Layer: Is the engine operational?
] as const;

type ZenoCommand = typeof VALID_COMMANDS[number];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

/** Visitor behavioral state (output of CMD_01) */
type VisitorType =
  | "CONVERTER"           // score ≥ 80 — ready to buy, do not interrupt
  | "HOT_HESITATOR"       // score 50–79 — high intent, friction detected → nudge
  | "INTERESTED_EXPLORER" // score 20–49 — engaged, not committed → soft touch
  | "PASSIVE_BROWSER"     // score < 20 — low engagement → observe only
  | "EXIT_RISK";          // time_on_page < 5 AND pages ≤ 1 → immediate risk

/** Risk classification (output of CMD_01) */
type RiskLevel =
  | "READY_TO_CONVERT"  // score ≥ 80
  | "HIGH_INTENT"       // score 50–79
  | "MEDIUM_INTENT"     // score 20–49
  | "LOW_INTENT_RISK";  // score < 20

/** Intent level (output of CMD_02) */
type IntentLevel = "HIGH" | "MEDIUM" | "LOW";

/** Friction stage (output of CMD_03) */
type FrictionStage =
  | "NO_FRICTION"
  | "PRE_FUNNEL"
  | "PRODUCT_DISCOVERY"
  | "CART_STAGE"
  | "CHECKOUT_STAGE";

/** Trigger strength (output of CMD_04) */
type TriggerStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";

/** Action catalog (output of CMD_05) */
type ZenoAction =
  | "do_nothing"
  | "urgency"
  | "popup_info"
  | "free_shipping"
  | "bundle"
  | "discount_5"
  | "discount_10"
  | "discount_15";

/**
 * Unified VisitorSignals — accepts both engine.js format AND new API format.
 * Fields are optional so both sources work without transformation.
 */
interface VisitorSignals {
  // ── engine.js format ──────────────────────────────────────────────────────
  session_id?: string;
  trigger?: string;
  time_on_site?: number;
  pages_viewed?: number;
  scroll_depth?: number;
  cart_status?: string;
  hesitations?: number;
  cta_hover_count?: number;
  mouse_leave_count?: number;
  tab_hidden_count?: number;
  return_visitor?: boolean;
  current_url?: string;
  device?: string;
  aov_estimate?: number;
  // ── new API format (as defined in CMD_01 spec) ────────────────────────────
  time_on_page?: number;
  page_views?: number;
  clicks?: number;
  product_views?: number;
  add_to_cart?: boolean;
  checkout_started?: boolean;
  return_visits?: number;
  session_duration?: number;
}

/** Normalized signals — internal working format after bridging both input types */
interface NormalizedSignals {
  session_id: string;
  trigger: string;
  time_on_page: number;
  page_views: number;
  scroll_depth: number;
  clicks: number;
  product_views: number;
  add_to_cart: boolean;
  checkout_started: boolean;
  cart_status: string;
  return_visits: number;
  return_visitor: boolean;
  hesitations: number;
  cta_hover_count: number;
  mouse_leave_count: number;
  tab_hidden_count: number;
  session_duration: number;
  current_url: string;
  device: string;
  aov_estimate: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — SIGNAL NORMALIZER
// Bridges engine.js format ↔ new API format into one working object
// ══════════════════════════════════════════════════════════════════════════════

function normalizeSignals(s: VisitorSignals): NormalizedSignals {
  const cart = s.cart_status ?? (s.checkout_started ? "checkout" : s.add_to_cart ? "added" : "empty");
  return {
    session_id:       s.session_id       ?? `z_${Date.now()}`,
    trigger:          s.trigger          ?? "early_eval",
    time_on_page:     s.time_on_page     ?? s.time_on_site     ?? 0,
    page_views:       s.page_views       ?? s.pages_viewed     ?? 1,
    scroll_depth:     s.scroll_depth     ?? 0,
    clicks:           s.clicks           ?? 0,
    product_views:    s.product_views    ?? 0,
    add_to_cart:      s.add_to_cart      ?? (s.cart_status === "added" || s.cart_status === "checkout"),
    checkout_started: s.checkout_started ?? s.cart_status === "checkout",
    cart_status:      cart,
    return_visits:    s.return_visits    ?? (s.return_visitor ? 2 : 0),
    return_visitor:   s.return_visitor   ?? (s.return_visits ?? 0) > 1,
    hesitations:      s.hesitations      ?? 0,
    cta_hover_count:  s.cta_hover_count  ?? 0,
    mouse_leave_count:s.mouse_leave_count?? 0,
    tab_hidden_count: s.tab_hidden_count ?? 0,
    session_duration: s.session_duration ?? s.time_on_site ?? 0,
    current_url:      s.current_url      ?? "",
    device:           s.device           ?? "desktop",
    aov_estimate:     s.aov_estimate     ?? 65,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_01 — CLASSIFY_VISITOR
// ══════════════════════════════════════════════════════════════════════════════
/**
 * STEP 1 — Base Classification Scoring
 * Converts raw behavioral data into a single intent score (0–125+).
 */
function _classifyScore(n: NormalizedSignals): number {
  let score = 0;
  if (n.time_on_page > 10)    score += 10;
  if (n.scroll_depth > 50)    score += 10;
  if (n.page_views > 2)       score += 10;
  if (n.product_views > 0)    score += 10;
  if (n.add_to_cart)          score += 30;
  if (n.checkout_started)     score += 40;
  if (n.return_visits > 1)    score += 15;
  return score;
}

/**
 * STEP 2 — Visitor Type Engine
 * Maps score + context to a behavioral classification.
 */
function _getVisitorType(score: number, n: NormalizedSignals): VisitorType {
  if (n.time_on_page < 5 && n.page_views <= 1) return "EXIT_RISK";
  if (score < 20)  return "PASSIVE_BROWSER";
  if (score < 50)  return "INTERESTED_EXPLORER";
  if (score < 80)  return "HOT_HESITATOR";
  return "CONVERTER";
}

/**
 * STEP 3 — Conversion Probability
 * Maps score to a baseline P(convert) estimate.
 */
function _getConversionProbability(score: number): number {
  if (score < 20) return 0.05;
  if (score < 50) return 0.20;
  if (score < 80) return 0.45;
  return 0.70;
}

/**
 * STEP 4 — Risk Level
 */
function _getRiskLevel(score: number): RiskLevel {
  if (score < 20) return "LOW_INTENT_RISK";
  if (score < 50) return "MEDIUM_INTENT";
  if (score < 80) return "HIGH_INTENT";
  return "READY_TO_CONVERT";
}

/** CMD_01 Final Output */
function runCMD01(n: NormalizedSignals) {
  const score = _classifyScore(n);
  const visitor_type = _getVisitorType(score, n);
  const conversion_probability = _getConversionProbability(score);
  const risk_level = _getRiskLevel(score);
  return {
    command:              "CMD_01_CLASSIFY_VISITOR",
    visitor_type,
    intent_score:         score,
    conversion_probability,
    risk_level,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_02 — SCORE_INTENT
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Deep intent scoring with per-signal breakdown.
 * Returns a precise intent score (0–100) with evidence trail.
 */
function runCMD02(n: NormalizedSignals) {
  const breakdown: Record<string, number> = {};
  let score = 3; // empirical e-commerce baseline CVR floor

  // Funnel position — highest-weight signals
  if (n.checkout_started)        { breakdown.checkout_started = +40; score += 40; }
  else if (n.add_to_cart)        { breakdown.add_to_cart      = +22; score += 22; }

  // Product exploration
  if (n.product_views > 3)       { breakdown.product_views_deep   = +12; score += 12; }
  else if (n.product_views > 0)  { breakdown.product_views_light  = +6;  score += 6;  }

  // Time engagement
  if (n.time_on_page > 120)      { breakdown.time_deep   = +10; score += 10; }
  else if (n.time_on_page > 45)  { breakdown.time_medium = +5;  score += 5;  }
  else if (n.time_on_page > 10)  { breakdown.time_light  = +2;  score += 2;  }

  // Page depth
  if (n.page_views > 5)          { breakdown.pages_deep   = +7; score += 7; }
  else if (n.page_views > 2)     { breakdown.pages_medium = +3; score += 3; }

  // Scroll engagement
  if (n.scroll_depth > 75)       { breakdown.scroll_deep   = +6; score += 6; }
  else if (n.scroll_depth > 40)  { breakdown.scroll_medium = +2; score += 2; }

  // Click activity
  if (n.clicks > 10)             { breakdown.clicks_high   = +5; score += 5; }
  else if (n.clicks > 3)         { breakdown.clicks_medium = +2; score += 2; }

  // Return signal — proven prior interest
  if (n.return_visits > 3)       { breakdown.return_deep   = +18; score += 18; }
  else if (n.return_visits > 1)  { breakdown.return_visits = +12; score += 12; }

  // CTA hover intent
  if (n.cta_hover_count > 2)     { breakdown.cta_hover = +8; score += 8; }

  // Friction penalties
  if (n.hesitations > 3)         { breakdown.hesitations_high   = -10; score -= 10; }
  else if (n.hesitations > 1)    { breakdown.hesitations_medium = -4;  score -= 4;  }
  if (n.mouse_leave_count > 2)   { breakdown.mouse_exits    = -6;  score -= 6;  }
  if (n.tab_hidden_count > 1)    { breakdown.tab_switches   = -5;  score -= 5;  }
  if (n.trigger === "exit_intent") { breakdown.exit_trigger  = -8;  score -= 8;  }

  score = Math.max(1, Math.min(99, score));

  const intent_level: IntentLevel = score >= 55 ? "HIGH" : score >= 28 ? "MEDIUM" : "LOW";
  const base_cvr = parseFloat((score / 100).toFixed(2));

  return {
    command:        "CMD_02_SCORE_INTENT",
    visitor_type:   _getVisitorType(_classifyScore(n), n),
    intent:         intent_level,
    intent_score:   score,
    base_cvr,
    signal_breakdown: breakdown,
    signals_counted:  Object.keys(breakdown).length,
    risk_level:     _getRiskLevel(_classifyScore(n)),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_03 — DETECT_FRICTION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Locates exactly WHERE in the funnel friction exists and HOW severe it is.
 * Friction types ordered by severity (highest first).
 */

type FrictionType =
  | "checkout_block"        // Stuck in checkout with hesitation
  | "cart_abandonment"      // Cart added + exit signal
  | "funnel_stall"          // In funnel but stopped moving
  | "price_hesitation"      // CTA hover but no add-to-cart
  | "attention_drain"       // Tab switching / multi-tab behavior
  | "bounce_risk"           // Early exit with minimal engagement
  | "distraction_switching" // Repeated tab hiding
  | "passive_browsing"      // Browsing but disengaged
  | "none";                 // No detectable friction

type FrictionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

function runCMD03(n: NormalizedSignals) {
  let friction_type: FrictionType = "none";
  let friction_stage: FrictionStage = "NO_FRICTION";
  let severity: FrictionSeverity = "NONE";
  let suggested_intervention = "observe";

  // Evaluate friction — ordered by severity
  if (n.checkout_started && n.hesitations > 1) {
    friction_type = "checkout_block";
    friction_stage = "CHECKOUT_STAGE";
    severity = "CRITICAL";
    suggested_intervention = "urgency — low-friction message only, no discount";
  } else if (n.add_to_cart && (n.trigger === "exit_intent" || n.mouse_leave_count > 1)) {
    friction_type = "cart_abandonment";
    friction_stage = "CART_STAGE";
    severity = "HIGH";
    suggested_intervention = "urgency or small discount to recover";
  } else if (n.trigger === "funnel_idle" && (n.add_to_cart || n.checkout_started)) {
    friction_type = "funnel_stall";
    friction_stage = "CART_STAGE";
    severity = "HIGH";
    suggested_intervention = "bundle or free_shipping to restart momentum";
  } else if (n.cta_hover_count > 2 && !n.add_to_cart) {
    friction_type = "price_hesitation";
    friction_stage = "PRODUCT_DISCOVERY";
    severity = "MEDIUM";
    suggested_intervention = "discount_5 or social-proof message";
  } else if (n.mouse_leave_count > 2 && !n.add_to_cart) {
    friction_type = "attention_drain";
    friction_stage = "PRE_FUNNEL";
    severity = "MEDIUM";
    suggested_intervention = "popup_info to re-engage attention";
  } else if (n.tab_hidden_count > 1) {
    friction_type = "distraction_switching";
    friction_stage = "PRE_FUNNEL";
    severity = "MEDIUM";
    suggested_intervention = "urgency message to recapture focus";
  } else if (n.trigger === "exit_intent" && !n.add_to_cart) {
    friction_type = "bounce_risk";
    friction_stage = "PRE_FUNNEL";
    severity = "HIGH";
    suggested_intervention = "free_shipping or soft offer to delay exit";
  } else if (n.trigger === "browse_idle" || (n.page_views < 2 && n.time_on_page > 30)) {
    friction_type = "passive_browsing";
    friction_stage = "PRODUCT_DISCOVERY";
    severity = "LOW";
    suggested_intervention = "popup_info with social proof";
  }

  return {
    command:               "CMD_03_DETECT_FRICTION",
    friction_type,
    friction_stage,
    severity,
    suggested_intervention,
    hesitation_count:      n.hesitations,
    mouse_exits:           n.mouse_leave_count,
    tab_switches:          n.tab_hidden_count,
    cta_hover_count:       n.cta_hover_count,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_04 — EVALUATE_TRIGGER
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Evaluates whether the current behavioral trigger justifies an intervention.
 * Uses economic justification: is the uplift worth the interruption cost?
 */
function runCMD04(n: NormalizedSignals, intentScore: number) {
  let trigger_strength: TriggerStrength = "NONE";
  let should_intervene = false;
  let justification = "";
  let risk_of_action = "LOW";

  // Quantify trigger strength
  if (n.trigger === "checkout_intent" || (n.checkout_started && n.hesitations > 0)) {
    trigger_strength = "STRONG";
  } else if (n.trigger === "exit_intent" && intentScore > 20) {
    trigger_strength = "STRONG";
  } else if (n.trigger === "funnel_idle" && n.add_to_cart) {
    trigger_strength = "MODERATE";
  } else if (n.trigger === "cart_added" || n.cta_hover_count > 3) {
    trigger_strength = "MODERATE";
  } else if (n.trigger === "browse_idle" || n.trigger === "early_eval") {
    trigger_strength = "WEAK";
  }

  // Decision gate — economic justification
  if (intentScore < 12 && !n.add_to_cart) {
    should_intervene = false;
    justification = "Intent too low (score < 12). No cart activity. Cold traffic — intervention not ROI-positive.";
    risk_of_action = "HIGH";
  } else if (n.hesitations > 6) {
    should_intervene = false;
    justification = "Over-hesitated visitor (hesitations > 6). Intervention at this stage increases bounce probability.";
    risk_of_action = "HIGH";
  } else if (n.trigger === "early_eval" && intentScore < 25) {
    should_intervene = false;
    justification = "Early evaluation — visitor has not proven sufficient engagement. Wait for stronger signal.";
    risk_of_action = "MEDIUM";
  } else if (trigger_strength === "STRONG") {
    should_intervene = true;
    justification = "Strong trigger confirmed with sufficient intent. Intervention is economically justified.";
    risk_of_action = "LOW";
  } else if (trigger_strength === "MODERATE" && intentScore >= 30) {
    should_intervene = true;
    justification = "Moderate trigger with MEDIUM+ intent. Intervention ROI is positive.";
    risk_of_action = "LOW";
  } else if (intentScore >= 50) {
    should_intervene = true;
    justification = "High intent score (≥ 50) is sufficient for intervention without trigger requirement.";
    risk_of_action = "LOW";
  } else {
    should_intervene = false;
    justification = "Insufficient signal combination. Do nothing is the correct economic decision.";
    risk_of_action = "MEDIUM";
  }

  return {
    command:           "CMD_04_EVALUATE_TRIGGER",
    trigger_evaluated: n.trigger,
    trigger_strength,
    should_intervene,
    justification,
    risk_of_action,
    intent_score:      intentScore,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_05 — SELECT_ACTION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * The Action Selection Matrix.
 * Maps (visitor_type × friction_type × intent_score) → optimal action.
 * 
 * RULE: ZENO selects. NOLIX executes. These are separate.
 */

const ACTION_CATALOG: Record<ZenoAction, { cost: number; label: string; tier: string }> = {
  do_nothing:    { cost: 0.00, label: "No action — let visitor flow",            tier: "0_SILENT"    },
  urgency:       { cost: 0.05, label: "Urgency message (no discount)",            tier: "1_MESSAGE"   },
  popup_info:    { cost: 0.05, label: "Trust reinforcement / social proof",       tier: "1_MESSAGE"   },
  free_shipping: { cost: 0.15, label: "Free shipping unlock",                     tier: "2_INCENTIVE" },
  bundle:        { cost: 0.10, label: "Bundle offer suggestion",                  tier: "2_INCENTIVE" },
  discount_5:    { cost: 0.30, label: "5% discount coupon",                       tier: "3_DISCOUNT"  },
  discount_10:   { cost: 0.50, label: "10% discount coupon",                      tier: "3_DISCOUNT"  },
  discount_15:   { cost: 0.70, label: "15% flash discount — highest cost action", tier: "3_DISCOUNT"  },
};

function runCMD05(
  visitorType: VisitorType,
  frictionType: FrictionType,
  intentScore: number,
  shouldIntervene: boolean
): { selected_action: ZenoAction; economic_cost: number; intervention_tier: string; rationale: string } {

  if (!shouldIntervene || visitorType === "CONVERTER") {
    return {
      selected_action:  "do_nothing",
      economic_cost:    0,
      intervention_tier: "0_SILENT",
      rationale: "Visitor is converting organically or trigger is insufficient. Do nothing is correct.",
    };
  }

  let action: ZenoAction = "do_nothing";
  let rationale = "";

  // Decision matrix — ordered by (type × friction × score)
  if (visitorType === "HOT_HESITATOR") {
    if (frictionType === "checkout_block")    { action = "urgency";       rationale = "Checkout stall — low-friction urgency only. No discount to avoid disruption."; }
    else if (frictionType === "cart_abandonment" && intentScore > 50) { action = "urgency";  rationale = "High-intent cart abandonment. Urgency recovers without cost."; }
    else if (frictionType === "cart_abandonment") { action = "discount_5"; rationale = "Cart abandonment with MEDIUM intent. 5% discount is minimum viable recovery."; }
    else if (frictionType === "price_hesitation") { action = "discount_5"; rationale = "Price friction confirmed via CTA hover. Small discount resolves hesitation."; }
    else { action = "free_shipping";               rationale = "HOT_HESITATOR with no specific friction. Free shipping is lowest-cost incentive."; }
  } else if (visitorType === "EXIT_RISK") {
    if (intentScore > 40)                    { action = "discount_10";   rationale = "High-intent exit risk. Significant offer needed to recover."; }
    else if (n_add_to_cart_check(intentScore))  { action = "free_shipping"; rationale = "Exit risk with prior cart interest. Free shipping as recovery hook."; }
    else                                     { action = "popup_info";    rationale = "Exit risk with low intent. Social proof is lowest-interrupt option."; }
  } else if (visitorType === "INTERESTED_EXPLORER") {
    if (frictionType === "price_hesitation") { action = "discount_5";    rationale = "Explorer hesitating on price. Small offer moves them forward."; }
    else if (intentScore > 40)               { action = "bundle";        rationale = "Engaged explorer. Bundle offer increases AOV and conversion simultaneously."; }
    else                                     { action = "popup_info";    rationale = "Engaged explorer. Social proof nudge is lowest interruption."; }
  } else if (visitorType === "PASSIVE_BROWSER") {
    action = "popup_info";                   rationale = "Passive browser. Only soft message — no discount justified by intent.";
  } else {
    action = "do_nothing";                   rationale = "No visitor type match. Safe fallback: do nothing.";
  }

  const catalog = ACTION_CATALOG[action];
  return {
    selected_action:   action,
    economic_cost:     catalog.cost,
    intervention_tier: catalog.tier,
    rationale,
  };
}

/** Helper — check if score implies prior add-to-cart behavior */
function n_add_to_cart_check(score: number): boolean { return score > 25; }

// ══════════════════════════════════════════════════════════════════════════════
// CMD_06 — COMPUTE_UPLIFT
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Economic ROI calculation for selected action.
 * Formula: economic_value = (uplift × AOV) - (cost × AOV × 0.10)
 */
function runCMD06(action: ZenoAction, basePConvert: number, aov: number) {

  const UPLIFT_PRIORS: Record<string, number> = {
    urgency:       0.06,
    popup_info:    0.04,
    free_shipping: 0.09,
    bundle:        0.05,
    discount_5:    0.08,
    discount_10:   0.13,
    discount_15:   0.18,
    do_nothing:    0.00,
  };

  const cost = ACTION_CATALOG[action]?.cost ?? 0;
  const uplift_rate = UPLIFT_PRIORS[action] ?? 0;
  const p_convert_action = parseFloat(Math.min(0.98, basePConvert + uplift_rate).toFixed(4));
  const uplift_absolute = parseFloat((p_convert_action - basePConvert).toFixed(4));
  const uplift_relative_pct = basePConvert > 0
    ? parseFloat(((uplift_absolute / basePConvert) * 100).toFixed(1))
    : 0;
  const revenue_impact = parseFloat((uplift_absolute * aov).toFixed(2));
  const action_cost = parseFloat((cost * aov * 0.10).toFixed(2));
  const economic_value = parseFloat((revenue_impact - action_cost).toFixed(2));
  const roi = action_cost > 0 ? parseFloat(((revenue_impact / action_cost) * 100).toFixed(1)) : null;

  return {
    command:               "CMD_06_COMPUTE_UPLIFT",
    action,
    p_convert_baseline:    parseFloat(basePConvert.toFixed(4)),
    p_convert_action,
    uplift_absolute,
    uplift_relative_pct,
    expected_revenue_impact: revenue_impact,
    action_cost,
    economic_value,
    roi_pct:               roi,
    verdict:               economic_value > 0 ? "ROI_POSITIVE" : "ROI_NEGATIVE",
    aov_used:              aov,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_07 — CALIBRATE_CONFIDENCE
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Measures how confident ZENO is in its decision.
 * Based on: signal count + data quality + historical accuracy.
 */
async function runCMD07(
  storeDomain: string,
  action: ZenoAction,
  n: NormalizedSignals,
  intentScore: number
): Promise<{
  command: string;
  confidence: number;
  confidence_level: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "COLD_START";
  data_quality: "live" | "prior" | "cold";
  signal_strength: number;
  calibration_factors: Record<string, string | number>;
}> {

  // Signal strength — how many non-zero signals do we have?
  const signal_strength = [
    n.time_on_page > 10,
    n.page_views > 1,
    n.scroll_depth > 0,
    n.clicks > 0,
    n.product_views > 0,
    n.add_to_cart,
    n.checkout_started,
    n.return_visits > 0,
    n.hesitations > 0,
    n.cta_hover_count > 0,
    n.mouse_leave_count > 0,
    n.tab_hidden_count > 0,
  ].filter(Boolean).length;

  // Try to pull historical calibration from DB
  let db_confidence = 0.35; // cold start prior
  let data_quality: "live" | "prior" | "cold" = "cold";

  try {
    const rows = await query<{ confidence: number; sample_size: number }>(
      `SELECT confidence, sample_size FROM nolix_uplift_model
       WHERE cohort_key LIKE $1 AND action_type = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [`${storeDomain}%`, action]
    );
    if (rows[0]) {
      const { confidence, sample_size } = rows[0];
      if (sample_size > 50) {
        db_confidence = confidence;
        data_quality = "live";
      } else if (sample_size > 10) {
        db_confidence = 0.35 + (confidence - 0.35) * 0.5; // blend prior + data
        data_quality = "prior";
      }
    }
  } catch (_) {}

  // Combine signal strength + DB confidence
  const signal_factor = Math.min(1.0, signal_strength / 10);
  const confidence = parseFloat(
    Math.min(0.99, db_confidence * 0.6 + signal_factor * 0.4).toFixed(3)
  );

  const confidence_level =
    confidence >= 0.80 ? "VERY_HIGH" :
    confidence >= 0.60 ? "HIGH"      :
    confidence >= 0.40 ? "MEDIUM"    :
    confidence >= 0.20 ? "LOW"       :
    "COLD_START";

  return {
    command:           "CMD_07_CALIBRATE_CONFIDENCE",
    confidence,
    confidence_level,
    data_quality,
    signal_strength,
    calibration_factors: {
      db_confidence,
      signal_factor: parseFloat(signal_factor.toFixed(3)),
      signals_present:  signal_strength,
      signals_max:      12,
      intent_score:     intentScore,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_08 — AUDIT_SESSION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Complete behavioral snapshot. Full audit trail for the session.
 * Not a decision — just structured observation.
 */
function runCMD08(
  n: NormalizedSignals,
  visitorType: VisitorType,
  intentResult: ReturnType<typeof runCMD02>,
  frictionResult: ReturnType<typeof runCMD03>,
  triggerResult: ReturnType<typeof runCMD04>
) {
  return {
    command: "CMD_08_AUDIT_SESSION",
    session: {
      id:     n.session_id,
      device: n.device,
      url:    n.current_url,
    },
    classification: {
      visitor_type:          visitorType,
      risk_level:            _getRiskLevel(_classifyScore(n)),
      conversion_probability: _getConversionProbability(_classifyScore(n)),
    },
    intent: {
      score:   intentResult.intent_score,
      level:   intentResult.intent,
      base_cvr: intentResult.base_cvr,
    },
    engagement: {
      time_on_page_s:   n.time_on_page,
      session_duration: n.session_duration,
      page_views:       n.page_views,
      scroll_depth_pct: n.scroll_depth,
      clicks:           n.clicks,
      product_views:    n.product_views,
      cta_hover_count:  n.cta_hover_count,
    },
    funnel: {
      cart_status:       n.cart_status,
      add_to_cart:       n.add_to_cart,
      checkout_started:  n.checkout_started,
    },
    hesitation: {
      hesitation_count:  n.hesitations,
      mouse_exits:       n.mouse_leave_count,
      tab_switches:      n.tab_hidden_count,
    },
    history: {
      return_visitor:    n.return_visitor,
      return_visits:     n.return_visits,
    },
    friction: {
      type:     frictionResult.friction_type,
      stage:    frictionResult.friction_stage,
      severity: frictionResult.severity,
    },
    trigger: {
      current:    n.trigger,
      strength:   triggerResult.trigger_strength,
      justified:  triggerResult.should_intervene,
    },
    signal_breakdown: intentResult.signal_breakdown,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_09 — RETURN_DECISION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * THE FINAL AUTHORITATIVE OUTPUT.
 * Runs full pipeline (CMD_01 → CMD_07) and returns the single execution signal.
 * This is the ONLY command NOLIX listens to for execution.
 */
async function runCMD09(n: NormalizedSignals) {
  // Full pipeline execution
  const c01 = runCMD01(n);
  const c02 = runCMD02(n);
  const c03 = runCMD03(n);
  const c04 = runCMD04(n, c02.intent_score);
  const c05 = runCMD05(
    c01.visitor_type as VisitorType,
    c03.friction_type as FrictionType,
    c02.intent_score,
    c04.should_intervene
  );
  const c06 = runCMD06(c05.selected_action as ZenoAction, c01.conversion_probability, n.aov_estimate);
  const storeDomain = n.current_url
    ? (() => { try { return new URL(n.current_url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })()
    : "unknown";
  const c07 = await runCMD07(storeDomain, c05.selected_action as ZenoAction, n, c02.intent_score);

  return {
    command:          "CMD_09_RETURN_DECISION",
    // ── Identity ──────────────────────────────────────────────────────────────
    visitor_type:     c01.visitor_type,
    intent:           c02.intent,
    intent_score:     c02.intent_score,
    risk_level:       c01.risk_level,
    // ── Friction ──────────────────────────────────────────────────────────────
    friction_type:    c03.friction_type,
    friction_stage:   c03.friction_stage,
    // ── Decision ──────────────────────────────────────────────────────────────
    should_intervene: c04.should_intervene,
    decision:         c05.selected_action,
    action:           c05.selected_action,            // duplicate for NOLIX compatibility
    economic_decision: c05.selected_action !== "do_nothing" ? "intervene" : "wait",
    // ── Economics ─────────────────────────────────────────────────────────────
    p_convert_baseline: c06.p_convert_baseline,
    p_convert_action:   c06.p_convert_action,
    uplift_absolute:    c06.uplift_absolute,
    economic_value:     c06.economic_value,
    roi_pct:            c06.roi_pct,
    // ── Confidence ────────────────────────────────────────────────────────────
    confidence:         c07.confidence,
    confidence_level:   c07.confidence_level,
    data_quality:       c07.data_quality,
    // ── Human-readable summary ────────────────────────────────────────────────
    one_line_reason: `${c02.intent} intent visitor (${c02.intent_score}/100). ` +
                     `Friction: ${c03.friction_type}. ` +
                     `${c04.justification}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CMD_10 — HEALTH_CHECK
// ══════════════════════════════════════════════════════════════════════════════
/**
 * System readiness check. No signals required.
 */
async function runCMD10() {
  const start = Date.now();
  let db = false;
  let db_latency_ms = 0;
  let db_error: string | null = null;

  try {
    const t0 = Date.now();
    await query("SELECT 1 AS ping", []);
    db = true;
    db_latency_ms = Date.now() - t0;
  } catch (e: any) {
    db_error = e.message;
  }

  const total_latency_ms = Date.now() - start;
  const status = db ? "OK" : "DOWN";

  return {
    command:          "CMD_10_HEALTH_CHECK",
    status,
    engine_version:   "ZENO_v2.0",
    active_commands:  10,
    db,
    db_latency_ms,
    total_latency_ms,
    db_error,
    message:          db ? "All systems operational." : `DB unreachable: ${db_error}`,
    command_registry: VALID_COMMANDS,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HTTP HANDLER
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, signals } = body as { command: string; signals?: VisitorSignals };

    // ── COMMAND VALIDATION GATE (IMMUTABLE) ───────────────────────────────────
    if (!command || !VALID_COMMANDS.includes(command as ZenoCommand)) {
      return NextResponse.json({
        error: "OUT_OF_SCOPE — COMMAND_REJECTION",
        received: command ?? null,
        valid_commands: VALID_COMMANDS,
      }, { status: 400 });
    }

    // ── CMD_10: Health check (no signals required) ───────────────────────────
    if (command === "CMD_10_HEALTH_CHECK") {
      return NextResponse.json(await runCMD10());
    }

    // ── All other commands require signals ────────────────────────────────────
    if (!signals) {
      return NextResponse.json({
        error: "INVALID_INPUT",
        message: "A 'signals' object is required for all commands except CMD_10_HEALTH_CHECK.",
      }, { status: 400 });
    }

    // Normalize input (bridge engine.js format ↔ new API format)
    const n = normalizeSignals(signals);

    // ── Route to correct command ──────────────────────────────────────────────
    switch (command as ZenoCommand) {

      case "CMD_01_CLASSIFY_VISITOR":
        return NextResponse.json(runCMD01(n));

      case "CMD_02_SCORE_INTENT":
        return NextResponse.json(runCMD02(n));

      case "CMD_03_DETECT_FRICTION":
        return NextResponse.json(runCMD03(n));

      case "CMD_04_EVALUATE_TRIGGER": {
        const intent = runCMD02(n);
        return NextResponse.json(runCMD04(n, intent.intent_score));
      }

      case "CMD_05_SELECT_ACTION": {
        const c01 = runCMD01(n);
        const c02 = runCMD02(n);
        const c03 = runCMD03(n);
        const c04 = runCMD04(n, c02.intent_score);
        const c05 = runCMD05(
          c01.visitor_type as VisitorType,
          c03.friction_type as FrictionType,
          c02.intent_score,
          c04.should_intervene
        );
        return NextResponse.json({ command: "CMD_05_SELECT_ACTION", visitor_type: c01.visitor_type, intent: c02.intent, friction_type: c03.friction_type, ...c05 });
      }

      case "CMD_06_COMPUTE_UPLIFT": {
        const c01 = runCMD01(n);
        const c02 = runCMD02(n);
        const c03 = runCMD03(n);
        const c04 = runCMD04(n, c02.intent_score);
        const c05 = runCMD05(c01.visitor_type as VisitorType, c03.friction_type as FrictionType, c02.intent_score, c04.should_intervene);
        return NextResponse.json(runCMD06(c05.selected_action as ZenoAction, c01.conversion_probability, n.aov_estimate));
      }

      case "CMD_07_CALIBRATE_CONFIDENCE": {
        const c02 = runCMD02(n);
        const c01 = runCMD01(n);
        const c03 = runCMD03(n);
        const c04 = runCMD04(n, c02.intent_score);
        const c05 = runCMD05(c01.visitor_type as VisitorType, c03.friction_type as FrictionType, c02.intent_score, c04.should_intervene);
        const storeDomain = n.current_url ? (() => { try { return new URL(n.current_url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })() : "unknown";
        return NextResponse.json(await runCMD07(storeDomain, c05.selected_action as ZenoAction, n, c02.intent_score));
      }

      case "CMD_08_AUDIT_SESSION": {
        const c01 = runCMD01(n);
        const c02 = runCMD02(n);
        const c03 = runCMD03(n);
        const c04 = runCMD04(n, c02.intent_score);
        return NextResponse.json(runCMD08(n, c01.visitor_type as VisitorType, c02, c03, c04));
      }

      case "CMD_09_RETURN_DECISION":
        return NextResponse.json(await runCMD09(n));

      default:
        return NextResponse.json({ error: "OUT_OF_SCOPE — COMMAND_REJECTION" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("[zeno/command] Critical error:", err.message);
    return NextResponse.json({
      error:         "ENGINE_ERROR",
      message:       "ZENO analysis failed. No action taken. Safe fallback engaged.",
      decision:      "do_nothing",
      economic_decision: "wait",
    }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET — Command Registry (Read-only manifest)
// ══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    system:         "ZENO Command System v2.0",
    role:           "Behavioral Intelligence Processor — Analyze → Interpret → Decide → Return",
    law:            "ZENO does NOT modify scripts, architecture, or business logic. It ONLY processes behavioral data.",
    out_of_scope:   "OUT_OF_SCOPE — COMMAND_REJECTION",
    commands: [
      { id: "CMD_01_CLASSIFY_VISITOR",     layer: "Identity",    description: "Classify visitor type: CONVERTER | HOT_HESITATOR | INTERESTED_EXPLORER | PASSIVE_BROWSER | EXIT_RISK" },
      { id: "CMD_02_SCORE_INTENT",         layer: "Intent",      description: "Score purchase intent 0–99 with full signal breakdown and base CVR" },
      { id: "CMD_03_DETECT_FRICTION",      layer: "Friction",    description: "Locate friction stage and type: checkout_block | cart_abandonment | bounce_risk | ..." },
      { id: "CMD_04_EVALUATE_TRIGGER",     layer: "Trigger",     description: "Evaluate trigger strength and whether intervention is economically justified" },
      { id: "CMD_05_SELECT_ACTION",        layer: "Action",      description: "Select optimal action from catalog based on type × friction × intent matrix" },
      { id: "CMD_06_COMPUTE_UPLIFT",       layer: "Economics",   description: "Calculate P(convert), uplift, revenue impact, and ROI for selected action" },
      { id: "CMD_07_CALIBRATE_CONFIDENCE", layer: "Confidence",  description: "Measure system confidence using signal strength + historical DB accuracy" },
      { id: "CMD_08_AUDIT_SESSION",        layer: "Audit",       description: "Full behavioral snapshot — all signals, classifications, and friction data" },
      { id: "CMD_09_RETURN_DECISION",      layer: "Decision",    description: "FINAL output: runs full pipeline and returns the ONE signal NOLIX executes" },
      { id: "CMD_10_HEALTH_CHECK",         layer: "System",      description: "Engine health and DB readiness check — no signals required" },
    ],
    input_format: {
      new_api:    { command: "CMD_XX_NAME", signals: { time_on_page: 0, page_views: 0, scroll_depth: 0, clicks: 0, product_views: 0, add_to_cart: false, checkout_started: false, return_visits: 0, session_duration: 0 } },
      engine_js:  { command: "CMD_XX_NAME", signals: { session_id: "z_xxx", trigger: "exit_intent", time_on_site: 0, pages_viewed: 0, scroll_depth: 0, cart_status: "empty", hesitations: 0 } },
    },
    output_contract: {
      always_present: ["command", "decision"],
      decision_values: ["do_nothing", "urgency", "popup_info", "free_shipping", "bundle", "discount_5", "discount_10", "discount_15"],
    },
  });
}
