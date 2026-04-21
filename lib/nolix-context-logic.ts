/**
 * NOLIX — Context Logic Engine (Hybrid Decision Brain - Layer 2)
 * lib/nolix-context-logic.ts
 *
 * ⚔️ ARCHITECTURE ROLE: Layer 2 modulator.
 * Context enriches the behavioral assessment BEFORE ML is consulted.
 * Context narrows down which interventions make sense given the situation.
 *
 * Context factors:
 *   - Trigger type (what caused ZENO to evaluate)
 *   - Visitor segment (K-Means cluster: loyal/price-sensitive/etc.)
 *   - Store context (AOV, store type)
 *   - Temporal context (day/hour patterns)
 *   - Session recency (cold vs warm session)
 *
 * Output: ActionCandidate[] — ordered list of eligible interventions
 * BEFORE ML boost is applied.
 */

import { IntentLevel, FrictionType, BehavioralAssessment } from "./nolix-behavioral-rules";

// ── Types ─────────────────────────────────────────────────────────────────────
export type TriggerType =
  | "exit_intent"
  | "checkout_intent"
  | "scroll_bottom"
  | "time_threshold"
  | "product_hover"
  | "idle"
  | "direct";

export type VisitorSegmentLabel =
  | "high_intent"
  | "price_sensitive"
  | "loyal"
  | "bouncer"
  | "window_shopper"
  | "unknown";

export interface ActionCandidate {
  action:             string;
  base_priority:      number;       // 0.0–1.0 before ML boost
  enhanced_priority?: number;       // 0.0–1.0 after ML boost (set by hybrid brain)
  economic_cost:      number;       // relative cost (0.0–1.0)
  reasoning:          string;       // why this action was selected
  requires_ml_confirm: boolean;     // if true, ML boost must be >0 to proceed
}

export interface ContextDecision {
  eligible_actions: ActionCandidate[];
  context_modifiers: Record<string, number>;  // what context changed
  should_observe:    boolean;    // if context says "don't intervene now"
  observe_reason?:   string;
}

// ── Action catalog with costs and rules ───────────────────────────────────────
const ACTION_CATALOG: Record<string, { cost: number; label: string }> = {
  urgency:        { cost: 0.05, label: "Urgency message"           },
  popup_info:     { cost: 0.05, label: "Trust/info popup"          },
  free_shipping:  { cost: 0.15, label: "Free shipping offer"       },
  bundle:         { cost: 0.10, label: "Bundle suggestion"         },
  discount_5:     { cost: 0.30, label: "5% discount"               },
  discount_10:    { cost: 0.50, label: "10% discount"              },
  discount_15:    { cost: 0.70, label: "15% discount"               }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: CONTEXT DECISION
// ═══════════════════════════════════════════════════════════════════════════════
export function applyContextLogic(
  behavior:  BehavioralAssessment,
  context: {
    trigger:           TriggerType;
    segment:           VisitorSegmentLabel;
    aov_estimate:      number;    // average order value in $
    visit_count:       number;
    store_type?:       "fashion" | "electronics" | "food" | "general";
    hour_of_day?:      number;    // 0-23
    days_since_visit?: number;
  }
): ContextDecision {
  const modifiers: Record<string, number> = {};
  const candidates: ActionCandidate[] = [];

  // ── GATE: If behavior already blocked intervention ────────────────────────
  if (!behavior.eligible_for_intervention) {
    return {
      eligible_actions: [],
      context_modifiers: {},
      should_observe: true,
      observe_reason: behavior.ineligible_reason || "BEHAVIORAL_GATE_BLOCKED"
    };
  }

  // ── CONTEXT MODIFIER 1: Trigger type ─────────────────────────────────────
  let triggerMultiplier = 1.0;
  if (context.trigger === "exit_intent") {
    triggerMultiplier = 1.25;  // exit intent = higher urgency
    modifiers.trigger_exit = 0.25;
  } else if (context.trigger === "checkout_intent") {
    triggerMultiplier = 1.40;  // strongest trigger
    modifiers.trigger_checkout = 0.40;
  } else if (context.trigger === "idle") {
    triggerMultiplier = 0.80;  // idle = lower signal quality
    modifiers.trigger_idle = -0.20;
  }

  // ── CONTEXT MODIFIER 2: Segment ──────────────────────────────────────────
  let segmentFavoredActions: string[] = [];
  if (context.segment === "price_sensitive") {
    segmentFavoredActions = ["discount_5", "discount_10", "free_shipping"];
    modifiers.segment_price_sensitive = 0.15;
  } else if (context.segment === "loyal") {
    segmentFavoredActions = ["bundle", "popup_info", "free_shipping"];
    modifiers.segment_loyal = 0.10;
  } else if (context.segment === "high_intent") {
    segmentFavoredActions = ["urgency", "discount_5", "free_shipping"];
    modifiers.segment_high_intent = 0.20;
  } else if (context.segment === "bouncer") {
    // Bouncers rarely convert — conservative approach
    modifiers.segment_bouncer = -0.15;
    return {
      eligible_actions: [
        { action: "popup_info", base_priority: 0.20, economic_cost: 0.05, reasoning: "Bouncer segment: info only, no discount risk", requires_ml_confirm: true }
      ],
      context_modifiers: modifiers,
      should_observe:    false
    };
  } else if (context.segment === "window_shopper") {
    segmentFavoredActions = ["urgency", "popup_info"];
    modifiers.segment_window_shopper = -0.05;
  }

  // ── CONTEXT MODIFIER 3: AOV-based discount eligibility ───────────────────
  // Don't give 15% on a $10 AOV store — margin logic
  const highValueDiscount = context.aov_estimate > 80;
  const midValueDiscount  = context.aov_estimate > 40;

  // ── CONTEXT MODIFIER 4: Time of day ──────────────────────────────────────
  const hour = context.hour_of_day ?? new Date().getHours();
  if (hour >= 22 || hour <= 6) {
    // Night browsing = higher purchase intent (they're not casually browsing)
    modifiers.night_session = 0.10;
  }

  // ── CONTEXT MODIFIER 5: Return visitor recency ────────────────────────────
  if ((context.days_since_visit || 0) > 7) {
    // More than a week ago = re-engagement, softer approach
    modifiers.cold_return = -0.10;
  }

  // ── BUILD ACTION CANDIDATES based on intent + friction + context ──────────
  const basePriority = behavior.intent_score * triggerMultiplier;

  // CRITICAL intent: offer real value immediately
  if (behavior.intent === "CRITICAL") {
    if (highValueDiscount) {
      candidates.push({ action: "discount_10", base_priority: basePriority * 0.90, economic_cost: 0.50, reasoning: `CRITICAL intent + AOV>$80 → 10% discount justified`, requires_ml_confirm: false });
    } else if (midValueDiscount) {
      candidates.push({ action: "discount_5", base_priority: basePriority * 0.85, economic_cost: 0.30, reasoning: `CRITICAL intent + AOV>$40 → 5% discount justified`, requires_ml_confirm: false });
    }
    candidates.push({ action: "free_shipping", base_priority: basePriority * 0.80, economic_cost: 0.15, reasoning: "CRITICAL intent: free shipping reduces checkout friction", requires_ml_confirm: false });
    candidates.push({ action: "urgency", base_priority: basePriority * 0.70, economic_cost: 0.05, reasoning: "CRITICAL intent: urgency nudge", requires_ml_confirm: false });
  }

  // HIGH intent: friction determines action type
  if (behavior.intent === "HIGH") {
    if (behavior.friction === "PRICE") {
      if (midValueDiscount) {
        candidates.push({ action: "discount_5", base_priority: basePriority * 0.80, economic_cost: 0.30, reasoning: "HIGH intent + PRICE friction → small discount to remove barrier", requires_ml_confirm: false });
      }
      candidates.push({ action: "free_shipping", base_priority: basePriority * 0.75, economic_cost: 0.15, reasoning: "PRICE friction: free shipping softens price sensitivity", requires_ml_confirm: false });
    } else if (behavior.friction === "TRUST") {
      candidates.push({ action: "popup_info", base_priority: basePriority * 0.85, economic_cost: 0.05, reasoning: "HIGH intent + TRUST friction → info popup builds confidence", requires_ml_confirm: false });
    } else if (behavior.friction === "URGENCY") {
      candidates.push({ action: "urgency", base_priority: basePriority * 0.85, economic_cost: 0.05, reasoning: "HIGH intent + URGENCY friction → create time pressure", requires_ml_confirm: false });
    } else if (behavior.friction === "INDECISION") {
      candidates.push({ action: "bundle", base_priority: basePriority * 0.70, economic_cost: 0.10, reasoning: "HIGH intent + INDECISION → bundle offer clarifies value", requires_ml_confirm: true });
      candidates.push({ action: "popup_info", base_priority: basePriority * 0.75, economic_cost: 0.05, reasoning: "HIGH intent + INDECISION → additional product info", requires_ml_confirm: true });
    } else {
      // No friction: just a gentle nudge
      candidates.push({ action: "urgency", base_priority: basePriority * 0.65, economic_cost: 0.05, reasoning: "HIGH intent, no friction → light urgency nudge", requires_ml_confirm: true });
    }
    // High-value customers always get free shipping offer
    if (behavior.is_high_value) {
      candidates.push({ action: "free_shipping", base_priority: basePriority * 0.80, economic_cost: 0.15, reasoning: "HIGH value visitor → loyalty reward", requires_ml_confirm: false });
    }
  }

  // MEDIUM intent: very conservative, ML must confirm
  if (behavior.intent === "MEDIUM") {
    if (behavior.friction_present) {
      candidates.push({ action: "popup_info", base_priority: basePriority * 0.50, economic_cost: 0.05, reasoning: "MEDIUM intent + friction → low-cost info only", requires_ml_confirm: true });
    } else {
      // No friction, medium intent = observe unless ML strongly confirms
      candidates.push({ action: "urgency", base_priority: basePriority * 0.30, economic_cost: 0.05, reasoning: "MEDIUM intent, no friction → ultra-light nudge, ML must confirm", requires_ml_confirm: true });
    }
  }

  // LOW/NONE intent: no intervention candidates
  if (behavior.intent === "LOW" || behavior.intent === "NONE") {
    return {
      eligible_actions: [],
      context_modifiers: modifiers,
      should_observe: true,
      observe_reason: `INTENT_${behavior.intent}: no intervention justified without stronger signals`
    };
  }

  // ── Boost segment-favored actions ─────────────────────────────────────────
  candidates.forEach(c => {
    if (segmentFavoredActions.includes(c.action)) {
      c.base_priority = Math.min(0.98, c.base_priority * 1.15);
      c.reasoning += ` [segment:${context.segment}]`;
    }
  });

  // Sort by priority (desc), deduplicate actions
  const seen = new Set<string>();
  const unique = candidates
    .sort((a, b) => b.base_priority - a.base_priority)
    .filter(c => {
      if (seen.has(c.action)) return false;
      seen.add(c.action);
      return true;
    });

  return {
    eligible_actions:  unique,
    context_modifiers: modifiers,
    should_observe:    unique.length === 0
  };
}
