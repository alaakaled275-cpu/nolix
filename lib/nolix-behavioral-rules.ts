/**
 * NOLIX — Behavioral Rules Engine (Hybrid Decision Brain - Layer 1)
 * lib/nolix-behavioral-rules.ts
 *
 * ⚔️ ZENO ARCHITECTURE LAW:
 * Behavioral Rules = PRIMARY DRIVER of every decision.
 * ML = Secondary signal enhancer.
 * ML never controls. Behavior always leads.
 *
 * This file owns ALL rule-based behavioral logic.
 * Rules are explicit, auditable, and tunable by humans.
 * They do NOT depend on ML. They run even if ML is down.
 *
 * Rules evaluate:
 *   1. Intent level (how likely to buy)
 *   2. Friction level (what's blocking them)
 *   3. Context (timing, trigger, segment)
 *   4. Intervention eligibility (should we even try?)
 */

import { NolixSignalV1 } from "./nolix-signal-schema";

// ── Output types ──────────────────────────────────────────────────────────────
export type IntentLevel  = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type FrictionType = "PRICE" | "TRUST" | "URGENCY" | "INDECISION" | "NONE";

export interface BehavioralAssessment {
  // Primary outputs
  intent:          IntentLevel;
  friction:        FrictionType;
  friction_present: boolean;

  // Scoring breakdown
  intent_score:    number;   // 0.0–1.0 behavioral intent probability
  friction_score:  number;   // 0.0–1.0 friction severity

  // Derived insights
  is_bot_suspect:  boolean;
  is_exit_risk:    boolean;
  is_high_value:   boolean;
  engagement_depth: "deep" | "medium" | "shallow" | "none";

  // Action eligibility (rule-based gate before ML boost)
  eligible_for_intervention: boolean;
  ineligible_reason?:        string;

  // Rule audit trail
  rules_fired:    string[];   // which rules contributed
  weights_applied: Record<string, number>;
}

// ── Rule weights (explicit, tunable, documented) ───────────────────────────────
const RULE_WEIGHTS = {
  // Intent positive signals
  checkout_started:  0.40,   // strongest intent signal
  product_viewed_5:  0.12,   // deep product exploration
  product_viewed_3:  0.07,   // moderate exploration
  time_deep:         0.10,   // >120s = serious consideration
  time_medium:       0.05,   // 45-120s = engaged
  pages_deep:        0.08,   // >5 pages = exploration mode
  pages_medium:      0.04,   // 3-5 pages = browsing
  scroll_deep:       0.06,   // scrolled >75% = reading content
  scroll_medium:     0.03,   // scrolled >40%
  high_clicks:       0.05,   // >10 clicks = active engagement
  return_visitor:    0.10,   // already knows the brand

  // Friction signals (negative pressure on organic conversion)
  hesitation_high:  -0.12,   // >3 hesitations = high friction
  hesitation_medium:-0.05,   // 1-3 hesitations = moderate friction
  exit_risk:        -0.08,   // mouse leaving + tab switching
  rapid_navigation: -0.04,   // too-fast page jumps = not reading
} as const;

// ── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  CRITICAL_INTENT: 0.75,
  HIGH_INTENT:     0.55,
  MEDIUM_INTENT:   0.30,
  BOT_TIME_MAX:    1.5,   // under 1.5s time_on_page with >2 pages = bot
  EXIT_RISK_CLICKS: 0,   // 0 clicks after X time = exit risk
  INELIGIBLE_BOT_PAGES: 3  // >3 pages in <1.5s = bot
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: ASSESS BEHAVIORAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
export function assessBehavior(
  signal:          NolixSignalV1,
  extra: {
    hesitations?:       number;
    return_visitor?:    boolean;
    mouse_leave_count?: number;
    tab_hidden_count?:  number;
    trigger?:           string;
    coupon_abuse?:      number;
    visit_count?:       number;
  } = {}
): BehavioralAssessment {
  const rules:   string[] = [];
  const weights: Record<string, number> = {};
  let   score    = 0.03;  // empirical cold traffic baseline CVR

  // ── RULE: Bot detection (HARD BLOCK) ─────────────────────────────────────
  const isBotSuspect =
    signal.time_on_page < THRESHOLDS.BOT_TIME_MAX &&
    signal.page_views   > THRESHOLDS.INELIGIBLE_BOT_PAGES;

  if (isBotSuspect) {
    rules.push("BOT_SUSPECT: time<1.5s + pages>3");
    return {
      intent: "NONE", friction: "NONE", friction_present: false,
      intent_score: 0, friction_score: 0,
      is_bot_suspect: true, is_exit_risk: false, is_high_value: false,
      engagement_depth: "none",
      eligible_for_intervention: false,
      ineligible_reason: "BOT_SUSPECT",
      rules_fired: rules, weights_applied: {}
    };
  }

  // ── RULE: Fraud / coupon abuse (HARD BLOCK) ───────────────────────────────
  const abuseLevel = extra.coupon_abuse || 0;
  if (abuseLevel >= 3) {
    rules.push("FRAUD_BLOCK: abuse_severity>=3");
    return {
      intent: "NONE", friction: "NONE", friction_present: false,
      intent_score: 0, friction_score: 0,
      is_bot_suspect: false, is_exit_risk: false, is_high_value: false,
      engagement_depth: "none",
      eligible_for_intervention: false,
      ineligible_reason: "COUPON_ABUSE_BLOCKED",
      rules_fired: rules, weights_applied: {}
    };
  }

  // ── RULE: Checkout started (critical intent) ──────────────────────────────
  if (signal.checkout_started) {
    score += RULE_WEIGHTS.checkout_started;
    weights.checkout_started = RULE_WEIGHTS.checkout_started;
    rules.push("checkout_started: +0.40");
  }

  // ── RULE: Product exploration depth ──────────────────────────────────────
  if (signal.product_views >= 5) {
    score += RULE_WEIGHTS.product_viewed_5;
    weights.product_viewed_5 = RULE_WEIGHTS.product_viewed_5;
    rules.push("product_views>=5: +0.12");
  } else if (signal.product_views >= 3) {
    score += RULE_WEIGHTS.product_viewed_3;
    weights.product_viewed_3 = RULE_WEIGHTS.product_viewed_3;
    rules.push("product_views>=3: +0.07");
  }

  // ── RULE: Time investment ─────────────────────────────────────────────────
  if (signal.time_on_page > 120) {
    score += RULE_WEIGHTS.time_deep;
    weights.time_deep = RULE_WEIGHTS.time_deep;
    rules.push("time_on_page>120s: +0.10");
  } else if (signal.time_on_page > 45) {
    score += RULE_WEIGHTS.time_medium;
    weights.time_medium = RULE_WEIGHTS.time_medium;
    rules.push("time_on_page>45s: +0.05");
  }

  // ── RULE: Page exploration ────────────────────────────────────────────────
  if (signal.page_views > 5) {
    score += RULE_WEIGHTS.pages_deep;
    weights.pages_deep = RULE_WEIGHTS.pages_deep;
    rules.push("page_views>5: +0.08");
  } else if (signal.page_views > 2) {
    score += RULE_WEIGHTS.pages_medium;
    weights.pages_medium = RULE_WEIGHTS.pages_medium;
    rules.push("page_views>2: +0.04");
  }

  // ── RULE: Scroll depth ────────────────────────────────────────────────────
  if (signal.scroll_depth > 0.75) {
    score += RULE_WEIGHTS.scroll_deep;
    weights.scroll_deep = RULE_WEIGHTS.scroll_deep;
    rules.push("scroll_depth>0.75: +0.06");
  } else if (signal.scroll_depth > 0.40) {
    score += RULE_WEIGHTS.scroll_medium;
    weights.scroll_medium = RULE_WEIGHTS.scroll_medium;
    rules.push("scroll_depth>0.40: +0.03");
  }

  // ── RULE: Click engagement ────────────────────────────────────────────────
  if (signal.clicks > 10) {
    score += RULE_WEIGHTS.high_clicks;
    weights.high_clicks = RULE_WEIGHTS.high_clicks;
    rules.push("clicks>10: +0.05");
  }

  // ── RULE: Return visitor ──────────────────────────────────────────────────
  if (extra.return_visitor) {
    score += RULE_WEIGHTS.return_visitor;
    weights.return_visitor = RULE_WEIGHTS.return_visitor;
    rules.push("return_visitor: +0.10");
  }

  // ── RULE: Hesitation signals ──────────────────────────────────────────────
  const hesitations = extra.hesitations || 0;
  if (hesitations > 3) {
    score += RULE_WEIGHTS.hesitation_high;
    weights.hesitation_high = RULE_WEIGHTS.hesitation_high;
    rules.push("hesitations>3: -0.12");
  } else if (hesitations > 1) {
    score += RULE_WEIGHTS.hesitation_medium;
    weights.hesitation_medium = RULE_WEIGHTS.hesitation_medium;
    rules.push("hesitations>1: -0.05");
  }

  // ── RULE: Exit signals ────────────────────────────────────────────────────
  const isExitRisk = (extra.mouse_leave_count || 0) > 2 || (extra.tab_hidden_count || 0) > 1;
  if (isExitRisk) {
    score += RULE_WEIGHTS.exit_risk;
    weights.exit_risk = RULE_WEIGHTS.exit_risk;
    rules.push("exit_risk (mouse/tab): -0.08");
  }

  // ── RULE: Rapid navigation (bot-adjacent behavior) ─────────────────────────
  if (signal.time_on_page < 5 && signal.page_views > 3) {
    score += RULE_WEIGHTS.rapid_navigation;
    weights.rapid_navigation = RULE_WEIGHTS.rapid_navigation;
    rules.push("rapid_navigation: -0.04");
  }

  // ── Clamp score ───────────────────────────────────────────────────────────
  const intentScore = Math.max(0.01, Math.min(0.98, score));

  // ── Classify intent level ─────────────────────────────────────────────────
  const intent: IntentLevel =
    intentScore >= THRESHOLDS.CRITICAL_INTENT ? "CRITICAL" :
    intentScore >= THRESHOLDS.HIGH_INTENT     ? "HIGH"     :
    intentScore >= THRESHOLDS.MEDIUM_INTENT   ? "MEDIUM"   :
    intentScore >  0.05                        ? "LOW"      : "NONE";

  // ── Classify friction type ────────────────────────────────────────────────
  let friction: FrictionType = "NONE";
  let frictionScore = 0;

  if (hesitations > 3 || isExitRisk) {
    // Multiple exit signals + hesitations = price friction
    frictionScore = Math.min(1.0, (hesitations * 0.15) + (isExitRisk ? 0.25 : 0));
    if (intentScore > 0.30 && hesitations > 3) friction = "PRICE";
    else if (isExitRisk)                       friction = "URGENCY";
    else                                       friction = "INDECISION";
  } else if (intentScore > 0.30 && signal.page_views > 4 && !signal.checkout_started) {
    friction = "INDECISION";
    frictionScore = 0.30;
    rules.push("friction=INDECISION: browsing without checkout");
  } else if (intentScore > 0.40 && (extra.return_visitor || false) && hesitations > 1) {
    friction = "TRUST";
    frictionScore = 0.35;
    rules.push("friction=TRUST: return visitor with hesitation");
  }

  // ── Engagement depth ──────────────────────────────────────────────────────
  const engagementDepth: BehavioralAssessment["engagement_depth"] =
    signal.time_on_page > 120 && signal.page_views > 5 ? "deep"    :
    signal.time_on_page > 30  && signal.page_views > 2 ? "medium"  :
    signal.time_on_page > 5   || signal.page_views > 1 ? "shallow" : "none";

  // ── High-value visitor ────────────────────────────────────────────────────
  const isHighValue = (extra.visit_count || 0) >= 3 && abuseLevel === 0;

  // ── Intervention eligibility (pure rule gate, no ML) ──────────────────────
  let eligibleForIntervention = true;
  let ineligibleReason: string | undefined;

  if (intent === "NONE") {
    eligibleForIntervention = false;
    ineligibleReason = "INTENT_TOO_LOW";
  } else if (abuseLevel >= 2) {
    eligibleForIntervention = false;
    ineligibleReason = "ABUSE_RISK";
  } else if (engagementDepth === "none") {
    eligibleForIntervention = false;
    ineligibleReason = "NO_ENGAGEMENT";
  }

  return {
    intent,
    friction,
    friction_present: friction !== "NONE",
    intent_score:     Math.round(intentScore * 10000) / 10000,
    friction_score:   Math.round(frictionScore * 10000) / 10000,
    is_bot_suspect:   false,
    is_exit_risk:     isExitRisk,
    is_high_value:    isHighValue,
    engagement_depth: engagementDepth,
    eligible_for_intervention: eligibleForIntervention,
    ineligible_reason: ineligibleReason,
    rules_fired:      rules,
    weights_applied:  weights
  };
}
