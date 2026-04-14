import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { query, ensureNolixSchema } from "@/lib/schema";
import { getEnv } from "@/lib/env";
import {
  causalDecide,
  getCohortUplift,
  type SessionSignals,
  type ActionType,
} from "@/lib/causal-engine";
import { buildDecisionTrace, persistDecisionTrace } from "@/lib/decision-explainer";

// ─────────────────────────────────────────────
// Input schema (enriched for causal signals)
// ─────────────────────────────────────────────
const sessionSchema = z.object({
  time_on_site:      z.number().min(0).max(7200),
  pages_viewed:      z.number().min(1).max(100),
  traffic_source:    z.enum(["organic","paid_ads","direct","email","social","referral"]),
  cart_status:       z.enum(["empty","added","checkout"]),
  device:            z.enum(["desktop","mobile","tablet","smart_tv"]),
  session_id:        z.string().optional(),
  scroll_depth_pct:  z.number().min(0).max(100).optional(),
  return_visitor:    z.boolean().optional(),
  price_bucket:      z.enum(["low","mid","high"]).optional(),
});

type SessionInput = z.infer<typeof sessionSchema>;
type IntentLevel  = "low" | "medium" | "high";
type FrictionType = "none" | "hesitant" | "stuck_cart" | "bounce_risk";

// ─────────────────────────────────────────────
// Signal Processing (Perception Layer Only)
// These layers classify signals — they do NOT make decisions.
// ─────────────────────────────────────────────
function layer1_intent(s: SessionInput): { score: number; level: IntentLevel } {
  let score = 0;
  if      (s.time_on_site >= 300) score += 25;
  else if (s.time_on_site >= 120) score += 16;
  else if (s.time_on_site >=  60) score +=  8;
  else if (s.time_on_site >=  30) score +=  3;
  if      (s.pages_viewed >= 10) score += 20;
  else if (s.pages_viewed >=  6) score += 14;
  else if (s.pages_viewed >=  3) score +=  8;
  else                           score +=  2;
  if      (s.cart_status === "checkout") score += 35;
  else if (s.cart_status === "added")    score += 20;
  const srcScore: Record<string, number> = {
    paid_ads: 15, email: 14, direct: 12, referral: 10, social: 8, organic: 6,
  };
  score += srcScore[s.traffic_source] ?? 5;
  if      (s.device === "desktop") score += 5;
  else if (s.device === "tablet")  score += 3;
  else                             score += 1;
  if ((s.scroll_depth_pct ?? 0) >= 70) score += 8;
  else if ((s.scroll_depth_pct ?? 0) >= 40) score += 4;
  if (s.return_visitor) score += 10;
  const capped = Math.min(100, score);
  let level: IntentLevel = "low";
  if (capped >= 65) level = "high";
  else if (capped >= 30) level = "medium";
  return { score: capped, level };
}

function layer2_friction(s: SessionInput, intent: IntentLevel): FrictionType {
  if (s.time_on_site < 20 || s.pages_viewed <= 1) return "bounce_risk";
  if ((s.cart_status === "added" || s.cart_status === "checkout") &&
      s.time_on_site >= 120 && s.pages_viewed >= 2) {
    return "stuck_cart";
  }
  if (s.pages_viewed >= 4 && s.cart_status === "empty" && intent !== "low") {
    return "hesitant";
  }
  return "none";
}

// ─────────────────────────────────────────────
// Copy Generator — AI writes words, NOT decisions
// ─────────────────────────────────────────────
async function generateCopy(
  s: SessionInput,
  action: ActionType,
  intentLevel: IntentLevel,
  friction: FrictionType,
  variant: "A" | "B"
): Promise<{ headline: string; sub_message: string; cta_text: string; urgency_line: string | null }> {
  const env = getEnv();
  const ACTION_BRIEF: Record<ActionType, string> = {
    do_nothing:    "no message needed",
    urgency:       "create urgency — item is selling fast or limited stock",
    popup_info:    "help them choose — friendly product guide message",
    discount_5:    "offer a 5% discount to tip them over",
    discount_10:   "offer a 10% discount — they need a clear saving",
    discount_15:   "offer a 15% flash discount — rescue this purchase",
    free_shipping: "offer free shipping — remove the last barrier",
    bundle:        "suggest a value bundle — give them more for the same price",
  };
  if (!env.GROQ_OPS_KEY && !env.OPENAI_API_KEY) throw new Error("No Ops API key");
  const client = new OpenAI({
    apiKey: env.GROQ_OPS_KEY ?? env.OPENAI_API_KEY!,
    baseURL: env.AI_BASE_URL ?? "https://api.groq.com/openai/v1",
  });
  const response = await client.chat.completions.create({
    model: env.GROQ_OPS_MODEL ?? "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: `You are a world-class e-commerce copywriter. The conversion system already decided the action. Your ONLY job is to write compelling copy for it. Reply ONLY with valid JSON. Schema: { "headline": string, "sub_message": string, "cta_text": string, "urgency_line": string | null }. Keep headline under 9 words. sub_message: 1-2 sentences. cta_text: action verb under 5 words. Variant B: more emotional and urgent than Variant A.` },
      { role: "user", content: `Action: ${action} — ${ACTION_BRIEF[action]}\nVisitor: ${s.time_on_site}s on site, ${s.pages_viewed} pages, source: ${s.traffic_source}, cart: ${s.cart_status}, device: ${s.device}\nFriction: ${friction}, Intent: ${intentLevel}, Variant: ${variant}` },
    ],
    temperature: variant === "B" ? 0.85 : 0.65,
    max_tokens: 120,
    response_format: { type: "json_object" },
  }, { timeout: 8000 });
  return JSON.parse(response.choices[0]?.message?.content ?? "{}");
}

function fallbackCopy(action: ActionType) {
  const COPIES: Record<ActionType, { headline: string; sub_message: string; cta_text: string; urgency_line: string | null }> = {
    do_nothing:    { headline: "", sub_message: "", cta_text: "", urgency_line: null },
    urgency:       { headline: "Almost Gone!", sub_message: "Items in your cart are selling fast. Secure yours now.", cta_text: "Complete My Order", urgency_line: "⌛ Order in the next 15 min to guarantee delivery" },
    popup_info:    { headline: "Need a hand?", sub_message: "Our bestsellers are picked just for you.", cta_text: "Show Me", urgency_line: null },
    discount_5:    { headline: "5% Off — Just for You", sub_message: "Use code SAVE5 at checkout before it expires.", cta_text: "Claim 5% Off", urgency_line: "⌛ Expires in 10 minutes" },
    discount_10:   { headline: "Your 10% Off Is Ready", sub_message: "You've earned it. Apply the discount now before it's gone.", cta_text: "Apply 10% Off", urgency_line: "⌛ Offer expires in 15 minutes" },
    discount_15:   { headline: "🔥 15% Off — Last Chance", sub_message: "This exclusive flash deal is yours right now. Don't miss it.", cta_text: "Get 15% Off Now", urgency_line: "⚡ Flash deal — ends soon" },
    free_shipping: { headline: "Free Shipping Unlocked!", sub_message: "Complete your order now and we'll cover the shipping.", cta_text: "Get Free Shipping", urgency_line: null },
    bundle:        { headline: "Better Together", sub_message: "Get more value with our curated bundle—just for you.", cta_text: "See Bundle Deal", urgency_line: null },
  };
  return COPIES[action] ?? COPIES.urgency;
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const body   = await req.json();
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const s         = parsed.data;
    const sessionId = s.session_id ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const variant   = (Math.random() < 0.5 ? "A" : "B") as "A" | "B";

    // ── LAYER 1 & 2: Signal Perception ──
    const { score, level } = layer1_intent(s);
    const friction         = layer2_friction(s, level);

    const signals: SessionSignals = {
      intent_level:     level,
      friction,
      cart_status:      s.cart_status,
      device:           s.device,
      traffic_source:   s.traffic_source,
      scroll_depth_pct: s.scroll_depth_pct,
      return_visitor:   s.return_visitor,
      price_bucket:     s.price_bucket,
    };

    // ── CAUSAL DECISION: argmax over A { Expected_Uplift(A | context) } ──
    const decision   = await causalDecide(signals);
    const showPopup  = decision.action !== "do_nothing" && decision.group_assignment === "treatment";

    // ── Fetch cohort data (needed for explainability trace) ──
    const cohortData = await getCohortUplift(decision.cohort_key);

    // ── Copy Generation ──
    let copy: ReturnType<typeof fallbackCopy>;
    try {
      copy = showPopup
        ? await generateCopy(s, decision.action, level, friction, variant)
        : fallbackCopy("do_nothing");
    } catch (e) {
      copy = fallbackCopy(decision.action);
    }

    const message = copy.headline && copy.sub_message
      ? `${copy.headline} — ${copy.sub_message}` : null;

    // ── Persist Session with Full Causal Metadata ──
    await query(
      `INSERT INTO popup_sessions
        (session_id, ab_variant, time_on_site, pages_viewed, traffic_source,
         cart_status, device, intent_score, intent_level, show_popup,
         offer_type, message, reasoning, friction_detected,
         group_assignment, cohort_key, expected_uplift, uplift_confidence,
         scroll_depth_pct, return_visitor, price_bucket)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT DO NOTHING`,
      [
        sessionId, variant, s.time_on_site, s.pages_viewed, s.traffic_source,
        s.cart_status, s.device, score, level, showPopup,
        showPopup ? decision.action : null, message, decision.reasoning,
        friction, decision.group_assignment, decision.cohort_key,
        decision.expected_uplift, decision.uplift_confidence,
        s.scroll_depth_pct ?? null, s.return_visitor ?? false, s.price_bucket ?? null,
      ]
    );

    // ── A/B Impressions ──
    if (showPopup) {
      await query(
        `INSERT INTO ab_test_results (variant, offer_type, impressions)
         VALUES ($1, $2, 1)
         ON CONFLICT (variant, offer_type)
         DO UPDATE SET impressions = ab_test_results.impressions + 1, updated_at = now()`,
        [variant, decision.action]
      );
    }

    const response = NextResponse.json({
      session_id:    sessionId,
      ab_variant:    variant,
      intent_score:  score,
      intent_level:  level,
      friction,
      show_popup:    showPopup,
      offer_type:    showPopup ? decision.action : null,
      headline:      copy.headline || null,
      sub_message:   copy.sub_message || null,
      cta_text:      copy.cta_text || null,
      urgency_line:  copy.urgency_line || null,
      delay_ms:      showPopup ? 5000 : 0,
      causal: {
        group_assignment:  decision.group_assignment,
        cohort_key:        decision.cohort_key,
        decision_mode:     decision.decision_mode,
        expected_uplift:   decision.expected_uplift,
        uplift_confidence: decision.uplift_confidence,
        stability_score:   decision.stability_score,
        reasoning:         decision.reasoning,
      },
    });

    // ── Decision Trace: fire-and-forget (does NOT block response) ──
    void buildDecisionTrace({ sessionId, signals, decision, cohortData })
      .then(trace => persistDecisionTrace(sessionId, trace))
      .catch(e => console.warn("[analyze] DecisionTrace failed:", e));

    return response;

  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
