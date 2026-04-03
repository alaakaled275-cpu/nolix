import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getEnv } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ZenoContext {
  total_sessions?: number;
  high_intent_sessions?: number;
  popups_shown?: number;
  total_conversions?: number;
  cvr_pct?: number;
  offer_rate_pct?: number;
  revenue_attributed?: number;
  revenue_lift_est?: string;
  discount_saved_pct?: number;
  discount_avoided_count?: number;
  today?: {
    analyzed: number;
    actions_taken: number;
    conversions: number;
    revenue: number;
    discounts_avoided: number;
  };
  top_action?: string | null;
  top_action_cvr?: number;
  intent_distribution?: { intent_level: string; count: string }[];
  friction_distribution?: { friction_detected: string; count: string }[];
  ab_results?: { variant: string; offer_type: string; impressions: number; conversions: number }[];
  insights?: string[];
  sessions?: {
    intent_level: string;
    intent_score: number;
    friction_detected: string | null;
    converted: boolean;
    offer_type: string | null;
    business_explanation: string;
    traffic_source: string;
    cart_status: string;
    device: string;
  }[];
}

// ── Zeno system prompt ────────────────────────────────────────────────────────
function buildSystemPrompt(ctx: ZenoContext): string {
  // Format A/B results
  const abGrouped = (ctx.ab_results ?? []).reduce((acc, r) => {
    if (!acc[r.variant]) acc[r.variant] = { impressions: 0, conversions: 0 };
    acc[r.variant].impressions += r.impressions;
    acc[r.variant].conversions += r.conversions;
    return acc;
  }, {} as Record<string, { impressions: number; conversions: number }>);
  const abSummary = Object.entries(abGrouped)
    .map(([v, d]) => `Variant ${v}: ${d.impressions} shown, ${d.conversions} converted (${d.impressions > 0 ? ((d.conversions/d.impressions)*100).toFixed(1) : 0}% CVR)`)
    .join(" | ");

  // Friction analysis
  const frictionSummary = (ctx.friction_distribution ?? [])
    .map(f => `${f.friction_detected}: ${f.count} sessions`)
    .join(", ");

  // Intent breakdown
  const intentSummary = (ctx.intent_distribution ?? [])
    .map(i => `${i.intent_level}: ${i.count}`)
    .join(", ");

  // Recent session sample (last 3)
  const recentSample = (ctx.sessions ?? []).slice(0, 3)
    .map(s => `[${s.intent_level} intent, ${s.cart_status}, ${s.device}] → ${s.offer_type ?? "no action"} → ${s.converted ? "CONVERTED" : "lost"}`)
    .join("\n");

  // Check if we have real data
  const hasData = (ctx.total_sessions ?? 0) > 0;

  return `You are Zeno — a real-time revenue intelligence operator built into ConvertAI.

You are NOT an assistant. You are a revenue operator.
Your job: analyze store behavior, detect problems, and give decisive recommendations.

PERSONA RULES (CRITICAL):
- Direct. Never hedge. Never say "it seems" or "perhaps".
- Revenue-focused. Every response ties back to money.
- Decisive. Give a clear action, not options.
- Short. Max 3-4 sentences per response. No filler.
- Never say "great question" or any similar fluff.
- Use numbers whenever possible.

${hasData ? `
REAL STORE DATA (use this in every response):
- Total sessions analyzed: ${ctx.total_sessions ?? 0}
- High-intent visitors: ${ctx.high_intent_sessions ?? 0} (${ctx.total_sessions ? Math.round(((ctx.high_intent_sessions ?? 0) / ctx.total_sessions) * 100) : 0}% of traffic)
- Offers shown: ${ctx.popups_shown ?? 0} (${ctx.offer_rate_pct ?? 0}% of sessions)
- Total conversions: ${ctx.total_conversions ?? 0}
- Conversion rate: ${ctx.cvr_pct ?? 0}%
- Revenue attributed: $${ctx.revenue_attributed ?? 0}
- Est. revenue lift: ${ctx.revenue_lift_est ?? "—"}
- Discounts avoided: ${ctx.discount_saved_pct ?? 0}% of buyers converted WITHOUT a discount
- Today: ${ctx.today?.analyzed ?? 0} analyzed, ${ctx.today?.actions_taken ?? 0} actions, ${ctx.today?.conversions ?? 0} conversions, $${ctx.today?.revenue ?? 0} revenue
- Top performing action: ${ctx.top_action ?? "none"} at ${ctx.top_action_cvr ?? 0}% CVR
- Friction breakdown: ${frictionSummary || "no friction data yet"}
- Intent breakdown: ${intentSummary || "no intent data yet"}
- A/B test: ${abSummary || "no A/B data yet"}
${recentSample ? `- Recent decisions:\n${recentSample}` : ""}
${(ctx.insights ?? []).length > 0 ? `- System insights: ${ctx.insights!.join(" | ")}` : ""}
` : `
NO DATA YET: The store has not recorded any sessions yet. The behavior engine is installed but waiting for visitors.
Tell the user Zeno is active and monitoring, but there is no behavioral data to analyze yet.
Encourage them to drive traffic or run a test via /api/convert/analyze.
`}

RESPONSE FORMAT:
- If asked about revenue loss → cite the conversion rate and calculate how many sessions converted vs. didn't
- If asked what to fix → name one specific action, explain why with data
- If asked about A/B tests → give a clear winner decision
- If asked about behavior → describe friction, intent, and what Zeno did
- Every response should feel like a senior revenue operator giving a 30-second briefing
- Never respond with bullet points. Always prose, 2-4 sentences max.`;
}

// ── Rule-based fallback (if OpenAI fails) ────────────────────────────────────
function fallbackResponse(message: string, ctx: ZenoContext): string {
  const msg = message.toLowerCase();
  const sessions = ctx.total_sessions ?? 0;
  const cvr = ctx.cvr_pct ?? 0;
  const highIntent = ctx.high_intent_sessions ?? 0;
  const conversions = ctx.total_conversions ?? 0;
  const topFriction = (ctx.friction_distribution ?? []).sort((a, b) => Number(b.count) - Number(a.count))[0];

  if (sessions === 0) {
    return "Zeno is active and monitoring. No behavioral sessions recorded yet — drive some traffic or test the engine at /api/convert/analyze to see real data.";
  }

  if (msg.includes("losing") || msg.includes("revenue") || msg.includes("why")) {
    const lost = sessions - conversions;
    return `Out of ${sessions} sessions, ${lost} didn't convert. Your CVR is ${cvr}% — ${highIntent} visitors showed high buying intent but not all completed the purchase. The primary leak is at the decision-to-buy moment, where hesitation isn't being addressed fast enough.`;
  }

  if (msg.includes("fix") || msg.includes("improve") || msg.includes("increase")) {
    if (topFriction?.friction_detected === "stuck_cart") {
      return `Fix cart abandonment first. ${topFriction.count} sessions got stuck with items in cart — these are buyers who wanted to purchase. A timed discount or urgency message at that point recovers 15-25% of them.`;
    }
    return `Your highest-leverage fix is reducing checkout hesitation. The data shows ${ctx.today?.actions_taken ?? 0} smart actions were triggered today — scale that intervention rate and conversions follow directly.`;
  }

  if (msg.includes("a/b") || msg.includes("variant") || msg.includes("test")) {
    const abA = (ctx.ab_results ?? []).filter(r => r.variant === "A").reduce((s, r) => ({ i: s.i + r.impressions, c: s.c + r.conversions }), { i: 0, c: 0 });
    const abB = (ctx.ab_results ?? []).filter(r => r.variant === "B").reduce((s, r) => ({ i: s.i + r.impressions, c: s.c + r.conversions }), { i: 0, c: 0 });
    const cvrA = abA.i > 0 ? ((abA.c / abA.i) * 100).toFixed(1) : "0";
    const cvrB = abB.i > 0 ? ((abB.c / abB.i) * 100).toFixed(1) : "0";
    const winner = Number(cvrA) >= Number(cvrB) ? "A (rational copy)" : "B (emotional copy)";
    return `Variant ${winner} is winning — ${Number(cvrA) >= Number(cvrB) ? cvrA : cvrB}% CVR vs ${Number(cvrA) >= Number(cvrB) ? cvrB : cvrA}%. Keep running it. The losing variant is diluting your conversion average. Stop splitting if the gap > 2%.`;
  }

  if (msg.includes("detect") || msg.includes("found") || msg.includes("see")) {
    return `I've analyzed ${sessions} sessions total. ${highIntent} showed high buying intent — these are your most valuable visitors. ${topFriction ? `The most common friction point is "${topFriction.friction_detected}" (${topFriction.count} cases).` : ""} CVR is currently ${cvr}%.`;
  }

  if (msg.includes("discount") || msg.includes("offer")) {
    return `${ctx.discount_saved_pct ?? 0}% of your buyers converted WITHOUT a discount — meaning your product sells itself in most cases. Zeno only triggers discounts when intent is medium and the visitor is stuck. Overusing discounts erodes margin with no conversion benefit.`;
  }

  return `Currently monitoring ${sessions} sessions with a ${cvr}% CVR. ${ctx.today?.actions_taken ?? 0} actions taken today, ${ctx.today?.conversions ?? 0} conversions. What do you want to diagnose?`;
}

// ── API Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body.message ?? "";
    const context: ZenoContext = body.context ?? {};

    if (!message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const env = getEnv();

    // Try OpenAI first
    if (env.OPENAI_API_KEY) {
      try {
        const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const systemPrompt = buildSystemPrompt(context);

        const response = await client.chat.completions.create({
          model: env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.55,
          max_tokens: 180,
        }, { timeout: 9000 });

        const reply = response.choices[0]?.message?.content?.trim() ?? "";
        if (reply) {
          return NextResponse.json({ reply, source: "ai" });
        }
      } catch (e) {
        console.warn("[zeno/chat] OpenAI failed, using fallback:", e);
      }
    }

    // Rule-based fallback
    const reply = fallbackResponse(message, context);
    return NextResponse.json({ reply, source: "fallback" });

  } catch (err) {
    console.error("[zeno/chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
