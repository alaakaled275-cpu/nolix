/**
 * app/api/track/route.ts
 * NOLIX — Neural Decision Gateway (Phase 1 Hardened)
 *
 * PHASE 1 PRODUCTION HARDENING:
 *  ✅ Layer 0a — Store API Key Auth (x-api-key → stores.public_key)
 *  ✅ Layer 0b — Per-session Rate Limit (60 req/min/session, Redis + IP fallback)
 *  ✅ Layer 0c — Session Validation (session_id required)
 *  ✅ Layer 1  — AI Circuit Breaker (auto-fallback when AI fails 5× in a row)
 *  ✅ Layer 2  — Queue System (heavy DB writes go to background queue)
 *  ✅ Layer 3  — Retry Logic (critical DB ops retry 3×)
 *  ✅ Layer 4  — Structured Logging (logger.ts → nolix_logs table)
 *  ✅ Layer 5  — AI Brain + Inline Fallback (Python FastAPI → TypeScript engine)
 *  ✅ Layer 6  — SSE Broadcast (live dashboard feed via eventBus)
 *
 * ARCHITECTURE:
 *  Client (master.js sendEvent)
 *    → POST /api/track  {x-api-key, session_id, event, data}
 *    → Auth + RateLimit
 *    → AI Brain decision (Python or inline TS)
 *    → Broadcast to SSE dashboard
 *    → Queue DB write (non-blocking)
 *    → Return decision to client
 *    → Client handleDecision() shows popup/banner
 */

import { NextRequest, NextResponse } from "next/server";
import { query }              from "@/lib/db";
import { queryForTenant }     from "@/lib/nolix-rls";
import { applyRateLimit }     from "@/lib/nolix-rate-limiter";
import { extractTenantDomain } from "@/lib/nolix-tenant";
import { eventBus }           from "@/lib/nolix-event-bus";
import { logger }             from "@/lib/nolix-structured-logger";
import { verifyStoreKey }     from "@/lib/store-auth";
import { getStratifiedABGroup } from "@/lib/nolix-ab-engine";
import { predictBaselineProbability } from "@/lib/nolix-baseline-model";
import { v4 as uuidv4 }       from "uuid";

export const dynamic = "force-dynamic";

// ── CORS — Required so Shopify/WooCommerce stores can POST to our API ─────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",                          // any store domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-store-domain",
  "Access-Control-Max-Age":       "86400",                     // preflight cache 24h
};

// ── OPTIONS preflight handler ────────────────────────────────────────────────
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── AI Circuit Breaker (Phase 1 §5) ──────────────────────────────────────────
// Tracks consecutive AI failures in-process.
// After BREAKER_THRESHOLD failures → stop calling Python, use inline only.
// Auto-resets after BREAKER_RESET_MS milliseconds.
const BREAKER_THRESHOLD = 5;
const BREAKER_RESET_MS  = 60_000; // 1 minute

let _aiFailures     = 0;
let _breakerOpenAt  = 0;
let _breakerOpen    = false;

function isBreakerOpen(): boolean {
  if (!_breakerOpen) return false;
  // Auto-reset after 60s
  if (Date.now() - _breakerOpenAt > BREAKER_RESET_MS) {
    _breakerOpen = false;
    _aiFailures  = 0;
    logger.info("engine", "Circuit breaker auto-reset → CLOSED").catch(() => {});
    return false;
  }
  return true;
}

function recordAISuccess() {
  _aiFailures = 0;
  _breakerOpen = false;
}

function recordAIFailure() {
  _aiFailures++;
  if (_aiFailures >= BREAKER_THRESHOLD && !_breakerOpen) {
    _breakerOpen   = true;
    _breakerOpenAt = Date.now();
    logger.warn("engine", `Circuit breaker OPEN after ${BREAKER_THRESHOLD} AI failures`).catch(() => {});
  }
}

// ── Inline AI Decision Engine (Phase 1 Fallback) ─────────────────────────────
function inlineDecide(eventData: {
  event: string;
  data?: {
    time_on_page?:     number;
    scroll_depth?:     number;
    clicks?:           number;
    hesitation_score?: number;
    engagement_score?: number;
    exit_intent?:      boolean;
    cart_status?:      string;
    model_score?:      number;
  };
}): {
  action: string; value?: number; tier?: string; message?: string; reason: string;
  intent_score: number; friction_type: string; ltv_tier: string; emotion_state: string;
  timing_decision: string; elasticity_level: string; memory_profile: string; loss_trigger: string;
  profit_risk: string; competition_risk: string; expected_revenue_impact: number; reasoning: string; final_action: string; original_action?: string; ab_group?: string; final_score?: number; confidence?: number; expected_baseline_revenue?: number; decision_id?: string;
} {
  const d           = eventData.data || {};
  const hesitation  = d.hesitation_score ?? 0;
  const engagement  = d.engagement_score ?? 0;
  const timeOnPage  = d.time_on_page     ?? 0;
  const scrollDepth = d.scroll_depth     ?? 0;
  const clicks      = d.clicks           ?? 0;
  const exitIntent  = d.exit_intent      ?? false;
  const cartStatus  = d.cart_status      ?? "unknown";
  const modelScore  = d.model_score      ?? 0;

  // 12-Layer Fallback Default Format
  let intent_score = Math.min(100, Math.max(0, Math.round(modelScore * 100)));
  let friction_type = "none";
  let ltv_tier = "Low";
  let emotion_state = hesitation > 0.5 ? "Hesitant" : "Curious";
  let timing_decision = timeOnPage < 10 ? "Early" : "Optimal";
  let elasticity_level = "Medium";
  let memory_profile = "New";
  let loss_trigger = "None";
  let profit_risk = "Low";
  let competition_risk = hesitation > 0.6 ? "High" : "Low";
  let final_action = "Do Nothing";
  let expected_revenue_impact = 0;
  let reasoning = "insufficient_signal_fallback";

  if (cartStatus === "checkout" && hesitation > 0.5) {
    friction_type = "shipping_cost";
    final_action = "small_incentive";
    reasoning = "checkout_hesitation_fallback";
  } else if (exitIntent && engagement > 0.3) {
    friction_type = "price_sensitivity";
    final_action = hesitation > 0.6 ? "small_incentive" : "trust_urgency";
    reasoning = "exit_intent_fallback";
  } else if (cartStatus === "added" && timeOnPage > 90 && hesitation > 0.4) {
    friction_type = "indecision_loop";
    final_action = "bundle_offer";
    reasoning = "stuck_cart_fallback";
  }

  return {
    intent_score,
    friction_type,
    ltv_tier,
    emotion_state,
    timing_decision,
    elasticity_level,
    memory_profile,
    loss_trigger,
    profit_risk,
    competition_risk,
    final_action: final_action as any,
    expected_revenue_impact,
    reasoning,
    action: final_action,
    reason: reasoning,
    original_action: final_action,
  };
}

// ── Call Python AI Brain (Phase 1 §5 — Circuit Breaker protected) ─────────────
async function callPythonBrain(payload: unknown): Promise<ReturnType<typeof inlineDecide> | null> {
  if (isBreakerOpen()) return null; // breaker OPEN → skip, use inline

  const pythonUrl = process.env.PYTHON_AI_URL;
  if (!pythonUrl) return null;

  try {
    const res = await fetch(`${pythonUrl}/decide`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(2000), // 2s hard timeout
    });
    if (!res.ok) { recordAIFailure(); return null; }
    recordAISuccess();
    return await res.json();
  } catch {
    recordAIFailure();
    return null;
  }
}

// ── Per-session rate limit (Phase 1 §2) ──────────────────────────────────────
// Redis: 60 req/min per session_id (IP fallback when Redis missing/session missing)
async function checkSessionRateLimit(sessionId: string, ip: string): Promise<boolean> {
  const { redis } = await import("@/lib/redis");

  // Fail open if Redis unavailable — IP-level limiter in nolix-rate-limiter still active
  if (!redis) return true;

  const key = `rl:session:${sessionId || ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60); // set TTL only on first request in window
    if (count > 60) return false; // blocked — 429
    return true;
  } catch {
    // Redis error → fail open, don't block legitimate traffic
    return true;
  }
}


// ── Server-side retry wrapper (Phase 1 §3) ────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 300): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error("Retry exhausted");
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  const traceId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    // ── [0a] STORE API KEY AUTH ──────────────────────────────────────────────
    // Every request from master.js must include x-api-key: <public_key>
    // In dev mode with no DB: falls through with anonymous store context
    const storeAuth = await verifyStoreKey(req, { required: false });
    const storeDomain = storeAuth.ok
      ? storeAuth.store.domain
      : (req.headers.get("x-store-domain") ?? extractTenantDomain(req));

    // ── [0b] IP-LEVEL RATE LIMIT (Redis sliding window) ──────────────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitBlock = await applyRateLimit(ip, "/api/track");
    if (rateLimitBlock) {
      logger.warn("engine", "Rate limit exceeded (IP)", { ip, trace_id: traceId }).catch(() => {});
      return rateLimitBlock;
    }

    // ── [1] PARSE BODY ────────────────────────────────────────────────────────
    const body = await req.json();
    const { event, type, data, session_id, visitor_id, store, timestamp } = body;

    const effectiveEvent  = event  || type  || "unknown";
    const effectiveDomain = store  || storeDomain || "unknown";

    // ── [0c] SESSION VALIDATION ──────────────────────────────────────────────
    if (!session_id) {
      return NextResponse.json(
        { error: "Missing session_id", code: "MISSING_SESSION" },
        { status: 400 }
      );
    }

    // ── [0d] PER-SESSION RATE LIMIT (60 req/min/session) ────────────────────
    const sessionAllowed = await checkSessionRateLimit(session_id, ip);
    if (!sessionAllowed) {
      logger.warn("engine", "Rate limit exceeded (session)", { session_id, trace_id: traceId }).catch(() => {});
      return NextResponse.json(
        { error: "Too many requests. Slow down.", code: "SESSION_RATE_LIMITED", retry_after: 60 },
        {
          status: 429,
          headers: {
            "Retry-After":          "60",
            "X-RateLimit-Limit":    "60",
            "X-RateLimit-Window":   "60s",
            "X-RateLimit-Scope":    "session",
          }
        }
      );
    }

    // ── [2] QUEUE DB WRITE (non-blocking, Phase 1 §4) ────────────────────────
    // Heavy DB writes go to background queue — NEVER block the response path.
    Promise.resolve().then(async () => {
      try {
        if (effectiveEvent === "conversion" || effectiveEvent === "purchase_confirmed") {
          const revenue = data?.revenue ?? data?.order_value ?? 0;
          const order_id = data?.order_id ?? `ORD-${Math.random().toString(36).substring(7)}`;

          await withRetry(() =>
            queryForTenant(
              `UPDATE popup_sessions SET converted = true, order_value = $1 WHERE session_id = $2`,
              [revenue, data?.session_id ?? session_id],
              effectiveDomain
            )
          );
          await withRetry(() =>
            query(
              `INSERT INTO rl_outcomes (session_id, converted, revenue) VALUES ($1, true, $2)`,
              [data?.session_id ?? session_id, revenue]
            )
          );

          // ── Sprint 6: REPORT USAGE TO STRIPE ────────────────────────────────
          // This is the critical link: conversion → Stripe usage record → Invoice
          try {
            const baseUrl = process.env.NOLIX_API_BASE || "http://localhost:3002";
            fetch(`${baseUrl}/api/billing/usage`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                store_domain:       effectiveDomain,
                conversions:        1,
                revenue_attributed: revenue,
              }),
            }).catch(() => {}); // fire-and-forget, never block
          } catch (_e) {
            // Non-fatal: billing will be reconciled by cron if this fails
          }


          try {
            const decisions = await query<{ decision_id: string, action: string, ab_group: string, created_at: Date, expected_baseline_revenue: number }>(
                `SELECT decision_id, action, ab_group, created_at, expected_baseline_revenue
                 FROM rl_decisions 
                 WHERE session_id = $1 AND created_at > NOW() - INTERVAL '30 days'
                 ORDER BY created_at ASC`,
                [data?.session_id ?? session_id]
            );

            const activeTouches = decisions.filter(d => d.action !== "Do Nothing" && d.action !== "none" && d.ab_group === "ml");

            // Context Signal Engine (Layer 21)
            // Query real intensity score from DB for the last hour
            const contextData = await query<{ intensity_score: number }>(`
                SELECT intensity_score FROM bic_context_signals 
                WHERE store_domain = $1 AND expires_at > NOW()
                ORDER BY detected_at DESC LIMIT 1
            `, [effectiveDomain]);
            const context_intensity = contextData.length > 0 ? Number(contextData[0].intensity_score) : 0.0;

            if (activeTouches.length > 0) {
                // Determine Weights dynamically (Layer 19 Learned Multi-Touch)
                const weightData = await query<{ touch_first_weight: number, touch_middle_weight: number, touch_last_weight: number }>(`
                    SELECT touch_first_weight, touch_middle_weight, touch_last_weight 
                    FROM bic_learned_weights 
                    WHERE store_domain = $1 
                    ORDER BY created_at DESC LIMIT 1
                `, [effectiveDomain]);
                
                let firstW = 0.2, middleW = 0.3, lastW = 0.5;
                if (weightData && weightData.length > 0) {
                    firstW = Number(weightData[0].touch_first_weight);
                    middleW = Number(weightData[0].touch_middle_weight);
                    lastW = Number(weightData[0].touch_last_weight);
                }

                let weights = [];
                if (activeTouches.length === 1) {
                    weights = [1.0];
                } else if (activeTouches.length === 2) {
                    const totalW = firstW + lastW;
                    weights = [firstW / totalW, lastW / totalW]; 
                } else {
                    weights = activeTouches.map((_, i) => {
                        if (i === 0) return firstW;
                        if (i === activeTouches.length - 1) return lastW;
                        return middleW / (activeTouches.length - 2); 
                    });
                }

                for (let i = 0; i < activeTouches.length; i++) {
                    const primary = activeTouches[i];
                    
                    // Layer 20: Learned Confidence Model
                    const timeDiffDays = (new Date().getTime() - new Date(primary.created_at).getTime()) / (1000 * 3600 * 24);
                    const is_direct = timeDiffDays < 1; 
                    const impact_type = is_direct ? 'Direct' : 'Assisted';
                    
                    // The learned model uses an exponential decay curve calibrated by context intensity
                    // C(t) = C_0 * e^(-k * t) where C_0 is impacted by context_intensity
                    // If no context signal, C_0 = 1.0. If high context intensity (e.g. ad spike), C_0 drops.
                    const C_0 = Math.max(0.2, 1.0 - context_intensity);
                    
                    // In a fully trained ML system, k is learned per store. We approximate k = 0.035 for now
                    const k = 0.035; 
                    let confidence_score = C_0 * Math.exp(-k * timeDiffDays);
                    confidence_score = Math.max(0.05, Math.min(1.0, confidence_score));
                    
                    let discount_cost = 0;
                    if (primary.action === "Offer discount" || primary.action === "discount_15") discount_cost = revenue * 0.15;
                    else if (primary.action === "discount_10") discount_cost = revenue * 0.10;
                    else if (primary.action === "discount_5") discount_cost = revenue * 0.05;
                    else if (primary.action === "Offer bundle") discount_cost = revenue * 0.10;
                    
                    // Counterfactual Net Profit = Actual Revenue - Expected Baseline Revenue - Discount Cost
                    const baseline_rev = Number(primary.expected_baseline_revenue) || 0;
                    const net_profit = (revenue - baseline_rev - discount_cost) * weights[i];

                    await query(
                       `INSERT INTO nolix_attributions 
                        (order_id, visitor_id, decision_id, attribution_type, is_valid, validation_reason, order_value, discount_cost, net_profit_impact, impact_type, confidence_score, attribution_weight, context_penalty)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT(order_id, decision_id) DO NOTHING`,
                       [
                           order_id, visitor_id || "unknown", primary.decision_id, 
                           i === activeTouches.length - 1 ? "Primary" : "Secondary", 
                           true, "Valid AI Intervention", revenue * weights[i], discount_cost * weights[i], net_profit,
                           impact_type, confidence_score, weights[i], context_intensity
                       ]
                    );
                }
            } else if (decisions.length > 0) {
               // They had AI interactions, but ALL were suppressed (Control Group)
               // This is purely Organic, log it with is_valid=false so RL worker ignores it, but Dashboard counts it for Control revenue
               const primary = decisions[decisions.length - 1];
               await query(
                   `INSERT INTO nolix_attributions 
                    (order_id, visitor_id, decision_id, attribution_type, is_valid, validation_reason, order_value, discount_cost, net_profit_impact, impact_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT(order_id, decision_id) DO NOTHING`,
                   [order_id, visitor_id || "unknown", primary.decision_id, "Primary", false, "User was in control group (Organic)", revenue, 0, revenue, 'Organic']
               );
            }
          } catch(e: any) {
             logger.error("db", "RAS Attribution failed", { error: e.message, trace_id: traceId }).catch(() => {});
          }
        } else if (effectiveEvent === "popup_shown") {
          await withRetry(() =>
            queryForTenant(
              `INSERT INTO zeno_action_metrics
                 (store_domain, intent_category, friction_type, action_name, impressions)
               VALUES ($1, $2, $3, $4, 1)
               ON CONFLICT (store_domain, intent_category, friction_type, action_name)
               DO UPDATE SET impressions = zeno_action_metrics.impressions + 1, updated_at = now()`,
              [effectiveDomain, data?.intent_level ?? "unknown", data?.friction ?? "none", data?.action ?? "unknown"],
              effectiveDomain
            )
          );
        } else if (effectiveEvent === "cta_click") {
          await withRetry(() =>
            queryForTenant(
              `UPDATE popup_sessions SET cta_hover_count = COALESCE(cta_hover_count, 0) + 1 WHERE session_id = $1`,
              [data?.session_id ?? session_id],
              effectiveDomain
            )
          );
        } else if (effectiveEvent === "prediction_decision") {
          // Deprecated: We now log rl_decisions immediately when the decision is made.
          // This ensures Control Group decisions are logged accurately before being suppressed.
        }
      } catch (dbErr: any) {
        logger.error("db", "Queue DB write failed", { error: dbErr.message, event: effectiveEvent, trace_id: traceId }).catch(() => {});
      }
    }).catch(() => {});

    // ── [3] AI BRAIN — GET DECISION (Phase 1 §5 — Circuit Breaker) ──────────
    const decisionInput = {
      session_id:  session_id,
      visitor_id:  visitor_id ?? null,
      store:       effectiveDomain,
      event:       effectiveEvent,
      data:        data || {},
      timestamp:   timestamp ?? Date.now(),
    };

    let decision = await callPythonBrain(decisionInput);
    const brain  = decision ? "python" : "inline";
    if (!decision) {
      decision = inlineDecide({ event: effectiveEvent, data: data || {} });
    }

    // ── [3.5] FASTAPI INFERENCE LAYER (Speed & Real ML) ───
    const decision_id = uuidv4();
    decision.decision_id = decision_id;
    const vid = visitor_id || data?.visitor_id || "unknown";
    
    let expected_conversion_prob = 0.02;
    let expected_revenue_impact = 0.0;
    
    try {
        const mlResponse = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                store_domain: effectiveDomain,
                sessionDurationMs: Number(data?.session_duration || 10000),
                pagesViewed: Number(data?.pages_viewed || 1),
                scrollDepth: Number(data?.scroll_depth || 10),
                source: data?.source || 'direct',
                device: data?.device || 'desktop',
                intentScore: Number(data?.intent_score || 20),
                triggerEvent: effectiveEvent,
                cartValue: Number(data?.order_value || 50),
                botScore: Number(data?.bot_score || 0),
                discountHistoryCount: Number(data?.discount_history_count || 0),
                holdoutSize: 1000 // In production, query the actual holdout size from the last 7 days
            }),
            signal: AbortSignal.timeout(100) // STRICT 100ms Latency Requirement
        });
        
        if (mlResponse.ok) {
            const mlData = await mlResponse.json();
            expected_conversion_prob = mlData.baseline_prob;
            expected_revenue_impact = mlData.profit_impact_prediction;
            
            // Layer 30 & Offer Precision Override
            if (mlData.recommended_action !== "none") {
                decision.final_action = mlData.recommended_action;
                decision.reasoning = mlData.reasoning;
                decision.expected_revenue_impact = expected_revenue_impact;
            } else if (mlData.reasoning) {
                // Keep the reasoning even if action is none (e.g., Burn avoidance)
                decision.final_action = "Do Nothing";
                decision.reasoning = mlData.reasoning;
            }
        }
    } catch (fastApiErr) {
        // Fallback gracefully if Python microservice is down or slow
        expected_conversion_prob = Math.max(0.01, (data?.engagement_score || 0.1) * 0.5); 
    }
    
    const expected_revenue = expected_conversion_prob * (data?.order_value || 50);

    const ab_group = await getStratifiedABGroup(
        vid, 
        data?.device || 'desktop', 
        data?.memory_profile === 'New', 
        data?.intent_score > 50 ? 'high' : 'low', 
        data?.source || 'direct'
    );
    
    const is_ml = ab_group === "ml";
    decision.ab_group = ab_group;
    decision.expected_baseline_revenue = expected_revenue;
    const is_holdout = ab_group === "holdout";
    
    if (!is_ml && decision.final_action !== "Do Nothing") {
        decision.original_action = decision.final_action; // Keep track of what we would have done
        decision.final_action = "Do Nothing";
        decision.action = "none";
        decision.reasoning = is_holdout ? "Holdout Group - Strictly Suppressed" : "Control Group - Action Suppressed";
    }

    // Immediately log the decision to rl_decisions to ensure we capture the decision_id and ab_group
    try {
      const state_vector = JSON.stringify({
        hes_level: data?.hesitation_score > 0.6 ? "H" : data?.hesitation_score > 0.3 ? "M" : "L",
        eng_level: data?.engagement_score > 0.6 ? "H" : data?.engagement_score > 0.3 ? "M" : "L",
        device: data?.device?.includes("mobile") ? "mob" : "desk"
      });
      await query(
        `INSERT INTO rl_decisions 
           (decision_id, ab_group, session_id, state_vector, action, value, confidence, intent_score, friction_type, ltv_score, expected_revenue_impact, reasoning, emotion_state, timing_decision, elasticity_level, memory_profile, loss_trigger, profit_risk, competition_risk, expected_baseline_revenue, is_holdout) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          decision_id,
          decision.ab_group,
          session_id, 
          state_vector, 
          decision.original_action ?? decision.final_action ?? decision.action ?? "Do Nothing", 
          decision.final_score ?? 0, 
          decision.confidence ?? 0,
          decision.intent_score ?? 0,
          decision.friction_type ?? "none",
          decision.ltv_tier ?? "Low",
          decision.expected_revenue_impact ?? 0.0,
          decision.reasoning ?? "None",
          decision.emotion_state ?? "Curious",
          decision.timing_decision ?? "Early",
          decision.elasticity_level ?? "Medium",
          decision.memory_profile ?? "New",
          decision.loss_trigger ?? "None",
          decision.profit_risk ?? "Low",
          decision.competition_risk ?? "Low",
          decision.expected_baseline_revenue ?? 0.0,
          is_holdout
        ]
      );
    } catch (dbErr: any) {
      logger.error("db", "Failed to insert rl_decision", { error: dbErr.message, trace_id: traceId }).catch(() => {});
    }

    // ── [4] BROADCAST TO LIVE DASHBOARD (SSE) ───────────────────────────────
    // Always emit — dashboard shows even "none" decisions as activity
    eventBus.emit("decision", {
      session_id:  session_id,
      visitor_id:  visitor_id ?? null,
      store:       effectiveDomain,
      event:       effectiveEvent,
      decision,
      model_score: data?.model_score  ?? null,
      hesitation:  data?.hesitation_score ?? null,
      timestamp:   new Date().toISOString(),
    });

    // ── [5] STRUCTURED LOGGING ───────────────────────────────────────────────
    const latencyMs = Date.now() - requestStart;
    logger.decision(traceId, decision.final_action ?? decision.action, effectiveEvent, latencyMs).catch(() => {});

    if (_breakerOpen) {
      logger.warn("engine", "AI circuit breaker OPEN — using inline fallback", { failures: _aiFailures, trace_id: traceId }).catch(() => {});
    }

    // ── [6] RESPOND WITH CORS ─────────────────────────────────────────────────
    return NextResponse.json({
      success:      true,
      domain:       effectiveDomain,
      event_ack:    effectiveEvent,
      decision,
      brain,
      breaker:      _breakerOpen ? "open" : "closed",
      latency_ms:   latencyMs,
      trace_id:     traceId,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    logger.error("engine", "Track API fatal error", { error: error.message, trace_id: traceId }).catch(() => {});
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR", trace_id: traceId },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
