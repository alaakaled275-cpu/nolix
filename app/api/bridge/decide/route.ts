/**
 * app/api/bridge/decide/route.ts
 * NOLIX Phase 3 — Neural Bridge
 * THE single endpoint that connects Client → Server → AI → Dashboard
 *
 * Flow:
 *  POST /api/bridge/decide
 *  → Auth (x-api-key)
 *  → Rate limit (60/min/session)
 *  → Store event in user_events (background)
 *  → Call AI (200ms timeout → inline fallback)
 *  → Store decision in ai_decisions (background)
 *  → Broadcast to SSE dashboard
 *  → Return decision immediately
 */

import { NextRequest, NextResponse } from "next/server";
import { query }          from "@/lib/db";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";
import { verifyStoreKey } from "@/lib/store-auth";
import { eventBus }       from "@/lib/nolix-event-bus";
import { logger }         from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

// ── Circuit breaker for Python AI ────────────────────────────────────────────
let _failures = 0, _open = false, _openAt = 0;
function breakerOpen() {
  if (!_open) return false;
  if (Date.now() - _openAt > 60_000) { _open = false; _failures = 0; }
  return _open;
}
function recordFail() { if (++_failures >= 5) { _open = true; _openAt = Date.now(); } }
function recordOk()   { _failures = 0; _open = false; }

// ── Inline probability fallback ────────────────────────────────────────────
function inlineDecide(f: Record<string, any>): Record<string, any> {
  const t    = +f.time_on_page || 0;
  const hes  = +f.hesitation_score || 0;
  const eng  = +f.engagement_score || 0;
  const exit = !!f.exit_intent;
  const cart = f.cart_status || "unknown";
  const score = +f.model_score || 0;

  if (t < 5 && !exit) return { action: "none", reason: "too_early" };
  if (exit && eng > 0.3) return hes > 0.6
    ? { action: "discount", value: 15, tier: "aggressive", reason: "exit_high_hesitation" }
    : { action: "urgency", message: "⏰ عرض خاص ينتهي قريباً!", reason: "exit_soft" };
  if (cart === "checkout" && hes > 0.5) return { action: "discount", value: 10, tier: "standard", reason: "checkout_hesitation" };
  if (score >= 0.80 && hes > 0.5) return { action: "discount", value: 10, tier: "standard", reason: "high_score" };
  if (hes > 0.7 && t > 30) return { action: "discount", value: 5, tier: "soft", reason: "high_hesitation" };
  return { action: "none", reason: "no_signal" };
}

// ── Call Python AI (200ms hard timeout) ───────────────────────────────────
async function callAI(payload: unknown): Promise<Record<string, any> | null> {
  if (breakerOpen()) return null;
  const url = process.env.PYTHON_AI_URL;
  if (!url) return null;
  try {
    const res = await fetch(`${url}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(200),   // 200ms hard limit
    });
    if (!res.ok) { recordFail(); return null; }
    recordOk();
    return await res.json();
  } catch { recordFail(); return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const start   = Date.now();
  const traceId = `br_${Date.now().toString(36)}`;

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const ip      = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl      = await applyRateLimit(ip, "/api/bridge/decide");
    if (rl) return rl;

    const auth    = await verifyStoreKey(req, { required: false });
    const domain  = auth.ok ? auth.store.domain : (req.headers.get("x-store-domain") ?? "unknown");

    const body = await req.json();
    const { session_id, features = {}, context = {} } = body;

    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    // ── Per-session rate limit ────────────────────────────────────────────────
    try {
      const { redis } = await import("@/lib/redis");
      if (redis) {
        const cnt = await redis.incr(`rl:bridge:${session_id}`);
        if (cnt === 1) await redis.expire(`rl:bridge:${session_id}`, 60);
        if (cnt > 60) return NextResponse.json({ error: "Rate limited", retry_after: 60 }, { status: 429 });
      }
    } catch { /* Redis optional */ }

    // ── Store event (background, non-blocking) ────────────────────────────────
    const eventPayload = { session_id, features, context, domain, ts: Date.now() };
    Promise.resolve().then(() =>
      query(`INSERT INTO user_events (session_id, store_domain, event_type, features, context)
             VALUES ($1,$2,'heartbeat',$3,$4)`,
        [session_id, domain, JSON.stringify(features), JSON.stringify(context)]
      ).catch(() => {})
    );

    // ── AI Decision (parallel: Python + inline timeout race) ─────────────────
    const aiPayload = { session_id, store: domain, event: "bridge_decide", data: features, context };
    let decision = await callAI(aiPayload);
    const brain  = decision ? "python_v3" : "inline";
    if (!decision) decision = inlineDecide(features);

    // ── Store decision (background) ───────────────────────────────────────────
    Promise.resolve().then(() =>
      query(`INSERT INTO ai_decisions (session_id, store_domain, action, value, prob, brain)
             VALUES ($1,$2,$3,$4,$5,$6)`,
        [session_id, domain, decision!.action, decision!.value ?? null, decision!.prob ?? null, brain]
      ).catch(() => {})
    );

    // ── SSE Broadcast to live dashboard ──────────────────────────────────────
    eventBus.emit("decision", {
      session_id, domain, decision, brain,
      features: {
        time_on_page:     features.time_on_page,
        hesitation_score: features.hesitation_score,
        model_score:      features.model_score,
      },
      timestamp: new Date().toISOString(),
    });

    const latency = Date.now() - start;
    logger.decision(traceId, decision.action, "bridge_decide", latency).catch(() => {});

    return NextResponse.json({
      ...decision,
      brain,
      latency_ms:    latency,
      trace_id:      traceId,
      breaker:       _open ? "open" : "closed",
    });

  } catch (err: any) {
    logger.error("bridge", "Fatal error", { error: err.message, trace_id: traceId }).catch(() => {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
