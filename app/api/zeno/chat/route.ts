import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { query, ensureNolixSchema } from "@/lib/schema";

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

interface StoreAnalysisContext {
  foundation_score?: number;
  judgment?: string;
  business_type?: string;
  business_type_reasoning?: string;
  store_name_verdict?: string;
  product_problem?: string;
  product_classification?: string;
  is_consumable?: boolean;
  audience_age?: string;
  audience_income?: string;
  audience_geography?: string;
  audience_behavior?: string;
  homepage_score?: number;
  strengths?: string[];
  weaknesses?: string[];
  market_strength?: string;
  demand_level?: string;
  is_saturated?: boolean;
  competitor_strength?: string;
  monthly_visitors_low?: number;
  monthly_visitors_high?: number;
  daily_visitors_low?: number;
  daily_visitors_high?: number;
  cvr_est?: number;
  cvr_reasoning?: string;
  monthly_customers_low?: number;
  monthly_customers_high?: number;
  aov_est?: number;
  monthly_revenue_low?: number;
  monthly_revenue_high?: number;
  profit_margin_pct?: number;
  monthly_profit_low?: number;
  monthly_profit_high?: number;
  valuation_low?: number;
  valuation_high?: number;
  repeat_purchase?: boolean;
  repeat_cycle_days?: number | null;
  upsell_potential?: string | null;
  // Module 3 — Strategic Audit
  is_ad_dependent?: boolean;
  has_brand_identity?: boolean;
  content_presence?: string;
  content_channels?: string[];
  ux_speed_score?: number;
  ux_navigation_score?: number;
  checkout_friction?: string;
  checkout_steps_est?: number;
  trust_score?: number;
  trust_legitimacy?: string;
  review_strength?: string;
  branding_consistency?: string;
  scenario_best?: string;
  scenario_worst?: string;
  scenario_realistic?: string;
  fix_first?: string;
  growth_2x?: string;
  growth_10x?: string;
  final_verdict?: string;
  overall_recommendation?: string;
  zeno_summary?: string;
  data_source?: "live" | "benchmark" | "offline";
}

// ── System prompt builders ────────────────────────────────────────────────────
function buildSystemPrompt(ctx: ZenoContext, analysis?: StoreAnalysisContext | null): string {

  // ── Store foundation + market block ─────────────────────────────────────────
  const hasAnalysis = analysis?.foundation_score != null;
  const analysisBlock = hasAnalysis ? `
STORE INTELLIGENCE REPORT (use this to answer all store-specific questions):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE 1 — FOUNDATION ANALYSIS
- Foundation Score: ${analysis!.foundation_score}/10 → ${analysis!.judgment}
- Business Type: ${analysis!.business_type} — ${analysis!.business_type_reasoning ?? ""}
- Store Name: ${analysis!.store_name_verdict ?? "Not analyzed"}
- Product: ${analysis!.product_problem ?? "Unknown"} | ${analysis!.product_classification} | ${analysis!.is_consumable ? "Consumable (repeat)" : "One-time purchase"}
- Target Audience: Age ${analysis!.audience_age}, ${analysis!.audience_income} income, ${analysis!.audience_geography}, ${analysis!.audience_behavior} buyers
- Homepage Score: ${analysis!.homepage_score}/10
- Strengths: ${(analysis!.strengths ?? []).join(" | ")}
- Weaknesses: ${(analysis!.weaknesses ?? []).join(" | ")}
- Data quality: ${analysis!.data_source === "live" ? "Live page data" : "Benchmark estimates (store unreachable)"}

MODULE 2 — MARKET & REVENUE INTELLIGENCE
- Market: ${analysis!.market_strength} | Demand: ${analysis!.demand_level} | Saturated: ${analysis!.is_saturated ? "Yes" : "No"} | Competitors: ${analysis!.competitor_strength}
- Traffic: ${analysis!.daily_visitors_low?.toLocaleString()}–${analysis!.daily_visitors_high?.toLocaleString()} daily visitors | ${analysis!.monthly_visitors_low?.toLocaleString()}–${analysis!.monthly_visitors_high?.toLocaleString()} monthly
- CVR: ${analysis!.cvr_est}% — ${analysis!.cvr_reasoning ?? ""}
- Revenue: $${analysis!.monthly_revenue_low?.toLocaleString()}–$${analysis!.monthly_revenue_high?.toLocaleString()}/month
- Customers/month: ${analysis!.monthly_customers_low?.toLocaleString()}–${analysis!.monthly_customers_high?.toLocaleString()}
- AOV: $${analysis!.aov_est}
- Profit (${analysis!.profit_margin_pct}% margin): $${analysis!.monthly_profit_low?.toLocaleString()}–$${analysis!.monthly_profit_high?.toLocaleString()}/month
- Valuation: $${analysis!.valuation_low?.toLocaleString()}–$${analysis!.valuation_high?.toLocaleString()}
- Repeat purchase: ${analysis!.repeat_purchase ? `Yes — every ${analysis!.repeat_cycle_days} days` : `No — ${analysis!.upsell_potential ?? "upsell data not available"}`}

MODULE 3 — DEEP STRATEGIC AUDIT
- Marketing: ${analysis!.is_ad_dependent ? "Ad-dependent (risky)" : "Not ad-dependent"} | Brand identity: ${analysis!.has_brand_identity ? "Present" : "Missing"} | Content: ${analysis!.content_presence ?? "Unknown"}
- Active channels: ${(analysis!.content_channels ?? []).join(", ") || "None detected"}
- UX: Site speed ${analysis!.ux_speed_score ?? "?"}/10 | Navigation ${analysis!.ux_navigation_score ?? "?"}/10 | Checkout: ${analysis!.checkout_friction ?? "?"} friction | ${analysis!.checkout_steps_est ?? "?"} steps
- Trust: ${analysis!.trust_score ?? "?"}/10 | Legitimacy: ${analysis!.trust_legitimacy ?? "?"} | Reviews: ${analysis!.review_strength ?? "?"} | Branding consistency: ${analysis!.branding_consistency ?? "?"}
- Strategic strengths: ${(analysis!.strengths ?? []).join(" | ")}
- Buyer blockers: ${(analysis!.weaknesses ?? []).join(" | ")}
- Best scenario: ${analysis!.scenario_best ?? "N/A"}
- Realistic scenario: ${analysis!.scenario_realistic ?? "N/A"}
- Worst scenario: ${analysis!.data_source === "offline" ? "Store remains unreachable." : analysis!.scenario_worst ?? "N/A"}
- Fix first: ${analysis!.data_source === "offline" ? "Bring store online." : analysis!.fix_first ?? "N/A"}
- 2x growth path: ${analysis!.growth_2x ?? "N/A"}
- 10x growth path: ${analysis!.growth_10x ?? "N/A"}
- FINAL VERDICT: ${analysis!.final_verdict ?? "N/A"}
- Investment recommendation: ${analysis!.overall_recommendation ?? "N/A"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : "";

  // ── Behavioral data block ────────────────────────────────────────────────────
  const abGrouped = (ctx.ab_results ?? []).reduce((acc, r) => {
    if (!acc[r.variant]) acc[r.variant] = { impressions: 0, conversions: 0 };
    acc[r.variant].impressions += r.impressions;
    acc[r.variant].conversions += r.conversions;
    return acc;
  }, {} as Record<string, { impressions: number; conversions: number }>);
  const abSummary = Object.entries(abGrouped)
    .map(([v, d]) => `Variant ${v}: ${d.impressions} shown, ${d.conversions} converted (${d.impressions > 0 ? ((d.conversions / d.impressions) * 100).toFixed(1) : 0}% CVR)`)
    .join(" | ");

  const frictionSummary = (ctx.friction_distribution ?? [])
    .map(f => `${f.friction_detected}: ${f.count} sessions`)
    .join(", ");

  const intentSummary = (ctx.intent_distribution ?? [])
    .map(i => `${i.intent_level}: ${i.count}`)
    .join(", ");

  const recentSample = (ctx.sessions ?? []).slice(0, 3)
    .map(s => `[${s.intent_level} intent, ${s.cart_status}, ${s.device}] → ${s.offer_type ?? "no action"} → ${s.converted ? "CONVERTED" : "lost"}`)
    .join("\n");

  const hasBehaviorData = (ctx.total_sessions ?? 0) > 0;
  const behaviorBlock = hasBehaviorData ? `
LIVE BEHAVIOR ENGINE DATA:
- Sessions analyzed: ${ctx.total_sessions}
- High-intent visitors: ${ctx.high_intent_sessions} (${ctx.total_sessions ? Math.round(((ctx.high_intent_sessions ?? 0) / ctx.total_sessions) * 100) : 0}%)
- Offers shown: ${ctx.popups_shown} (${ctx.offer_rate_pct}% of sessions)
- Conversions: ${ctx.total_conversions} at ${ctx.cvr_pct}% CVR
- Revenue attributed: $${ctx.revenue_attributed}
- Discounts avoided: ${ctx.discount_saved_pct}% of buyers converted without discount
- Today: ${ctx.today?.analyzed} analyzed, ${ctx.today?.actions_taken} actions, ${ctx.today?.conversions} conversions
- Top action: ${ctx.top_action ?? "none"} at ${ctx.top_action_cvr}% CVR
- Friction: ${frictionSummary || "none yet"} | Intent: ${intentSummary || "none yet"}
- A/B: ${abSummary || "no data yet"}
${recentSample ? `- Recent: ${recentSample}` : ""}` : `
BEHAVIOR ENGINE: Active but no sessions recorded yet. Engine is watching — waiting for traffic.`;

  return `You are Zeno — a senior e-commerce revenue strategist, investor, and AI operator.

You are NOT an assistant. You are a revenue operator and business analyst.
Your job: analyze stores, detect problems, give decisive recommendations backed by data.

PERSONA RULES (CRITICAL):
- Direct. Never hedge. Never say "it seems" or "perhaps."
- Revenue-focused. Every answer ties back to money.
- Decisive. One clear action, not a list of options.
- Concise. Max 3–4 sentences. No filler. No bullet points.
- Never say "great question" or any similar fluff.
- Use specific numbers from the data whenever possible.
- When answering about a store's potential, cite the foundation score, revenue estimate, and market strength.
- When answering about behavior, cite sessions, CVR, and friction type.
${analysisBlock}
${behaviorBlock}

ZENO SELF-IMPROVEMENT: You are a self-improving system. When asked what you learned, cite your correction rules.

RESPONSE RULES:
- Foundation questions → cite score, business type, judgment, biggest weakness
- Revenue questions → cite monthly revenue range, CVR, AOV, valuation
- Market questions → cite demand level, saturation, competitor strength
- Audience questions → cite age, income, geography, behavior type
- Behavior questions → cite sessions, friction, top action, CVR
- A/B test questions → name the winning variant and CVR gap
- Every response feels like a 30-second investor briefing`;
}

// ── Rule-based fallback ───────────────────────────────────────────────────────
function fallbackResponse(message: string, ctx: ZenoContext, analysis?: StoreAnalysisContext | null): string {
  const msg = message.toLowerCase();

  // Store analysis fallbacks
  if (analysis?.foundation_score != null) {
    const score = analysis.foundation_score;
    const rev = analysis.monthly_revenue_low != null
      ? `$${analysis.monthly_revenue_low.toLocaleString()}–$${analysis.monthly_revenue_high?.toLocaleString()}/month`
      : "unknown";

    if (msg.includes("foundation") || msg.includes("score")) {
      return `Foundation score is ${score}/10 — ${analysis.judgment}. ${(analysis.weaknesses ?? [])[0] ?? "No major weaknesses detected"} is the primary risk. ${score >= 7 ? "Investable." : "Needs work before scaling."}`;
    }
    if (msg.includes("revenue") || msg.includes("make") || msg.includes("earn")) {
      return `Estimated revenue: ${rev} at ${analysis.cvr_est}% CVR with a $${analysis.aov_est} AOV. Profit potential (${analysis.profit_margin_pct}% margin): $${analysis.monthly_profit_low?.toLocaleString()}–$${analysis.monthly_profit_high?.toLocaleString()}/month. Business valuation range: $${analysis.valuation_low?.toLocaleString()}–$${analysis.valuation_high?.toLocaleString()}.`;
    }
    if (msg.includes("business") || msg.includes("type") || msg.includes("model")) {
      return `This is a ${analysis.business_type} business. ${analysis.business_type_reasoning ?? ""} ${analysis.product_classification === "NEED" ? "Product solves a real need — demand is structural." : "Product is discretionary — demand is driven by desire and marketing."}`;
    }
    if (msg.includes("buyer") || msg.includes("audience") || msg.includes("customer")) {
      return `Target: ${analysis.audience_age}-year-old ${analysis.audience_income?.toLowerCase()}-income ${analysis.audience_behavior?.toLowerCase()} buyers in ${analysis.audience_geography}. ${analysis.is_consumable ? "Repeat purchase every ~" + analysis.repeat_cycle_days + " days — strong LTV." : analysis.upsell_potential ?? "One-time purchase — upsell strategy critical."}`;
    }
    if (msg.includes("market") || msg.includes("worth") || msg.includes("enter")) {
      return `Market is ${analysis.market_strength} with ${analysis.demand_level?.toLowerCase()} demand. ${analysis.is_saturated ? "Saturated market — differentiation is mandatory." : "Not fully saturated — entry window still open."} Competition is ${analysis.competitor_strength?.toLowerCase()}. ${analysis.market_strength === "Strong" ? "Worth entering with the right angle." : "Enter only with a clear moat."}`;
    }
  }

  // Behavioral fallbacks
  const sessions = ctx.total_sessions ?? 0;
  const cvr = ctx.cvr_pct ?? 0;
  const conversions = ctx.total_conversions ?? 0;
  const topFriction = (ctx.friction_distribution ?? []).sort((a, b) => Number(b.count) - Number(a.count))[0];

  if (sessions === 0) {
    return "Zeno is active and monitoring. No behavioral sessions recorded yet — drive some traffic or test the engine at /api/convert/analyze to see real data.";
  }
  if (msg.includes("losing") || msg.includes("revenue") || msg.includes("why")) {
    const lost = sessions - conversions;
    return `Out of ${sessions} sessions, ${lost} didn't convert. CVR is ${cvr}% — below optimal. Fix checkout hesitation first, that's where the money is leaking.`;
  }
  if (msg.includes("fix") || msg.includes("improve")) {
    if (topFriction?.friction_detected === "stuck_cart") {
      return `Fix cart abandonment first. ${topFriction.count} sessions got stuck with items in cart — a timed urgency message recovers 15–25% of them.`;
    }
    return `Reduce checkout hesitation. ${ctx.today?.actions_taken ?? 0} smart actions triggered today — scale that intervention rate and conversions follow directly.`;
  }

  return `Monitoring ${sessions} sessions at ${cvr}% CVR. ${ctx.today?.actions_taken ?? 0} actions taken today, ${ctx.today?.conversions ?? 0} conversions recovered. What do you want to analyze?`;
}

// ── API Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body.message ?? "";
    const context: ZenoContext = body.context ?? {};
    const storeAnalysis: StoreAnalysisContext | null = body.storeAnalysis ?? null;

    if (!message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // ── Fast-path: Learning log questions ────────────────────────────────────
    const msgLow = message.toLowerCase();
    if (msgLow.includes("learn") || msgLow.includes("ما تعلم") || msgLow.includes("self-improv") || msgLow.includes("rules") || msgLow.includes("memory")) {
      try {
        await ensureNolixSchema().catch(() => {});
        const rows = await query(
          `SELECT error_type, correction_rule, confidence_before, confidence_after, phase, created_at
           FROM zeno_learning_log ORDER BY created_at DESC LIMIT 5`,
          []
        );
        const entries = rows;
        if (entries.length === 0) {
          return NextResponse.json({ reply: "I haven't completed a self-improvement cycle yet. Analyze a store and I'll automatically audit my output, detect errors, and store correction rules in memory.", source: "learning" });
        }
        const totalGain = entries.reduce((s: number, e: any) => s + Math.max(0, (e.confidence_after ?? 0) - (e.confidence_before ?? 0)), 0);
        const rules = entries.map((e: any, i: number) => `${i + 1}. [${e.phase}/${e.error_type.replace(/_/g,' ')}] → ${e.correction_rule}`).join("\n");
        const reply = `I've completed ${entries.length} self-improvement cycles so far with +${totalGain}% total confidence gained.\n\nMost recent correction rules I'm now applying:\n${rules}\n\nThese rules are injected into every new analysis to prevent repeating the same errors. View the full log at /zeno/learning-log.`;
        return NextResponse.json({ reply, source: "learning" });
      } catch {
        // Fall through to AI
      }
    }

    const env = getEnv();

    // ── DOMAIN GATE AWARENESS ────────────────────────────────────────────────
    // Before producing any revenue/market estimates, check if the store's domain
    // passed the Domain Gate. If not, Zeno must acknowledge uncertainty and refuse
    // to invent numbers. This prevents "AI that makes up revenue for template sites."
    let domainGateStatus: { eligible: boolean; stop_reason?: string; domain_type?: string } | null = null;
    try {
      await ensureNolixSchema().catch(() => {});
      type GateRow = { domain_gate_result: { eligible: boolean; stop_reason?: string; domain_type?: string } | null };
      const gateRows = await query<GateRow>(
        `SELECT domain_gate_result FROM users WHERE id = (
           SELECT id FROM users WHERE store_url IS NOT NULL
           ORDER BY created_at DESC LIMIT 1
         ) LIMIT 1`
      );
      domainGateStatus = gateRows[0]?.domain_gate_result ?? null;
    } catch { /* Non-blocking */ }

    // If gate explicitly rejected this domain, override any analysis with a hard boundary
    if (domainGateStatus && !domainGateStatus.eligible) {
      const stopReason = domainGateStatus.stop_reason ?? "UNKNOWN";
      const domainType = domainGateStatus.domain_type ?? "unknown";
      const gateReply = `I cannot produce revenue estimates or market analysis for this domain.

**Domain Gate Result:** ${stopReason.replace(/_/g, " ")}
**Detected Type:** ${domainType}

This means the site either:
- Is not a recognized ecommerce store
- Contains placeholder/demo data
- Has no detectable product schema or cart flow

**I will not invent numbers.** Revenue estimates, traffic projections, and CVR figures would be fabricated — and fabricated intelligence is worse than no intelligence.

**What you should do:** Run \`/api/analyze/initialize\` with a live production store URL that has real products and a checkout flow.`;

      return NextResponse.json({ reply: gateReply, source: "domain_gate_blocked" });
    }

    if (env.GROQ_CHAT_KEY ?? env.OPENAI_API_KEY) {

      try {
        const client = new OpenAI({ 
          apiKey: env.GROQ_CHAT_KEY ?? env.OPENAI_API_KEY!,
          baseURL: env.AI_BASE_URL ?? "https://api.groq.com/openai/v1"
        });
        // ── Fetch Learning Memory for System Prompt ───────────────────────────
        let learningMemory = "";
        try {
          type MemRow = { error_type: string; correction_rule: string };
          const memRows = await query<MemRow>(
            `SELECT error_type, correction_rule FROM zeno_learning_log ORDER BY created_at DESC LIMIT 10`,
            []
          );
          if (memRows.length > 0) {
            learningMemory = "\n\n=== RECENT LESSONS LEARNED (APPLY THESE) ===\n" +
              memRows.map((r, i) => `${i+1}. [${r.error_type}] \u2192 ${r.correction_rule}`).join("\n");
          }
        } catch (e) {
          console.warn("[zeno/chat] Failed to fetch learning memory for prompt:", e);
        }

        const systemPrompt = buildSystemPrompt(context, storeAnalysis) + learningMemory;

        const response = await client.chat.completions.create({
          model: env.GROQ_CHAT_MODEL ?? "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.5,
          max_tokens: 400,
        }, { timeout: 9000 });

        const reply = response.choices[0]?.message?.content?.trim() ?? "";
        if (reply) return NextResponse.json({ reply, source: "ai" });
      } catch (e) {
        console.warn("[zeno/chat] OpenAI failed, using fallback:", e);
      }
    }

    const reply = fallbackResponse(message, context, storeAnalysis);
    return NextResponse.json({ reply, source: "fallback" });

  } catch (err) {
    console.error("[zeno/chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
