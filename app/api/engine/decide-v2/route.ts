/**
 * NOLIX — Hybrid Brain Decide API v2 (EVENT-DRIVEN INTELLIGENCE SYSTEM)
 * app/api/engine/decide-v2/route.ts
 *
 * ⚔️ ZENO HYBRID BRAIN ARCHITECTURE:
 *
 *   ZENO = Commander (Behavioral Rules + Context Logic)
 *   ML   = Intelligence Advisor (Signal Enhancer — secondary only)
 *
 * ⚔️ EVENT SYSTEM (STEP 1 — Event Foundation Layer):
 *
 *   Every request produces 3 events in nolix_events:
 *     1. behavior  — raw behavioral assessment result
 *     2. ml        — ML signal contribution (or skip reason)
 *     3. decision  — final ZENO decision with full trace
 *
 *   Every event has a trace_id for cross-service correlation.
 *   Events are IMMUTABLE — never updated, only appended.
 *
 * ⚔️ 6 LAWS (enforced in nolix-hybrid-brain.ts):
 *   1. ML NEVER intervenes when behavioral gate = BLOCKED
 *   2. ML NEVER triggers action when intent = NONE or LOW
 *   3. ML score alone NEVER triggers any action
 *   4. ML boost is additive only, capped at +0.20
 *   5. Economic gate is ALWAYS the final authority
 *   6. do_nothing is a valid decision — not a fallback
 *
 * POST /api/engine/decide-v2
 * GET  /api/engine/decide-v2  → Brain architecture + laws
 */

import { NextRequest, NextResponse }     from "next/server";
import { runHybridBrain }                from "@/lib/nolix-hybrid-brain";
import { normalizeSignal }               from "@/lib/nolix-signal-normalizer";
import { validateSignal }                from "@/lib/nolix-signal-validator";
import { getAccessTier, requireTier, checkRateLimit, getClientId } from "@/lib/nolix-security";
import { recordOutcome }                 from "@/lib/nolix-circuit-breaker";
import { query }                         from "@/lib/db";
import {
  emitDecisionEvent,
  emitBehaviorEvent,
  emitMLEvent,
  emitSystemEvent
}                                        from "@/lib/nolix-event-system";
import { logger }                        from "@/lib/nolix-structured-logger";
import {
  captureDecisionSnapshot,
  saveSnapshot
} from "@/lib/nolix-intelligence-snapshot-engine";
import { computeDecisionMetrics, storeDecisionMetrics } from "@/lib/nolix-metrics-engine";
import { logDecisionOutcomePlaceholder } from "@/lib/nolix-effectiveness";
import { markStepCompleted } from "@/lib/nolix-onboarding-engine";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────
const RULES_VERSION = "v1.0.0";

// ── Popup content catalog ─────────────────────────────────────────────────────
const POPUP_CONTENT: Record<string, { headline: string; sub: string; cta: string }> = {
  urgency:       { headline: "Don't miss out!",        sub: "Your items are reserved — act while stock lasts.",           cta: "Secure My Order"      },
  popup_info:    { headline: "You're in good hands.",  sub: "Trusted by thousands of shoppers. 100% satisfaction.",       cta: "Continue Shopping"    },
  free_shipping: { headline: "Free Shipping Unlocked!",sub: "Complete your order today — we'll ship it free.",            cta: "Apply Free Shipping"  },
  bundle:        { headline: "Bundle & Save",          sub: "Get more for less — our top bundle is waiting for you.",     cta: "See Bundle Deal"      },
  discount_5:    { headline: "Here's 5% Off",          sub: "A small gift for you — just for visiting today.",            cta: "Apply 5% Discount"    },
  discount_10:   { headline: "10% Off — Limited",      sub: "Complete your order now and save 10%.",                      cta: "Apply 10% Discount"   },
  discount_15:   { headline: "Flash Deal: 15% Off",    sub: "A rare 15% discount just unlocked for this session.",       cta: "Apply 15% Discount"   },
};

// ── POST: Main decision endpoint ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const start    = Date.now();
  const key      = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  const tier     = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl       = checkRateLimit(clientId, "predict");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded", reset_at: rl.reset_at }, { status: 429 });

  let succeeded = false;
  let trace_id  = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const body = await req.json().catch(() => ({}));

    // ── Normalize + Validate signal ───────────────────────────────────────────
    const signal     = normalizeSignal(body);
    const validation = validateSignal(signal);

    if (!validation.valid) {
      logger.warn("engine", "Signal validation failed", { errors: validation.errors });
      return NextResponse.json({
        error:   "SIGNAL_INVALID",
        errors:  validation.errors,
        action:  "do_nothing",
        version: "v2"
      }, { status: 422 });
    }

    // ── Build brain input ──────────────────────────────────────────────────────
    const trigger     = (body.trigger   || "direct")  as any;
    const segment     = (body.segment   || "unknown") as any;
    const aovEstimate = Number(body.aov_estimate || 65);

    // ── RUN HYBRID BRAIN ──────────────────────────────────────────────────────
    const decision = await runHybridBrain({
      signal,
      trigger,
      segment,
      aov_estimate:      aovEstimate,
      visit_count:       Number(body.visit_count || 1),
      coupon_abuse:      Number(body.coupon_abuse || body.coupon_abuse_severity || 0),
      return_visitor:    Boolean(body.return_visitor),
      hesitations:       Number(body.hesitations || 0),
      mouse_leave_count: Number(body.mouse_leave_count || 0),
      tab_hidden_count:  Number(body.tab_hidden_count || 0),
      store_type:        body.store_type
    });

    // Use the brain's trace_id as the correlation ID for ALL events
    trace_id = decision.trace_id;

    // ── Record to circuit breaker ──────────────────────────────────────────────
    succeeded = true;
    recordOutcome(true, Date.now() - start);
    const latency_ms = Date.now() - start;

    // ══════════════════════════════════════════════════════════════════════════
    // EVENT STREAM — All 3 events fire async and non-blocking
    // Every decision produces: behavior → ml → decision
    // ══════════════════════════════════════════════════════════════════════════

    // EVENT 1: Behavioral Assessment
    emitBehaviorEvent(trace_id, signal.visitor_id, {
      intent:               decision.behavior.intent,
      intent_score:         decision.behavior.intent_score,
      friction:             decision.behavior.friction,
      friction_present:     decision.behavior.friction_present,
      engagement_depth:     decision.behavior.engagement_depth,
      is_exit_risk:         decision.behavior.is_exit_risk,
      is_bot_suspect:       decision.behavior.is_bot_suspect,
      is_high_value:        decision.behavior.is_high_value || false,
      rules_fired:          decision.behavior.rules_fired,
      intervention_eligible: !decision.behavior.is_bot_suspect
    }).catch(() => {});

    // EVENT 2: ML Signal
    emitMLEvent(trace_id, signal.visitor_id, {
      ml_score:   decision.final_score,
      ml_boost:   decision.ml_boost,
      model_used: "hybrid_brain_v1",
      skipped:    !decision.ml_used,
      skip_reason: !decision.ml_used ? "behavioral-only path" : undefined,
      latency_ms
    }).catch(() => {});

    // EVENT 3: Final Decision (primary intelligence event)
    emitDecisionEvent(trace_id, signal.visitor_id, {
      intent:             decision.behavior.intent,
      friction:           decision.behavior.friction,
      ml_boost:           decision.ml_boost,
      final_score:        decision.final_score,
      action:             decision.action,
      recommended_popup:  decision.recommended_popup,
      discount_pct:       decision.discount_pct,
      reasoning:          decision.behavior.rules_fired,
      decision_path:      decision.decision_path,
      rules_version:      RULES_VERSION,
      economic_justified: decision.economic_justified,
      expected_uplift:    decision.expected_uplift,
      latency_ms
    }).catch(() => {});

    // ── Structured logger ─────────────────────────────────────────────────────
    logger.decision(trace_id, decision.action, decision.behavior.intent, latency_ms);

    // ══════════════════════════════════════════════════════════════════════════
    // PERSISTENCE — nolix_decisions (full record with decision_path)
    // ══════════════════════════════════════════════════════════════════════════
    query(
      `INSERT INTO nolix_decisions
         (trace_id, visitor_id, intent, friction, ml_boost, final_score, action, rules_version, reasoning, decision_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        trace_id,
        signal.visitor_id,
        decision.behavior.intent,
        decision.behavior.friction,
        decision.ml_boost,
        decision.final_score,
        decision.action,
        RULES_VERSION,
        JSON.stringify(decision.behavior.rules_fired),
        JSON.stringify(decision.decision_path)
      ]
    ).catch(() => {});

    // ── Learning loop — save impression (async, non-blocking) ─────────────────
    if (decision.action === "show_popup" && decision.recommended_popup) {
      _saveImpression(signal.visitor_id, signal.session_id, signal.store_domain, decision).catch(() => {});
    }

    // ── Build popup content ────────────────────────────────────────────────────
    const popup = decision.recommended_popup
      ? (POPUP_CONTENT[decision.recommended_popup] || POPUP_CONTENT.urgency)
      : null;

    // ══════════════════════════════════════════════════════════════════════════
    // COMMAND 01 — CAPTURE FULL INTELLIGENCE STATE SNAPSHOT
    // Every decision = immutable frozen mental state of ZENO
    // NO decision is valid without a snapshot (enforced here)
    // ══════════════════════════════════════════════════════════════════════════
    const snapshot = captureDecisionSnapshot({
      signal:       body,
      trigger:      trigger,
      segment:      segment,
      aov_estimate: aovEstimate,
      store_type:   body.store_type,
      brain:        decision,
      popup_content: popup || undefined
    });

    // Persist snapshot immutably (non-blocking — never crashes decision)
    saveSnapshot(snapshot).catch(() => {
      logger.warn("engine", "Snapshot save failed (non-fatal)", { trace_id }, trace_id);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // COMMAND 03 — DECISION METRICS ENGINE
    // ══════════════════════════════════════════════════════════════════════════
    const metricsBuf = computeDecisionMetrics({
      trace_id,
      start_time: start,
      ml_boost: decision.ml_boost,
      rules_fired: decision.behavior.rules_fired,
      expected_uplift: decision.expected_uplift,
      cost: decision.action_cost,
      probability: decision.final_score
    });
    storeDecisionMetrics({ ...metricsBuf, trace_id }).catch(() => {});

    // Command 05 - Step 9: Seed the outcome system with a placeholder
    // COMMAND X - ML POLLUTION SHIELD: pass the decision_source and ml_training_allowed 
    logDecisionOutcomePlaceholder(trace_id, signal.visitor_id, decision.action, decision.ml_training_allowed, decision.decision_source).catch(() => {});

    // Command 06 - Step 3: Auto-trigger onboarding status (non-blocking)
    if (signal.store_domain) {
      markStepCompleted(null, signal.store_domain, "first_decision").catch(() => {});
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      // Core decision
      action:        decision.action,
      popup_type:    decision.recommended_popup,
      discount_pct:  decision.discount_pct,
      version:       "v2",
      rules_version: RULES_VERSION,

      // Browser popup payload
      headline:    popup?.headline || null,
      sub_message: popup?.sub     || null,
      cta_text:    popup?.cta     || null,

      // Reasoning (observability)
      reasoning: {
        intent:            decision.behavior.intent,
        intent_score:      decision.behavior.intent_score,
        friction:          decision.behavior.friction,
        friction_present:  decision.behavior.friction_present,
        engagement_depth:  decision.behavior.engagement_depth,
        is_exit_risk:      decision.behavior.is_exit_risk,
        is_bot_suspect:    decision.behavior.is_bot_suspect,
        rules_fired:       decision.behavior.rules_fired,
        context_modifiers: decision.context?.context_modifiers || []
      },

      // ML transparency
      ml_signal: {
        used:  decision.ml_used,
        boost: decision.ml_boost,
        note:  decision.ml_used
          ? `ML enhanced priority by ${(decision.ml_boost * 100).toFixed(1)}% (secondary signal)`
          : "ML disabled or skipped — behavioral-only decision"
      },

      // Economic justification
      economic: {
        justified:       decision.economic_justified,
        expected_uplift: decision.expected_uplift,
        action_cost:     decision.action_cost,
        aov_estimate:    aovEstimate
      },

      // Audit + Trace (correlatable with nolix_events)
      trace_id:        trace_id,
      latency_ms:      latency_ms,
      decision_path:   decision.decision_path,
      one_line_reason: _buildOneLineReason(decision)
    });

  } catch (e: any) {
    if (!succeeded) recordOutcome(false, Date.now() - start);

    // Structured error log
    logger.error("engine", e.message, { stack: e.stack?.substring(0, 300) }, trace_id);

    // System error event (non-blocking)
    emitSystemEvent({
      event:   "error",
      service: "decide-v2",
      detail:  e.message,
      error:   e.message
    }).catch(() => {});

    // SAFE FALLBACK: do_nothing — never produce phantom action from errors
    return NextResponse.json({
      action:          "do_nothing",
      popup_type:      null,
      discount_pct:    0,
      version:         "v2",
      error:           "BRAIN_ERROR",
      trace_id:        trace_id,
      one_line_reason: "ENGINE_ERROR — safe fallback. No evaluation performed.",
      economic:        { justified: false }
    }, { status: 500 });
  }
}

// ── GET: Brain architecture + laws ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    version:      "v2",
    architecture: "HYBRID DECISION BRAIN + EVENT FOUNDATION LAYER",
    rules_version: RULES_VERSION,
    layers: [
      { layer: 1, name: "Behavioral Rules", role: "PRIMARY DRIVER",            ml_dependency: "NONE"     },
      { layer: 2, name: "Context Logic",    role: "ACTION SPACE NARROWER",     ml_dependency: "NONE"     },
      { layer: 3, name: "ML Enhancement",   role: "SIGNAL ENHANCER (secondary)",ml_dependency: "OPTIONAL" },
      { layer: 4, name: "Economic Gate",    role: "FINAL AUTHORITY",           ml_dependency: "NONE"     },
      { layer: 5, name: "Event System",     role: "OBSERVABILITY + REPLAY",    ml_dependency: "NONE"     }
    ],
    // 6 LAWS of Hybrid Brain Architecture (enforced in nolix-hybrid-brain.ts)
    laws: [
      "ML can NEVER intervene when behavioral gate = BLOCKED",
      "ML can NEVER trigger action when intent = NONE or LOW",
      "ML score alone NEVER triggers any action",
      "ML boost is additive only, capped at +0.20 contribution",
      "Economic gate is ALWAYS the final authority (E[uplift]*AOV > cost*1.20)",
      "do_nothing is a valid, correct decision — not a fallback"
    ],
    event_system: {
      tables:   ["nolix_events", "nolix_logs", "nolix_decisions"],
      per_request_events: ["behavior", "ml", "decision"],
      replay:   "GET /api/engine/replay?trace_id=xxx",
      stream:   "GET /api/engine/events"
    }
  });
}

// ── Save impression for learning loop ─────────────────────────────────────────
async function _saveImpression(
  visitorId: string,
  sessionId: string,
  storeDomain: string,
  decision: any
) {
  await Promise.all([
    query(
      `INSERT INTO popup_sessions
         (session_id, intent_level, intent_score, friction_detected, show_popup, action_taken, cohort_key, expected_uplift, business_explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (session_id)
       DO UPDATE SET action_taken=EXCLUDED.action_taken,
                     expected_uplift=EXCLUDED.expected_uplift,
                     updated_at=NOW()`,
      [
        sessionId,
        decision.behavior.intent,
        Math.round(decision.behavior.intent_score * 100),
        decision.behavior.friction_present,
        true,
        decision.recommended_popup,
        `${decision.behavior.intent}:${decision.behavior.friction}`,
        decision.expected_uplift,
        `HybridBrain v${RULES_VERSION}: intent=${decision.behavior.intent} friction=${decision.behavior.friction} popup=${decision.recommended_popup} ml_boost=${decision.ml_boost}`
      ]
    ).catch(() => {}),

    query(
      `INSERT INTO zeno_action_metrics (store_domain, intent_category, friction_type, action_name, impressions)
       VALUES ($1,$2,$3,$4,1)
       ON CONFLICT (store_domain, intent_category, friction_type, action_name)
       DO UPDATE SET impressions = zeno_action_metrics.impressions + 1, updated_at = NOW()`,
      [storeDomain, decision.behavior.intent, decision.behavior.friction, decision.recommended_popup]
    ).catch(() => {})
  ]);
}

// ── Build one-line reason ─────────────────────────────────────────────────────
function _buildOneLineReason(d: any): string {
  if (d.action === "block")      return `Blocked: ${d.behavior?.ineligible_reason || "rule violation"}`;
  if (d.action === "do_nothing") {
    if (!d.economic_justified)   return `Observing: intent=${d.behavior?.intent}, no economically justified intervention`;
    return `Observing: context gate blocked`;
  }
  return `Intervening: intent=${d.behavior?.intent}, friction=${d.behavior?.friction}, popup=${d.recommended_popup} (+${d.discount_pct}% discount), uplift=$${d.expected_uplift}`;
}
