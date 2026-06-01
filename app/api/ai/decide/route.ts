/**
 * app/api/ai/decide/route.ts
 * NOLIX Phase 2 — Fast Inference API (Next.js Bridge to Python AI Brain)
 *
 * POST /api/ai/decide
 * Body: { session_id, features, context }
 * Returns: { action, value, confidence, prob, model_v }
 *
 * Flow:
 *  1. Validate session + rate limit
 *  2. Call Python AI Brain /decide
 *  3. If Python unavailable → inline fallback
 *  4. Store decision for causal tracking
 *  5. Return decision to client
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";

export const dynamic = "force-dynamic";

// ── Inline fallback (mirrors Python probability logic) ────────────────────────
function inlineFallback(features: Record<string, number>, prob: number): {
  action: string; value?: number; message?: string; reason: string
} {
  const exit   = features.exit_intent > 0.5;
  const cart   = features.cart_score ?? 0;
  const mobile = features.is_mobile  > 0.5;

  if (prob < 0.30) {
    if (exit || cart >= 0.6) return { action: "discount", value: 15, reason: `prob=${prob.toFixed(2)}` };
    return { action: "discount", value: 10, reason: `prob=${prob.toFixed(2)}` };
  }
  if (prob < 0.50) {
    if (cart >= 0.6) return { action: "discount", value: 5, reason: `prob=${prob.toFixed(2)}` };
    return { action: "urgency", message: "⏰ كميات محدودة!", reason: `prob=${prob.toFixed(2)}` };
  }
  if (prob < 0.70) {
    if (exit) return { action: "urgency", message: "🚚 شحن مجاني الآن!", reason: `prob=${prob.toFixed(2)}` };
    if (!mobile) return { action: "urgency", message: "🔥 مطلوب جداً!", reason: `prob=${prob.toFixed(2)}` };
  }
  return { action: "none", reason: `prob=${prob.toFixed(2)}_no_intervention` };
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl  = await applyRateLimit(ip, "/api/ai/decide");
    if (rl) return rl;

    const body = await req.json();
    const { session_id, features = {}, context = {} } = body;

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const pythonUrl = process.env.PYTHON_AI_URL;

    // ── Try Python AI Brain ──────────────────────────────────────────────────
    if (pythonUrl) {
      try {
        const res = await fetch(`${pythonUrl}/decide`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            session_id,
            event:   "api_decide",
            data:    features,
            context,
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const decision = await res.json();
          return NextResponse.json({ ...decision, source: "python_v3" });
        }
      } catch { /* Python down → inline fallback */ }
    }

    // ── Inline fallback ──────────────────────────────────────────────────────
    const modelScore = parseFloat(features.model_score ?? 0);
    const decision   = inlineFallback(features, modelScore);

    return NextResponse.json({
      ...decision,
      source:     "inline_fallback",
      prob:       modelScore,
      model_v:    0,
      model_auc:  null,
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal error", code: "AI_DECIDE_ERROR" }, { status: 500 });
  }
}
