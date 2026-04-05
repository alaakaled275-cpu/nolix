/**
 * app/api/store/analyze/route.ts
 * Zeno Intelligence Pipeline — 3-Phase Analysis
 * Phase 1: Foundation Analysis
 * Phase 2: Market & Numbers
 * Phase 3: Deep Strategic Analysis
 * Provider: Groq (free) via OpenAI-compatible SDK
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { scrapeStore, type StoreSignals } from "@/lib/scraper";
import { getEnv } from "@/lib/env";

// ── Input ──────────────────────────────────────────────────────────────────────
const inputSchema = z.object({ url: z.string().min(3).max(500) });

// ── Types ──────────────────────────────────────────────────────────────────────
export interface FoundationAnalysis {
  is_ecommerce: boolean;
  ecommerce_confidence: "confident" | "likely" | "unclear" | "not_ecommerce";
  foundation_score: number;
  judgment: string;
  store_name_verdict: string;
  business_type: "Dropshipping" | "Brand" | "Reseller" | "Manufacturer" | "Unknown";
  business_type_reasoning: string;
  product_problem: string;
  product_classification: "NEED" | "WANT" | "INSUFFICIENT_DATA";
  is_consumable: boolean | null;
  audience_age: string;
  audience_income: string;
  audience_geography: string;
  audience_behavior: string;
  homepage_score: number;
  homepage_clarity: string;
  homepage_trust_elements: string[];
  homepage_cta_strength: string;
  strengths: string[];
  weaknesses: string[];
}

export interface MarketIntelligence {
  market_strength: "Strong" | "Moderate" | "Weak";
  market_size_analysis: string;
  demand_level: "High" | "Medium" | "Low";
  is_saturated: boolean;
  saturation_analysis: string;
  competitor_strength: "Dominant" | "Strong" | "Moderate" | "Fragmented";
  competitor_analysis: string;
  daily_visitors_low: number;
  daily_visitors_high: number;
  monthly_visitors_low: number;
  monthly_visitors_high: number;
  cvr_low: number;
  cvr_mid: number;
  cvr_high: number;
  cvr_reasoning: string;
  monthly_customers_low: number;
  monthly_customers_high: number;
  aov_est: number | null;
  monthly_revenue_low: number | null;
  monthly_revenue_high: number | null;
  profit_margin_pct: number | null;
  monthly_profit_low: number | null;
  monthly_profit_high: number | null;
  valuation_low: number | null;
  valuation_high: number | null;
  repeat_purchase: boolean;
  repeat_cycle_days: number | null;
  repeat_purchase_analysis: string;
  upsell_potential: string | null;
  market_verdict: string;
}

export interface StrategicAudit {
  is_ad_dependent: boolean;
  has_brand_identity: boolean;
  content_presence: "Strong" | "Moderate" | "Minimal" | "None";
  content_channels: string[];
  marketing_analysis: string;
  ux_speed_score: number;
  ux_navigation_score: number;
  ux_analysis: string;
  checkout_friction: "High" | "Medium" | "Low";
  checkout_steps_est: number;
  trust_score: number;
  trust_legitimacy: "High" | "Medium" | "Low";
  review_strength: "Strong" | "Moderate" | "Weak" | "None";
  branding_consistency: "High" | "Medium" | "Low";
  trust_analysis: string;
  strengths: string[];
  weaknesses: string[];
  scenario_best: string;
  scenario_worst: string;
  scenario_realistic: string;
  fix_first: string;
  growth_2x: string;
  growth_10x: string;
  health_score: number;
  health_breakdown_foundation: number;
  health_breakdown_market: number;
  health_breakdown_ux: number;
  health_breakdown_trust: number;
  health_breakdown_revenue_potential: number;
  health_why_not_100: string[];
  health_top_priority: string;
  final_verdict: "🔥 High potential" | "⚠️ Medium risk" | "❌ Not recommended";
  action_plan: string[];
  overall_recommendation: string;
}

export interface StoreAnalysisResult {
  url: string;
  data_source: "live" | "benchmark";
  is_ecommerce: boolean;
  signals: Pick<StoreSignals, "title" | "platform" | "prices" | "lowestPrice" | "highestPrice" | "trustKeywords" | "nicheHints" | "wordCount">;
  foundation: FoundationAnalysis;
  market: MarketIntelligence;
  strategic: StrategicAudit;
  zeno_summary: string;
}

// ── Signal Block ───────────────────────────────────────────────────────────────
function buildSignalBlock(signals: StoreSignals): string {
  return [
    "=== ZENO RAW SIGNAL REPORT ===",
    `URL: ${signals.url}`,
    `HTML extracted: ${signals.wordCount > 0 ? `YES — ${signals.wordCount} words` : "NO — site blocked or JS-rendered"}`,
    `Title: ${signals.title ?? "Not detected"}`,
    `Meta: ${signals.metaDescription ?? "Not detected"}`,
    `H1: ${signals.h1 ?? "Not detected"}`,
    `Platform: ${signals.platform ?? "None"}`,
    `Prices detected: ${signals.prices.length > 0 ? signals.prices.slice(0, 10).join(", ") : "NONE"}`,
    `Price range: ${signals.lowestPrice != null ? `${signals.lowestPrice}–${signals.highestPrice}` : "NONE"}`,
    `Nav items: ${signals.navItems.slice(0, 15).join(", ") || "None"}`,
    `Trust keywords: ${signals.trustKeywords.join(", ") || "None"}`,
    `Niche hints: ${signals.nicheHints.join(", ") || "None"}`,
    `E-commerce signals: ${(signals.prices.length > 0 || signals.platform) ? "YES" : "NO"}`,
  ].join("\n");
}

// ── PHASE 0: Master Strategic Scrutiny ──────────────────────────────────────────
function buildMasterScrutinyPrompt(signals: StoreSignals): string {
  return `You are Zeno, an elite-level investor and master strategic consultant.
You are analyzing raw scraped data from a website to form a deep, uncompromising "Master Scrutiny" of this business before breaking it down into smaller parts.

${buildSignalBlock(signals)}

INSTRUCTIONS:
Do NOT output JSON. Write a cohesive, analytical text report (markdown) that connects all the dots.
Analyze:
1. What does this site REALLY do? If it isn't an e-commerce store, what is its exact value proposition?
2. Who is the exact audience and what is their psychology?
3. How does the brand, pricing (if any), and trust indicators align with the audience?
4. What is the market potential, competition, and saturation?
5. What are the brutal, uncompromising weaknesses or risks?
6. What is the final, overarching investor verdict based on all signals combined?

Think deeply, logically, and stringently. Leave no stone unturned. Be brutal and realistic. Determine exactly how all these pieces fit together.`;
}

// ── PHASE 1: Foundation Prompt ─────────────────────────────────────────────────
function buildFoundationPrompt(signals: StoreSignals, masterScrutiny: string): string {
  return `You are Zeno — a senior investor and e-commerce analyst. You think like someone risking real money.

=== MASTER INTELLIGENCE CONTEXT ===
The following is your own deep strategic scrutiny of the business. Use this exact context to align all your JSON output perfectly. Do NOT contradict the Master Context.
${masterScrutiny}

=== RAW SIGNALS ===
${buildSignalBlock(signals)}

=== PHASE 1: FOUNDATION ANALYSIS ===

MANDATORY RULES (NON-NEGOTIABLE):
1. DEEP SEARCH RULE: Analyze the entire site fully. Even if it is not a traditional e-commerce store, extract value, audience, and market potential. Do NOT stop.
2. EVIDENCE RULE: Every claim needs "Based on: [detected signal]". No invention of details.
3. DEPTH RULE: Do NOT stop at first signal. Cross-check ALL signals before concluding.
4. HONESTY RULE: Do not flatter the store. Give brutal investor-grade truth.
5. If a field truly cannot be determined → use "INSUFFICIENT_DATA" for strings, null for numbers.

ANALYZE (deep, not surface-level):

A) STORE NAME:
   - Memorability (1-10 with reasoning)
   - Does it reflect the product/niche?
   - Market fit (right name for right audience?)
   - Competitive positioning of the name

B) BUSINESS TYPE (justify with detected signals):
   - Dropshipping / Brand / Reseller / Manufacturer
   - Evidence of inventory ownership vs third-party

C) PRODUCT ANALYSIS (dig deep):
   - What exact problem does it solve?
   - Is this a NEED (functional, essential) or WANT (emotional, luxury)?
   - Is it consumable (repeat purchases) or one-time?
   - Price-to-value perception from visible pricing

D) AUDIENCE ANALYSIS (infer from all signals):
   - Age range (with reasoning)
   - Income level (Low/Mid/High/Mid-High with evidence)
   - Geography/Market (domestic/international signals)
   - Buying behavior: Impulsive / Logical / Price-sensitive
   - How quickly would they decide to buy?

E) HOMEPAGE EVALUATION:
   - Clarity of main offer (1-10)
   - Trust elements present (list what you see vs what's missing)
   - CTA strength (compelling or weak?)
   - Overall homepage score (1-10 with detailed reasoning)

Reply ONLY with valid JSON:
{
  "is_ecommerce": <boolean>,
  "ecommerce_confidence": <"confident"|"likely"|"unclear"|"not_ecommerce">,
  "foundation_score": <1-10, 0 if not ecommerce>,
  "judgment": <"Strong foundation"|"Average"|"Weak">,
  "store_name_verdict": <"[verdict]. Based on: [signal]">,
  "business_type": <"Dropshipping"|"Brand"|"Reseller"|"Manufacturer"|"Unknown">,
  "business_type_reasoning": <"[reason]. Based on: [signal]">,
  "product_problem": <"[problem]. Based on: [signal]" or "INSUFFICIENT_DATA">,
  "product_classification": <"NEED"|"WANT"|"INSUFFICIENT_DATA">,
  "is_consumable": <true|false|null>,
  "audience_age": <"18-35" or "INSUFFICIENT_DATA">,
  "audience_income": <"Low"|"Mid"|"High"|"Mid-High"|"INSUFFICIENT_DATA">,
  "audience_geography": <string or "INSUFFICIENT_DATA">,
  "audience_behavior": <"Impulsive"|"Logical"|"Price-sensitive"|"INSUFFICIENT_DATA">,
  "homepage_score": <1-10>,
  "homepage_clarity": <string — specific analysis of the main offer clarity>,
  "homepage_trust_elements": [<detected trust signals>],
  "homepage_cta_strength": <"Strong"|"Medium"|"Weak">,
  "strengths": ["[strength]. Based on: [signal]", "[strength]. Based on: [signal]"],
  "weaknesses": ["[weakness]. Based on: [signal]", "[weakness]. Based on: [signal]"]
}`;
}

// ── PHASE 2: Market & Numbers Prompt ──────────────────────────────────────────
function buildMarketPrompt(signals: StoreSignals, masterScrutiny: string): string {
  const hasPricing = signals.lowestPrice !== null;
  const hasContent = signals.wordCount > 100;

  return `You are Zeno — a data-driven e-commerce market analyst. Think like an investor calculating real ROI.

=== MASTER INTELLIGENCE CONTEXT ===
The following is your own deep strategic scrutiny of the business. Use this exact context to align all your JSON output perfectly. Do NOT contradict the Master Context.
${masterScrutiny}

=== RAW SIGNALS ===
${buildSignalBlock(signals)}

=== PHASE 2: MARKET & NUMBERS ANALYSIS ===

DATA AVAILABILITY:
- Pricing signals: ${hasPricing ? `✅ DETECTED (${signals.lowestPrice}–${signals.highestPrice}) — revenue estimates ALLOWED` : "❌ NONE — set all revenue/AOV/profit/valuation fields to null"}
- Content depth: ${hasContent ? `✅ ${signals.wordCount} words — traffic estimation POSSIBLE` : "⚠️ LIMITED — use very wide ranges"}
- Platform: ${signals.platform ?? "Unknown — factor this into estimates"}

MANDATORY RULES:
1. DEPTH: Analyze market size, saturation, AND competition separately — do not merge them.
2. EVIDENCE: All estimates must cite what signals informed them.
3. REALISM: Use realistic numbers. A small niche store ≠ millions/month. Be honest.
4. NO MIXING: If pricing not detected → revenue/AOV fields MUST be null. Do not estimate them.
5. SCENARIOS: Provide low (1%), mid (2.5%), and high (5%) CVR estimates separately.

ANALYZE (deep, thorough):

A) MARKET SIZE & DEMAND:
   - Is this a niche or mass market?
   - Growth trend (growing/stable/declining)
   - Seasonal patterns if applicable

B) COMPETITION:
   - How many similar stores exist?
   - Barrier to entry in this niche
   - What would differentiate a new entrant?

C) TRAFFIC ESTIMATION (wide honest ranges):
   - Daily visitors (low/high)
   - Monthly visitors (low/high)
   - What signals informed this? (platform, content depth, niche signals)

D) CONVERSION ANALYSIS — 3 SCENARIOS:
   - 1% CVR (pessimistic): customers per month
   - 2.5% CVR (realistic): customers per month  
   - 5% CVR (optimistic): customers per month

E) REVENUE (only if pricing detected):
   - AOV based on visible prices
   - Monthly revenue range
   - Profit margin estimate (if product type known)
   - Monthly profit range

F) REPEAT PURCHASE ANALYSIS:
   - If consumable: How often would a customer reorder?
   - If one-time: What upsell/cross-sell opportunities exist?
   - LTV implications

G) VALUATION:
   - Formula: monthly profit × 12-36 multiplier
   - Give low (×12) and high (×36) range

Reply ONLY with valid JSON:
{
  "market_strength": <"Strong"|"Moderate"|"Weak">,
  "market_size_analysis": <string — niche vs mass, size estimate, growth trend>,
  "demand_level": <"High"|"Medium"|"Low">,
  "is_saturated": <boolean>,
  "saturation_analysis": <string — how crowded is this space, barriers to entry>,
  "competitor_strength": <"Dominant"|"Strong"|"Moderate"|"Fragmented">,
  "competitor_analysis": <string — who are the competitors and how strong>,
  "daily_visitors_low": <integer>,
  "daily_visitors_high": <integer>,
  "monthly_visitors_low": <integer>,
  "monthly_visitors_high": <integer>,
  "cvr_low": <1.0>,
  "cvr_mid": <2.5>,
  "cvr_high": <5.0>,
  "cvr_reasoning": <string — MUST cite which signals informed these estimates>,
  "monthly_customers_low": <integer>,
  "monthly_customers_high": <integer>,
  "aov_est": <integer or null>,
  "monthly_revenue_low": <integer or null>,
  "monthly_revenue_high": <integer or null>,
  "profit_margin_pct": <integer or null>,
  "monthly_profit_low": <integer or null>,
  "monthly_profit_high": <integer or null>,
  "valuation_low": <integer or null>,
  "valuation_high": <integer or null>,
  "repeat_purchase": <boolean>,
  "repeat_cycle_days": <integer or null>,
  "repeat_purchase_analysis": <string — LTV impact if consumable, upsell path if not>,
  "upsell_potential": <string or null>,
  "market_verdict": <string — 2-3 sentences: is this market worth entering NOW?>
}`;
}

// ── PHASE 3: Strategic Audit Prompt ───────────────────────────────────────────
function buildStrategicPrompt(signals: StoreSignals, masterScrutiny: string): string {
  return `You are Zeno — a strategic investment advisor for e-commerce. You do NOT give generic advice. You give decisive verdicts backed by data.

=== MASTER INTELLIGENCE CONTEXT ===
The following is your own deep strategic scrutiny of the business. Use this exact context to align all your JSON output perfectly. Do NOT contradict the Master Context.
${masterScrutiny}

=== RAW SIGNALS ===
${buildSignalBlock(signals)}

=== PHASE 3: DEEP STRATEGIC ANALYSIS ===

MANDATORY RULES:
1. EVIDENCE: Every strength and weakness MUST end with "Based on: [specific detected signal]"
2. DEPTH: Analyze marketing, UX, trust, AND growth separately — do not merge.
3. BRUTAL HONESTY: Do NOT compliment a store unless signals justify it. Investors lose money from over-optimism.
4. SCENARIOS: Base them ONLY on actual signals. No fictional optimism.
5. HEALTH SCORE: Each sub-score must reflect real findings.

ANALYZE (investor consulting level):

A) MARKETING ANALYSIS:
   - Is the store 100% ad-dependent (no organic presence)?
   - Evidence of brand building (memorable, consistent)
   - Content channels detected (social, SEO, TikTok)
   - Risk level: if ads stop, does the store die?

B) UX ANALYSIS:
   - Speed perception from page structure signals
   - Navigation: easy to find products / confusing?
   - Checkout path: estimated steps
   - Mobile UX signals (if detectable)
   - Friction points that would kill conversions

C) TRUST ANALYSIS:
   - Legitimacy: does this look like a real business?
   - Reviews: present/strong/fake/none?
   - Brand consistency: logos, colors, voice
   - Return policy, guarantees, SSL signals

D) STRENGTHS (exactly 3):
   Each must be SPECIFIC and evidence-backed.
   Format: "[Specific strength]. Based on: [detected signal]"

E) WEAKNESSES (exactly 3 — brutal):
   Reasons a real buyer would NOT complete purchase.
   Format: "[Specific blocker]. Based on: [detected signal]"

F) SCENARIOS:
   - Best case: Everything goes right. What happens?
   - Worst case: Current problems persist. What happens?
   - Realistic: Most likely outcome in 6 months. Be honest.

G) GROWTH ROADMAP:
   - Fix first: ONE single highest-leverage action (with reasoning)
   - 2x performance: Specific tactical steps to double revenue
   - 10x performance: Strategic transformation required

H) ZENO HEALTH SCORE (1-100):
   - Foundation (1-100)
   - Market (1-100)
   - UX (1-100)
   - Trust (1-100)
   - Revenue Potential (1-100)
   - Overall score = weighted average
   - Why not 100: List top 2 reasons
   - Top priority: Single most impactful fix

I) FINAL VERDICT:
   Answer: "Is this business worth real money right now?"
   One of: 🔥 High potential / ⚠️ Medium risk / ❌ Not recommended
   5-step action plan (ordered by impact)

Reply ONLY with valid JSON:
{
  "is_ad_dependent": <boolean>,
  "has_brand_identity": <boolean>,
  "content_presence": <"Strong"|"Moderate"|"Minimal"|"None">,
  "content_channels": [<detected channels>],
  "marketing_analysis": <string — ad dependency risk, brand signals, content assessment>,
  "ux_speed_score": <1-10>,
  "ux_navigation_score": <1-10>,
  "ux_analysis": <string — specific friction points and UX findings>,
  "checkout_friction": <"High"|"Medium"|"Low">,
  "checkout_steps_est": <2-7>,
  "trust_score": <1-10>,
  "trust_legitimacy": <"High"|"Medium"|"Low">,
  "review_strength": <"Strong"|"Moderate"|"Weak"|"None">,
  "branding_consistency": <"High"|"Medium"|"Low">,
  "trust_analysis": <string — legitimacy, reviews, brand consistency details>,
  "strengths": ["[strength]. Based on: [signal]", "[strength]. Based on: [signal]", "[strength]. Based on: [signal]"],
  "weaknesses": ["[weakness blocker]. Based on: [signal]", "[weakness blocker]. Based on: [signal]", "[weakness blocker]. Based on: [signal]"],
  "scenario_best": <string — specific, evidence-based best case>,
  "scenario_worst": <string — specific, evidence-based worst case>,
  "scenario_realistic": <string — honest realistic 6-month outlook>,
  "fix_first": <string — single highest-leverage action WITH reason why>,
  "growth_2x": <string — 3-4 specific tactical steps to double revenue>,
  "growth_10x": <string — strategic transformation: what must fundamentally change>,
  "health_score": <1-100>,
  "health_breakdown_foundation": <1-100>,
  "health_breakdown_market": <1-100>,
  "health_breakdown_ux": <1-100>,
  "health_breakdown_trust": <1-100>,
  "health_breakdown_revenue_potential": <1-100>,
  "health_why_not_100": ["<specific reason 1>", "<specific reason 2>"],
  "health_top_priority": <string — ONE actionable sentence>,
  "final_verdict": <"🔥 High potential"|"⚠️ Medium risk"|"❌ Not recommended">,
  "action_plan": ["<step 1>", "<step 2>", "<step 3>", "<step 4>", "<step 5>"],
  "overall_recommendation": <string — 3 sentences max, decisive investor-grade judgment>
}`;
}

// ── Main POST Handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { url } = parsed.data;
    const env = getEnv();


    // ── Step 1: Scrape ────────────────────────────────────────────────────────
    const signals = await scrapeStore(url);
    const dataSource: "live" | "benchmark" = signals.wordCount > 0 ? "live" : "benchmark";

    // ── Step 2: Build AI client — Key 2 (Analysis) + 70B model ─────────────────
    const apiKey = env.GROQ_ANALYZE_KEY ?? env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Zeno is not configured. Add GROQ_ANALYZE_KEY in your Vercel Project Settings -> Environment Variables, then Redeploy." },
        { status: 500 }
      );
    }
    const baseURL = env.AI_BASE_URL ?? "https://api.groq.com/openai/v1";
    const client = new OpenAI({ apiKey, baseURL });
    const model = env.GROQ_ANALYZE_MODEL ?? env.OPENAI_MODEL ?? "llama-3.3-70b-versatile";

    // ── Step 3: Master Scrutiny (Sequential) ──────────────────────────────────
    console.log("[analyze] Running Step 0: Master Scrutiny...");
    const masterResponse = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: buildMasterScrutinyPrompt(signals) }],
      temperature: 0.2,
      max_tokens: 1500,
    }, { timeout: 35000 }).catch(e => {
       console.error("[analyze] Master Scrutiny failed:", e);
       return null;
    });

    const masterScrutiny = masterResponse?.choices[0]?.message?.content || "Proceeding with direct signal analysis.";
    console.log("[analyze] Master Scrutiny complete.");

    // ── Step 4: Run all 3 phases in parallel ──────────────────────────────────
    const [foundationResult, marketResult, strategicResult] = await Promise.allSettled([
      client.chat.completions.create({
        model,
        messages: [{ role: "user", content: buildFoundationPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }, { timeout: 25000 }),
      client.chat.completions.create({
        model,
        messages: [{ role: "user", content: buildMarketPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }, { timeout: 25000 }),
      client.chat.completions.create({
        model,
        messages: [{ role: "user", content: buildStrategicPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }, { timeout: 25000 }),
    ]);

    // ── Step 4: Handle failures ───────────────────────────────────────────────
    function parseAI<T>(result: PromiseSettledResult<OpenAI.Chat.ChatCompletion>): T | null {
      if (result.status === "rejected") {
        console.error("[analyze] AI phase failed:", result.reason?.message ?? result.reason);
        return null;
      }
      try {
        return JSON.parse(result.value.choices[0]?.message?.content ?? "{}") as T;
      } catch {
        return null;
      }
    }

    const foundation = parseAI<FoundationAnalysis>(foundationResult);
    const market = parseAI<MarketIntelligence>(marketResult);
    const strategic = parseAI<StrategicAudit>(strategicResult);

    if (!foundation || !market || !strategic) {
      const reason = [
        !foundation ? "Phase 1 (Foundation)" : "",
        !market ? "Phase 2 (Market)" : "",
        !strategic ? "Phase 3 (Strategic)" : "",
      ].filter(Boolean).join(", ");
      return NextResponse.json(
        { error: `Zeno could not complete analysis. AI service error in: ${reason}. Check your API key.` },
        { status: 502 }
      );
    }

    // ── Step 5: (E-commerce gate removed per user request) ────────────────────
    
    // ── Step 6: Build summary ─────────────────────────────────────────────────
    const zenoSummary = buildZenoSummary(url, foundation, market, strategic, dataSource);

    const result: StoreAnalysisResult = {
      url: signals.url,
      data_source: dataSource,
      is_ecommerce: true,
      signals: {
        title: signals.title,
        platform: signals.platform,
        prices: signals.prices,
        lowestPrice: signals.lowestPrice,
        highestPrice: signals.highestPrice,
        trustKeywords: signals.trustKeywords,
        nicheHints: signals.nicheHints,
        wordCount: signals.wordCount,
      },
      foundation,
      market,
      strategic,
      zeno_summary: zenoSummary,
    };

    return NextResponse.json(result);

  } catch (err) {
    console.error("[store/analyze] unexpected error:", err);
    return NextResponse.json({ error: "Analysis failed unexpectedly. Please retry." }, { status: 500 });
  }
}

// ── Zeno briefing summary ──────────────────────────────────────────────────────
function buildZenoSummary(
  url: string,
  f: FoundationAnalysis,
  m: MarketIntelligence,
  s: StrategicAudit,
  source: "live" | "benchmark"
): string {
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const dataNote = source === "benchmark" ? " Note: site blocked scraping — analysis based on URL signals only." : "";
  const rev = m.monthly_revenue_low != null && m.monthly_revenue_high != null
    ? `Revenue est: $${m.monthly_revenue_low.toLocaleString()}–$${m.monthly_revenue_high.toLocaleString()}/month.`
    : "Revenue estimates unavailable — no pricing detected.";
  return `${domain} | Foundation ${f.foundation_score}/10 (${f.judgment}) | ${f.business_type} | Market: ${m.demand_level}, ${m.market_strength} | ${rev} | Health: ${s.health_score}/100 | Verdict: ${s.final_verdict}${dataNote}`;
}
