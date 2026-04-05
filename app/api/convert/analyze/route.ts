import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { query, ensureConvertAISchema } from "@/lib/schema";
import { getEnv } from "@/lib/env";

// ─────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────
const sessionSchema = z.object({
  time_on_site:   z.number().min(0).max(7200),
  pages_viewed:   z.number().min(1).max(100),
  traffic_source: z.enum(["organic","paid_ads","direct","email","social","referral"]),
  cart_status:    z.enum(["empty","added","checkout"]),
  device:         z.enum(["desktop","mobile","tablet","smart_tv"]),
  session_id:     z.string().optional(),
});

type SessionInput = z.infer<typeof sessionSchema>;

// ─────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────
type IntentLevel   = "low" | "medium" | "high";
type FrictionType  = "none" | "paralysis" | "stuck_cart" | "bounce_risk";
type ActionType    = "do_nothing" | "urgency" | "popup_info" | "discount_5" | "discount_10" | "discount_15" | "free_shipping" | "bundle";

interface DecisionContext {
  intent_score:     number;
  intent_level:     IntentLevel;
  friction:         FrictionType;
  needs_incentive:  boolean;
  action:           ActionType;
  delay_ms:         number;   // How many ms before showing popup
}

// ─────────────────────────────────────────────
// LAYER 1 – Intent Check
// "Is the user interested? Are they browsing or buying?"
// ─────────────────────────────────────────────
function layer1_intent(s: SessionInput): { score: number; level: IntentLevel } {
  let score = 0;

  // Time on site
  if      (s.time_on_site >= 300) score += 25;
  else if (s.time_on_site >= 120) score += 16;
  else if (s.time_on_site >=  60) score +=  8;
  else if (s.time_on_site >=  30) score +=  3;

  // Pages viewed
  if      (s.pages_viewed >= 10) score += 20;
  else if (s.pages_viewed >=  6) score += 14;
  else if (s.pages_viewed >=  3) score +=  8;
  else                           score +=  2;

  // Cart state (strongest signal)
  if      (s.cart_status === "checkout") score += 35;
  else if (s.cart_status === "added")    score += 20;

  // Traffic source
  const srcScore: Record<string, number> = {
    paid_ads: 15, email: 14, direct: 12, referral: 10, social: 8, organic: 6,
  };
  score += srcScore[s.traffic_source] ?? 5;

  // Device
  if      (s.device === "desktop") score += 5;
  else if (s.device === "tablet")  score += 3;
  else                             score += 1;

  const capped = Math.min(100, score);

  let level: IntentLevel = "low";
  if (capped >= 65) level = "high";
  else if (capped >= 30) level = "medium";

  return { score: capped, level };
}

// ─────────────────────────────────────────────
// LAYER 2 – Friction Check
// "Is the user hesitating? Where are they stuck?"
// ─────────────────────────────────────────────
function layer2_friction(s: SessionInput, intent: IntentLevel): FrictionType {
  // Bounce risk: too early to interrupt
  if (s.time_on_site < 20 || s.pages_viewed <= 1) return "bounce_risk";

  // Stuck in cart: has item but hasn't checked out, spent long time
  if ((s.cart_status === "added" || s.cart_status === "checkout") &&
      s.time_on_site >= 180 &&
      s.pages_viewed >= 3) {
    return "stuck_cart";
  }

  // Choice paralysis: browsed a lot but cart is empty
  if (s.pages_viewed >= 7 && s.cart_status === "empty" && intent !== "low") {
    return "paralysis";
  }

  return "none";
}

// ─────────────────────────────────────────────
// LAYER 3 – Incentive Check
// "Does this user NEED a discount, or will they buy anyway?"
// ─────────────────────────────────────────────
function layer3_incentive(s: SessionInput, intent: IntentLevel, friction: FrictionType): boolean {
  // Already at checkout with high intent → urgency is enough (no discount = margin saved)
  if (s.cart_status === "checkout" && intent === "high") return false;

  // At checkout but medium intent → small nudge may help
  if (s.cart_status === "checkout" && intent === "medium") return true;

  // Stuck in cart from expensive ad → don't waste the lead
  if (friction === "stuck_cart" && s.traffic_source === "paid_ads") return true;

  // Choice paralysis → free shipping / bundle is better than discount
  if (friction === "paralysis") return false; // bundle/shipping logic, not pure discount

  // Low intent → no incentive, don't cheapen the brand
  if (intent === "low") return false;

  // Medium intent with high-value source
  if (intent === "medium" && ["email","paid_ads"].includes(s.traffic_source)) return true;

  return false;
}

// ─────────────────────────────────────────────
// LAYER 4 – Best Action Selection
// "One smart action. No noise."
// ─────────────────────────────────────────────
function layer4_action(
  s: SessionInput,
  intent: IntentLevel,
  friction: FrictionType,
  needsIncentive: boolean
): { action: ActionType; delay_ms: number } {
  // Do nothing if it's too early or intent is too low
  if (friction === "bounce_risk" || intent === "low") {
    return { action: "do_nothing", delay_ms: 0 };
  }

  // High intent at checkout → urgency message (no discount needed)
  if (s.cart_status === "checkout" && intent === "high" && !needsIncentive) {
    return { action: "urgency", delay_ms: 8_000 };
  }

  // Stuck in cart + needs incentive → offer a discount to rescue the conversion
  if (friction === "stuck_cart" && needsIncentive) {
    const offer: ActionType = s.traffic_source === "paid_ads" ? "discount_15" : "discount_10";
    return { action: offer, delay_ms: 5_000 };
  }

  // Choice paralysis → bundle or free shipping to break the stalemate
  if (friction === "paralysis") {
    const offer: ActionType = s.device === "mobile" ? "free_shipping" : "bundle";
    return { action: offer, delay_ms: 12_000 };
  }

  // Medium intent, needs incentive, normal flow
  if (intent === "medium" && needsIncentive) {
    return { action: "free_shipping", delay_ms: 15_000 };
  }

  // High intent cart added, not at checkout yet
  if (intent === "high" && s.cart_status === "added") {
    return { action: "discount_10", delay_ms: 8_000 };
  }

  // Default: show a gentle popup
  if (intent === "medium") {
    return { action: "free_shipping", delay_ms: 20_000 };
  }

  return { action: "do_nothing", delay_ms: 0 };
}

// ─────────────────────────────────────────────
// LAYER 5 – Smart Execution
// OpenAI generates the MESSAGE for the decided action.
// OpenAI does NOT decide the action—it just writes the copy.
// ─────────────────────────────────────────────
async function layer5_message(
  s: SessionInput,
  ctx: DecisionContext,
  variant: "A" | "B"
): Promise<{ headline: string; sub_message: string; cta_text: string; urgency_line: string | null }> {
  const env = getEnv();

  const ACTION_BRIEF: Record<ActionType, string> = {
    do_nothing:   "no message needed",
    urgency:      "create urgency — item is selling fast or limited stock",
    popup_info:   "help them choose — friendly product guide message",
    discount_5:   "offer a 5% discount to tip them over",
    discount_10:  "offer a 10% discount — they need a clear saving",
    discount_15:  "offer a 15% flash discount — rescue this purchase",
    free_shipping: "offer free shipping — remove the last barrier",
    bundle:       "suggest a value bundle — give them more for the same price",
  };

  const brief = ACTION_BRIEF[ctx.action];

  const systemPrompt = `You are a world-class e-commerce copywriter.
The conversion system already decided the action. Your ONLY job is to write compelling copy for it.
Reply ONLY with valid JSON, no markdown.
Schema: { "headline": string, "sub_message": string, "cta_text": string, "urgency_line": string | null }
Rules:
- Keep headline under 9 words, punchy and direct
- sub_message should feel personal and conversational, 1-2 sentences
- cta_text: action verb phrase under 5 words
- urgency_line: one short line to add urgency (or null if not relevant)
- Variant B: more emotional and urgent copy than Variant A`;

  const userMsg = `Action: ${ctx.action} — ${brief}
Visitor context: ${s.time_on_site}s on site, ${s.pages_viewed} pages, source: ${s.traffic_source}, cart: ${s.cart_status}, device: ${s.device}
Friction: ${ctx.friction}, Intent level: ${ctx.intent_level}
A/B Variant: ${variant}`;

  if (!env.GROQ_OPS_KEY && !env.OPENAI_API_KEY) throw new Error("No Ops API key");

  const client = new OpenAI({ 
    apiKey: env.GROQ_OPS_KEY ?? env.OPENAI_API_KEY!,
    baseURL: env.AI_BASE_URL ?? "https://api.groq.com/openai/v1"
  });
  const response = await client.chat.completions.create({
    model: env.GROQ_OPS_MODEL ?? "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMsg },
    ],
    temperature: variant === "B" ? 0.85 : 0.65,
    max_tokens: 120,
    response_format: { type: "json_object" },
  }, { timeout: 8000 });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

// Rule-based fallback copy (if OpenAI fails)
function fallbackCopy(action: ActionType): { headline: string; sub_message: string; cta_text: string; urgency_line: string | null } {
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
    await ensureConvertAISchema();

    const body  = await req.json();
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const s         = parsed.data;
    const sessionId = s.session_id ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const variant   = (Math.random() < 0.5 ? "A" : "B") as "A" | "B";

    // ── Run decision pipeline ──
    const { score, level }  = layer1_intent(s);
    const friction          = layer2_friction(s, level);
    const needsIncentive    = layer3_incentive(s, level, friction);
    const { action, delay_ms } = layer4_action(s, level, friction, needsIncentive);

    const ctx: DecisionContext = {
      intent_score: score,
      intent_level: level,
      friction,
      needs_incentive: needsIncentive,
      action,
      delay_ms,
    };

    const showPopup = action !== "do_nothing";

    // ── Generate message copy ──
    let copy: ReturnType<typeof fallbackCopy>;
    const reasoning = `L1:intent=${level}(${score}) | L2:friction=${friction} | L3:incentive=${needsIncentive} | L4:action=${action}`;
    try {
      if (showPopup) {
        copy = await layer5_message(s, ctx, variant);
      } else {
        copy = fallbackCopy("do_nothing");
      }
    } catch (e) {
      console.warn("[OpenAI Fallback Triggered]", e);
      copy = fallbackCopy(action);
    }

    // ── Persist session ──
    const message = copy.headline && copy.sub_message ? `${copy.headline} — ${copy.sub_message}` : null;
    await query(
      `INSERT INTO popup_sessions
        (session_id, ab_variant, time_on_site, pages_viewed, traffic_source,
         cart_status, device, intent_score, intent_level, show_popup,
         offer_type, message, reasoning)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        sessionId, variant, s.time_on_site, s.pages_viewed, s.traffic_source,
        s.cart_status, s.device, score, level, showPopup,
        showPopup ? action : null, message, reasoning,
      ]
    );

    // ── Update A/B impression counters ──
    if (showPopup) {
      await query(
        `INSERT INTO ab_test_results (variant, offer_type, impressions)
         VALUES ($1, $2, 1)
         ON CONFLICT (variant, offer_type)
         DO UPDATE SET impressions = ab_test_results.impressions + 1, updated_at = now()`,
        [variant, action]
      );
    }

    return NextResponse.json({
      session_id:   sessionId,
      ab_variant:   variant,
      intent_score: score,
      intent_level: level,
      friction,
      needs_incentive: needsIncentive,
      show_popup:   showPopup,
      offer_type:   showPopup ? action : null,
      headline:     copy.headline || null,
      sub_message:  copy.sub_message || null,
      cta_text:     copy.cta_text || null,
      urgency_line: copy.urgency_line || null,
      delay_ms,
      reasoning,
    });

  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
