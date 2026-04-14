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
import { query, ensureNolixSchema } from "@/lib/schema";

export const maxDuration = 60; // Allow Vercel to run up to 60s for the analysis pipeline

// ── Input ──────────────────────────────────────────────────────────────────────
const inputSchema = z.object({ url: z.string().min(3).max(500), userAnswers: z.any().optional() });

// ── Types ──────────────────────────────────────────────────────────────────────
export interface FoundationAnalysis {
  business_model: "E-Commerce" | "Content/Media" | "SaaS/Tool" | "LeadGen" | "Unknown";
  model_confidence: "confident" | "likely" | "unclear" | "not_detected";
  foundation_score: number;
  judgment: string;
  store_name_verdict: string;
  business_type: "Dropshipping" | "Brand" | "Reseller" | "Manufacturer" | "News/Blog" | "Service" | "Unknown";
  business_type_reasoning: string;
  product_problem: string;
  product_classification: "NEED" | "WANT" | "INSUFFICIENT_DATA" | "NOT_APPLICABLE";
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
  scenario_worst: string;
  scenario_realistic: string;
  fix_first: string;
  growth_2x: string;
  growth_10x: string;
  revenue_brain_score: number;
  health_breakdown_foundation: number;
  health_breakdown_market: number;
  health_breakdown_ux: number;
  health_breakdown_trust: number;
  health_breakdown_revenue_potential: number;
  health_why_not_100: string[];
  health_top_priority: string;
  missed_revenue_est: number | null;
  missed_revenue_analysis: string;
  final_verdict: "🔥 High potential" | "⚠️ Medium risk" | "❌ Not recommended";
  action_plan: string[];
  overall_recommendation: string;
}

export interface ZenoSelfAuditEntry {
  error_type: string;
  error_description: string;
  correction_rule: string;
  confidence_before: number;
  confidence_after: number;
  phase: string;
}

export interface ZenoSelfAudit {
  overall_confidence: number;
  foundation_confidence: number;
  market_confidence: number;
  strategic_confidence: number;
  data_quality: "live" | "limited" | "insufficient";
  missing_data: string[];
  estimated_fields: string[];
  potential_errors: string[];
  errors_detected: ZenoSelfAuditEntry[];
  improvement_summary: string;
}

export interface StoreAnalysisResult {
  url: string;
  data_source: "live" | "benchmark" | "offline";
  business_model: "E-Commerce" | "Content/Media" | "SaaS/Tool" | "LeadGen" | "Unknown";
  signals: Pick<StoreSignals, "title" | "platform" | "prices" | "lowestPrice" | "highestPrice" | "trustKeywords" | "nicheHints" | "wordCount">;
  foundation: FoundationAnalysis;
  market: MarketIntelligence;
  strategic: StrategicAudit;
  zeno_summary: string;
  zeno_self_audit?: ZenoSelfAudit;
}

// ── Signal Block ───────────────────────────────────────────────────────────────
function buildSignalBlock(signals: any): string {
  return [
    "=== ZENO RAW SIGNAL REPORT (WITH CONFIDENCE SCORES) ===",
    `URL: ${signals.url}`,
    `HTML extracted: ${signals.wordCount > 0 ? `YES — ${signals.wordCount} words` : "NO — site blocked or JS-rendered"}`,
    `Business Model: ${signals.businessModel.value} (Confidence: ${signals.businessModel.confidence}%, Source: ${signals.businessModel.source})`,
    `Title: ${signals.title.value ?? "Not detected"}`,
    `Meta: ${signals.metaDescription.value ?? "Not detected"} (Confidence: ${signals.metaDescription.confidence}%)`,
    `H1: ${signals.h1.value ?? "Not detected"} (Confidence: ${signals.h1.confidence}%)`,
    `Platform: ${signals.platform.value ?? "None"} (Confidence: ${signals.platform.confidence}%, Source: ${signals.platform.source})`,
    `Currency: ${signals.currency.value ?? "Not detected"} (Confidence: ${signals.currency.confidence}%)`,
    `Prices detected: ${signals.prices.value.length > 0 ? signals.prices.value.slice(0, 10).join(", ") : "NONE"} (Confidence: ${signals.prices.confidence}%, Source: ${signals.prices.source})`,
    `Price range: ${signals.lowestPrice.value != null ? `${signals.lowestPrice.value}–${signals.highestPrice.value}` : "NONE"}`,
    `Nav items: ${signals.navItems.value.slice(0, 15).join(", ") || "None"}`,
    `Trust keywords: ${signals.trustKeywords.value.join(", ") || "None"}`,
    `Niche hints: ${signals.nicheHints.value.join(", ") || "None"}`,
    `E-commerce signals: ${(signals.prices.value.length > 0 || signals.platform.value) ? "YES" : "NO"}`,
  ].join("\n");
}

// ── PHASE 0: Master Strategic Scrutiny (THE BRAIN) ──────────────────────────────────
function buildMasterScrutinyPrompt(signals: StoreSignals, userAnswers?: any): string {
  const answersSection = userAnswers 
    ? `\n=== CRITICAL: OWNER PROVIDED BUSINESS CONTEXT (FACTS) ===\n${JSON.stringify(userAnswers, null, 2)}\n`
    : "";

  return `You are Zeno — a senior revenue operator and strategic analyst.
Your job is NOT to generate answers.
Your job is to THINK, VALIDATE, and SELF-CORRECT before producing output.

You MUST follow this execution framework strictly:

--------------------------------------------------
PHASE 0 — TRUTH MODE (CRITICAL RULES)
--------------------------------------------------
- Never guess blindly.
- Never invent numbers.
- Never fill missing data with assumptions.
- If data is missing → explicitly say: "INSUFFICIENT_DATA"
- If estimation is required:
  → Use LOGICAL RANGES
  → Attach CONFIDENCE LEVEL: (High / Medium / Low)
- If the website is unclear:
  → Analyze multiple possibilities before deciding.
- If unsure:
  → Say uncertainty clearly.

--------------------------------------------------
PHASE 1 — DATA COLLECTION & SIGNAL DETECTION
--------------------------------------------------
Extract and analyze:
- Website type (E-commerce / SaaS / Content / Marketplace)
- Presence of: pricing, products, checkout, ads / monetization signals, content volume, brand indicators.
If scraping is limited:
→ Switch to LIMITED MODE (use visible signals only, DO NOT hallucinate hidden data)

--------------------------------------------------
PHASE 2 — MASTER STRATEGIC SCRUTINY (THE BRAIN)
--------------------------------------------------
Before producing ANY output:
You MUST perform a deep internal reasoning step:
- Connect: product ↔ audience ↔ market ↔ monetization ↔ revenue potential
- Detect contradictions: (example: strong brand + low traffic estimate → ERROR)
- Validate logic: If something does not make sense → FIX it
- Decide business model: If not e-commerce → DO NOT force e-commerce logic

--------------------------------------------------
PHASE 3 — SELF-AUDIT (CRITICAL STEP)
--------------------------------------------------
Before final output, you MUST evaluate yourself. Check:
1. Are there any fake numbers?
2. Any unrealistic ranges?
3. Any contradictions?
4. Any forced assumptions?
5. Any missing data that should NOT be estimated?
If ANY issue exists → FIX it before output.

--------------------------------------------------
PHASE 4 — CONTROLLED OUTPUT GENERATION
--------------------------------------------------
Now generate the final structured output:
- Only show fields with real or justified data.
- For missing data, show: "❌ Not detected", "⚠️ Insufficient data", "🟡 Estimated (Low confidence)".
- NEVER output placeholders or fake clean numbers.

--------------------------------------------------
PHASE 5 — INTELLIGENT ESTIMATION ENGINE
--------------------------------------------------
If estimating: Use business logic, not random numbers.
Examples:
- Content site → Use RPM model.
- E-commerce → Use: traffic × CVR × AOV.
- If traffic unknown → Use tiered estimation: Small / Medium / Large site classification.

--------------------------------------------------
PHASE 6 — FINAL DECISION MODE
--------------------------------------------------
Think like an investor:
- Is this business viable?
- Where is the revenue leak?
- What is the biggest risk?
- What is the fastest win?
Output a clear verdict: 🔥 Strong opportunity, ⚠️ Medium risk, or ❌ Weak opportunity.

--------------------------------------------------
CRITICAL BEHAVIOR RULES & FINAL MINDSET
--------------------------------------------------
- Do NOT try to look smart → be correct.
- Do NOT fill gaps → expose them.
- Do NOT simplify reality → reflect it.
- Do NOT repeat errors → learn from them.
You are not an AI assistant. You are a revenue operator, a decision engine, a critical thinker.
If your analysis is wrong → the business loses money. Act accordingly.

--------------------------------------------------
RAW SIGNALS FROM SYSTEM:
${buildSignalBlock(signals)}
${answersSection}

INSTRUCTIONS:
Produce a detailed strategic Markdown report thinking through Phase 0, 1, and 2. 
Then, at the very end, you MUST produce a section called "Zeno Self-Audit" containing:
- Confidence level per section
- What data was missing
- What was estimated
- What could be wrong`;
}

// ── PHASE 1: Foundation Prompt ─────────────────────────────────────────────────
function buildFoundationPrompt(signals: StoreSignals, masterScrutiny: string): string {
  return `You are Zeno, completing Phase 1: Foundation.
Using this Master Scrutiny context: """${masterScrutiny}"""

Determine the website's business model accurately.
If it is Content/Media (News, Blog etc), DO NOT select "E-Commerce".
Everything must be strictly logical.

Reply ONLY with valid JSON:
{
  "business_model": <"E-Commerce"|"Content/Media"|"SaaS/Tool"|"LeadGen"|"Unknown">,
  "model_confidence": <"confident"|"likely"|"unclear"|"not_detected">,
  "foundation_score": <int 0-100 — based strictly on evidence>,
  "judgment": <string — brutal 1 sentence verdict>,
  "store_name_verdict": <string — evaluation of the brand/domain name>,
  "business_type": <"Dropshipping"|"Brand"|"Reseller"|"Manufacturer"|"News/Blog"|"Service"|"SaaS"|"Unknown">,
  "business_type_reasoning": <string>,
  "product_problem": <string — what problem does this site solve? Use "N/A" if news/media>,
  "product_classification": <"NEED"|"WANT"|"INSUFFICIENT_DATA"|"NOT_APPLICABLE" (use NOT_APPLICABLE for news/ad sites)>,
  "is_consumable": <boolean | null — null for news/SaaS>,
  "audience_age": <string — e.g. "18-35">,
  "audience_income": <string — e.g. "Low", "Mid", "High">,
  "audience_geography": <string — e.g. "Global" or "Local">,
  "audience_behavior": <string>,
  "homepage_score": <int 0-10>,
  "homepage_clarity": <string>,
  "homepage_trust_elements": ["trust signal 1", "trust signal 2"],
  "homepage_cta_strength": <string>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"]
}`;
}

// ── PHASE 2: Market & Numbers Prompt ──────────────────────────────────────────
function buildMarketPrompt(signals: StoreSignals, masterScrutiny: string): string {
  return `You are Zeno, completing Phase 2: Market Intelligence.
Using this Master Scrutiny context: """${masterScrutiny}"""

RULE: NO NUMBER WITHOUT SOURCE. 
RULE: IF CONTENT/MEDIA: DO NOT mention AOV, Orders, or Inventory. Revenue = Traffic * RPM (value per 1k visits).
RULE: IF E-COMMERCE: Revenue = Traffic * CVR * AOV. 

Reply ONLY with valid JSON:
{
  "market_strength": <"Strong"|"Moderate"|"Weak">,
  "market_size_analysis": <string>,
  "demand_level": <"High"|"Medium"|"Low">,
  "is_saturated": <boolean>,
  "saturation_analysis": <string>,
  "competitor_strength": <"Dominant"|"Strong"|"Moderate"|"Fragmented">,
  "competitor_analysis": <string>,
  "daily_visitors_low": <int>,
  "daily_visitors_high": <int>,
  "monthly_visitors_low": <int>,
  "monthly_visitors_high": <int>,
  "cvr_low": <float>,
  "cvr_mid": <float>,
  "cvr_high": <float>,
  "cvr_reasoning": <string — clear formula/assumption used for this rate>,
  "monthly_customers_low": <int>,
  "monthly_customers_high": <int>,
  "aov_est": <int | null — AOV for e-commerce, RPM (Revenue per 1k visits) for Content/Media. Null if unknown.>,
  "monthly_revenue_low": <int | null>,
  "monthly_revenue_high": <int | null>,
  "profit_margin_pct": <int | null>,
  "monthly_profit_low": <int | null>,
  "monthly_profit_high": <int | null>,
  "valuation_low": <int | null>,
  "valuation_high": <int | null>,
  "repeat_purchase": <boolean>,
  "repeat_cycle_days": <int | null>,
  "repeat_purchase_analysis": <string>,
  "upsell_potential": <string | null — strictly use "N/A" for news/media>,
  "market_verdict": <string>
}`;
}

// ── PHASE 3: Strategic Audit Prompt ───────────────────────────────────────────
function buildStrategicPrompt(signals: StoreSignals, masterScrutiny: string): string {
  return `You are Zeno, completing Phase 3: Strategic Audit.
Using this Master Scrutiny context: """${masterScrutiny}"""

RULES: 
- NO INVENTION: Do not invent missing products or services.
- If Content/Media: Evaluate Ads, engagement, content, and retention. NO E-COMMERCE CHECKOUT ADVICE.
- If E-Commerce: Evaluate cart friction, upsells, trust.
- missed_revenue_est MUST BE A LOGICAL CALCULATION based on traffic and conversion leaks. If no data, use null.
- All numbers and scores MUST align. Explain WHY a score is not 100.

Reply ONLY with valid JSON:
{
  "is_ad_dependent": <boolean>,
  "has_brand_identity": <boolean>,
  "content_presence": <"Strong"|"Moderate"|"Minimal"|"None">,
  "content_channels": ["channel 1", "channel 2"],
  "marketing_analysis": <string>,
  "ux_speed_score": <int 0-10>,
  "ux_navigation_score": <int 0-10>,
  "ux_analysis": <string>,
  "checkout_friction": <"High"|"Medium"|"Low"|"N/A" (use N/A for content/news)>,
  "checkout_steps_est": <int | null>,
  "trust_score": <int 0-10>,
  "trust_legitimacy": <"High"|"Medium"|"Low">,
  "review_strength": <"Strong"|"Moderate"|"Weak"|"None">,
  "branding_consistency": <"High"|"Medium"|"Low">,
  "trust_analysis": <string>,
  "strengths": ["[strength]. Evidence: [signal]"],
  "weaknesses": ["[weakness]. Evidence: [signal]"],
  "scenario_worst": <string>,
  "scenario_realistic": <string>,
  "fix_first": <string — single highest-leverage action WITH logical reason>,
  "growth_2x": <string>,
  "growth_10x": <string>,
  "revenue_brain_score": <int 1-100 — overall logical score>,
  "health_breakdown_foundation": <int 1-100>,
  "health_breakdown_market": <int 1-100>,
  "health_breakdown_ux": <int 1-100>,
  "health_breakdown_trust": <int 1-100>,
  "health_breakdown_revenue_potential": <int 1-100>,
  "health_why_not_100": ["<specific logical reason 1>"],
  "health_top_priority": <string>,
  "missed_revenue_est": <int | null — logically calculated, null if insufficient data>,
  "missed_revenue_analysis": <string — explain exact calculation or why it's missing>,
  "final_verdict": <"🔥 High potential"|"⚠️ Medium risk"|"❌ Not recommended">,
  "action_plan": ["<step 1>", "<step 2>"],
  "overall_recommendation": <string — decisive investor-grade judgment>
}`;
}

// ── PHASE 4: Self-Audit Prompt ────────────────────────────────────────────────
function buildSelfAuditPrompt(
  signals: StoreSignals,
  foundation: FoundationAnalysis,
  market: MarketIntelligence,
  strategic: StrategicAudit
): string {
  return `You are Zeno — a self-improving revenue intelligence system.
You have just completed a 3-phase analysis. Now you MUST audit your own output.

BUSINESS MODEL DETECTED: ${foundation.business_model}
FOUNDATION SCORE: ${foundation.foundation_score}
MARKET REVENUE EST: $${market.monthly_revenue_low ?? 0}–$${market.monthly_revenue_high ?? 0}
FINAL VERDICT: ${strategic.final_verdict}
DATA QUALITY: ${signals.wordCount > 200 ? "Live HTML available" : "Limited/No HTML — used signal inference"}

=== YOUR PREVIOUS OUTPUT TO AUDIT ===
Foundation: ${JSON.stringify({ business_model: foundation.business_model, foundation_score: foundation.foundation_score, judgment: foundation.judgment, business_type: foundation.business_type, strengths: foundation.strengths, weaknesses: foundation.weaknesses })}
Market: ${JSON.stringify({ market_strength: market.market_strength, monthly_revenue_low: market.monthly_revenue_low, monthly_revenue_high: market.monthly_revenue_high, aov_est: market.aov_est, cvr_reasoning: market.cvr_reasoning, upsell_potential: market.upsell_potential })}
Strategic: ${JSON.stringify({ checkout_friction: strategic.checkout_friction, missed_revenue_est: strategic.missed_revenue_est, missed_revenue_analysis: strategic.missed_revenue_analysis, revenue_brain_score: strategic.revenue_brain_score, action_plan: strategic.action_plan })}

AUDIT INSTRUCTIONS:
1. ERROR DETECTION: Find unrealistic numbers, wrong model logic, missing data, contradictions.
   - Did you use E-commerce metrics (AOV, checkout) for a Content site? ERROR.
   - Did you invent traffic numbers without basis? ERROR.
   - Are scores consistent with the evidence?
2. ROOT CAUSE: For each error, why did it happen?
3. CORRECTION RULES: Create a new rule per error.
4. CONFIDENCE: How confident are you in each section?

Reply ONLY with valid JSON:
{
  "overall_confidence": <int 0-100>,
  "foundation_confidence": <int 0-100>,
  "market_confidence": <int 0-100>,
  "strategic_confidence": <int 0-100>,
  "data_quality": <"live"|"limited"|"insufficient">,
  "missing_data": ["field that was missing"],
  "estimated_fields": ["field that was estimated with reasoning"],
  "potential_errors": ["possible error in output"],
  "errors_detected": [
    {
      "error_type": <string — e.g. "wrong_model_logic"|"unrealistic_number"|"missing_data"|"contradiction">,
      "error_description": <string — what exactly is wrong>,
      "correction_rule": <string — new rule to prevent this in future, start with "Rule:">  ,
      "confidence_before": <int 0-100>,
      "confidence_after": <int 0-100>,
      "phase": <"foundation"|"market"|"strategic">
    }
  ],
  "improvement_summary": <string — 2-3 sentences: what improved, what confidence increased>
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

    const { url, userAnswers } = parsed.data;
    const env = getEnv();

    // Check API Keys
    if (!env.GROQ_ANALYZE_KEY && !env.OPENAI_API_KEY) {
      console.error("[analyze] Zeno is disabled. No API keys found.");
      return NextResponse.json({ error: "Zeno Intelligence is not configured. Missing API keys." }, { status: 500 });
    }


    // ── Step 0: Initialize schema ─────────────────────────────────────────────
    await ensureNolixSchema().catch(() => {}); // Non-blocking

    // ── Step 1: Scrape ────────────────────────────────────────────────────────
    const signals = await scrapeStore(url);
    const dataSource = signals.reachable ? "live" : "offline";

    // ── Step 1b: Fetch Zeno's Learning Memory from DB ─────────────────────────
    let learningMemory = "";
    try {
      const memRows = await query(
        `SELECT error_type, correction_rule FROM zeno_learning_log ORDER BY created_at DESC LIMIT 15`,
        []
      );
      if (memRows.length > 0) {
        learningMemory = `\n\n=== ZENO MEMORY — LEARNED RULES (apply these) ===\n` +
          memRows.map((r: any, i: number) => `${i + 1}. [${r.error_type}] → ${r.correction_rule}`).join("\n") +
          `\n========================`;
        console.log(`[analyze] Injected ${memRows.length} learned rules into analysis.`);
      }
    } catch (e) {
      console.warn("[analyze] Could not fetch learning memory:", e);
    }

    // ── Step 2: Build AI clients (Load Balancing) ──────────────────────────────
    // To avoid Groq's 6000 TPM limit on the free tier, we distribute requests across
    // the user's API keys and use a faster, lighter model for the Scrutiny phase.
    const baseURL = env.AI_BASE_URL ?? "https://api.groq.com/openai/v1";
    
    // Fallbacks if only 1 key is provided
    const keyMaster = env.OPENAI_API_KEY || env.GROQ_ANALYZE_KEY || env.GROQ_CHAT_KEY || env.GROQ_OPS_KEY;
    const keyP1 = env.GROQ_CHAT_KEY || keyMaster;
    const keyP2 = env.GROQ_ANALYZE_KEY || keyMaster;
    const keyP3 = env.GROQ_OPS_KEY || keyMaster;

    if (!keyMaster) {
      return NextResponse.json(
        { error: "Zeno is not configured. Add your API keys in Vercel Project Settings." },
        { status: 500 }
      );
    }

    const clientMaster = new OpenAI({ apiKey: keyMaster, baseURL });
    const clientP1 = new OpenAI({ apiKey: keyP1, baseURL });
    const clientP2 = new OpenAI({ apiKey: keyP2, baseURL });
    const clientP3 = new OpenAI({ apiKey: keyP3, baseURL });

    // Use extreme speed model for Phase 0 to save heavy tokens, and 70b strictly for JSON phases
    const modelDeep = env.GROQ_ANALYZE_MODEL ?? env.OPENAI_MODEL ?? "llama-3.3-70b-versatile";
    const modelFast = "llama-3.1-8b-instant";

    // ── Step 3: Master Scrutiny (Sequential) ──────────────────────────────────
    console.log("[analyze] Running Step 0: Master Scrutiny (using 8b)...");
    const masterResponse = await clientMaster.chat.completions.create({
      model: modelFast,
      messages: [{ role: "user", content: buildMasterScrutinyPrompt(signals, userAnswers) }],
      temperature: 0.2,
      max_tokens: 1500,
    }, { timeout: 35000 }).catch(e => {
       console.error("[analyze] Master Scrutiny failed:", e);
       return null;
    });

    const masterScrutiny = masterResponse?.choices[0]?.message?.content || "Proceeding with direct signal analysis.";
    console.log("[analyze] Master Scrutiny complete.");

    // ── Step 4: Run all 3 phases in parallel ─────────
    console.log("[analyze] Running Phase 1, Phase 2, and Phase 3 in Parallel...");
    
    const [foundationResponse, marketResponse, strategicResponse] = await Promise.all([
      clientP1.chat.completions.create({
        model: modelDeep,
        messages: [{ role: "user", content: buildFoundationPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }, { timeout: 30000 }).catch(e => ({ _error: e.message })),
      
      clientP2.chat.completions.create({
        model: modelDeep,
        messages: [{ role: "user", content: buildMarketPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }, { timeout: 30000 }).catch(e => ({ _error: e.message })),
      
      clientP3.chat.completions.create({
        model: modelDeep,
        messages: [{ role: "user", content: buildStrategicPrompt(signals, masterScrutiny) }],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }, { timeout: 40000 }).catch(e => ({ _error: e.message }))
    ]);

    // ── Step 5: Handle failures & Robust JSON Parse ───────────────────────────
    function parseAI<T>(res: any, phaseName: string): T | { _error: string } {
      if (!res || '_error' in res) {
        return { _error: res?._error || "Timeout or API rejection" };
      }
      
      let content = res.choices?.[0]?.message?.content || "{}";
      
      // Strip markdown code fences if AI injected them
      content = content.trim();
      if (content.startsWith("```json")) content = content.substring(7);
      if (content.startsWith("```")) content = content.substring(3);
      if (content.endsWith("```")) content = content.substring(0, content.length - 3);
      content = content.trim();
      
      try {
        return JSON.parse(content) as T;
      } catch (err) {
        return { _error: "Invalid JSON syntax returned by AI" };
      }
    }

    const foundation = parseAI<FoundationAnalysis>(foundationResponse, "Phase 1");
    const market = parseAI<MarketIntelligence>(marketResponse, "Phase 2");
    const strategic = parseAI<StrategicAudit>(strategicResponse, "Phase 3");

    const errors = [];
    if ('_error' in foundation) errors.push(`Phase 1 (${foundation._error})`);
    if ('_error' in market) errors.push(`Phase 2 (${market._error})`);
    if ('_error' in strategic) errors.push(`Phase 3 (${strategic._error})`);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Zeno could not complete analysis. AI service error: ${errors.join(" | ")}. Please wait 1 minute and try again.` },
        { status: 502 }
      );
    }

    // ── Step 5: Build summary ─────────────────────────────────────────────────
    const zenoSummary = buildZenoSummary(
      url, 
      foundation as FoundationAnalysis, 
      market as MarketIntelligence, 
      strategic as StrategicAudit, 
      dataSource
    );

    const finalFoundation = foundation as FoundationAnalysis;

    // ── Step 6: Phase 4 — Self-Audit (Non-blocking, runs after main result formed) ──
    let zenoSelfAudit: ZenoSelfAudit | undefined;
    try {
      console.log("[analyze] Running Phase 4: Self-Audit...");
      const auditResponse = await clientMaster.chat.completions.create({
        model: modelFast,
        messages: [{ role: "user", content: buildSelfAuditPrompt(
          signals,
          foundation as FoundationAnalysis,
          market as MarketIntelligence,
          strategic as StrategicAudit
        )}],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }, { timeout: 25000 });

      let auditContent = auditResponse.choices[0]?.message?.content || "{}";
      auditContent = auditContent.trim();
      if (auditContent.startsWith("```json")) auditContent = auditContent.substring(7);
      if (auditContent.startsWith("```")) auditContent = auditContent.substring(3);
      if (auditContent.endsWith("```")) auditContent = auditContent.substring(0, auditContent.length - 3);
      
      zenoSelfAudit = JSON.parse(auditContent.trim()) as ZenoSelfAudit;
      console.log(`[analyze] Self-Audit complete. Confidence: ${zenoSelfAudit.overall_confidence}/100`);

      // ── Step 7: Save learning entries to DB ─────────────────────────────────
      if (zenoSelfAudit.errors_detected && zenoSelfAudit.errors_detected.length > 0) {
        fetch(`${req.nextUrl.origin}/api/zeno/learning-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: signals.url,
            business_model: finalFoundation.business_model,
            entries: zenoSelfAudit.errors_detected,
          }),
        }).catch(e => console.warn("[analyze] Failed to save learning log:", e));
      }
    } catch (auditErr) {
      console.warn("[analyze] Self-Audit failed (non-critical):", auditErr);
    }
    
    const result: StoreAnalysisResult = {
      url: signals.url,
      data_source: dataSource,
      business_model: finalFoundation.business_model || "Unknown",
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
      foundation: foundation as FoundationAnalysis,
      market: market as MarketIntelligence,
      strategic: strategic as StrategicAudit,
      zeno_summary: zenoSummary,
      zeno_self_audit: zenoSelfAudit,
    };

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[store/analyze] error:", err);
    return NextResponse.json(
      { error: "Analysis failed due to a server error or timeout. Please wait 1 minute and try again." },
      { status: 500 }
    );
  }
}

// ── Mock Data Generator ────────────────────────────────────────────────────────
function generateMockAnalysis(url: string): StoreAnalysisResult {
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    url,
    data_source: "benchmark",
    business_model: "E-Commerce",
    signals: {
      title: { value: `${domain} - Online Store`, confidence: 100, source: "Mock" },
      platform: { value: "Shopify", confidence: 100, source: "Mock" },
      prices: { value: ["$24.99", "$49.99", "$99.00"], confidence: 100, source: "Mock" },
      lowestPrice: { value: 24.99, confidence: 100, source: "Mock" },
      highestPrice: { value: 99.0, confidence: 100, source: "Mock" },
      trustKeywords: { value: ["secure", "shipping", "guarantee"], confidence: 100, source: "Mock" },
      nicheHints: { value: ["general"], confidence: 100, source: "Mock" },
      wordCount: 450,
    },
    foundation: {
      business_model: "E-Commerce",
      model_confidence: "likely",
      foundation_score: 7.2,
      judgment: "Healthy start with room to scale",
      store_name_verdict: "Brandable and memorable",
      business_type: "Brand",
      business_type_reasoning: "Focus on specific product niche and custom branding.",
      product_problem: "High cart abandonment due to price friction",
      product_classification: "WANT",
      is_consumable: true,
      audience_age: "24-45",
      audience_income: "Mid",
      audience_geography: "United States / Tier 1",
      audience_behavior: "Impulsive",
      homepage_score: 8,
      homepage_clarity: "High",
      homepage_trust_elements: ["SSL", "Reviews", "Payment icons"],
      homepage_cta_strength: "Medium",
      strengths: ["Clean UI", "Clear value prop"],
      weaknesses: ["Mobile spacing", "Social proof placement"],
    },
    market: {
      market_strength: "Strong",
      market_size_analysis: "Growing e-commerce segment with high search volume.",
      demand_level: "High",
      is_saturated: false,
      saturation_analysis: "Moderate competition but high fragmented sub-niches.",
      competitor_strength: "Moderate",
      competitor_analysis: "Fragmented market allows for new brand entry.",
      daily_visitors_low: 150,
      daily_visitors_high: 400,
      monthly_visitors_low: 4500,
      monthly_visitors_high: 12000,
      cvr_low: 1.2,
      cvr_mid: 2.1,
      cvr_high: 3.5,
      cvr_reasoning: "Industry benchmarks for similar niches.",
      monthly_customers_low: 95,
      monthly_customers_high: 250,
      aov_est: 65,
      monthly_revenue_low: 6000,
      monthly_revenue_high: 16000,
      profit_margin_pct: 25,
      monthly_profit_low: 1500,
      monthly_profit_high: 4000,
      valuation_low: 50000,
      valuation_high: 150000,
      repeat_purchase: true,
      repeat_cycle_days: 45,
      repeat_purchase_analysis: "Predictable replenishment cycle observed in niche.",
      upsell_potential: "Strong opportunity for bundles.",
      market_verdict: "High potential for 2x growth in 6 months.",
    },
    strategic: {
      is_ad_dependent: true,
      has_brand_identity: true,
      content_presence: "Moderate",
      content_channels: ["Instagram", "Pinterest"],
      marketing_analysis: "Heavily reliant on social traffic.",
      ux_speed_score: 8.5,
      ux_navigation_score: 7,
      ux_analysis: "Desktop is great, mobile checkout needs focus.",
      checkout_friction: "Medium",
      checkout_steps_est: 3,
      trust_score: 7.5,
      trust_legitimacy: "High",
      review_strength: "Moderate",
      branding_consistency: "High",
      trust_analysis: "Needs more visible social proof on product pages.",
      strengths: ["Visual branding", "Page speed"],
      weaknesses: ["Checkout hesitation", "Offer timing"],
      scenario_worst: "Stagnation at current $6k/mo",
      scenario_realistic: "Growth to $15k/mo within 90 days",
      fix_first: "Add exit-intent revenue recovery (NOLIX)",
      growth_2x: "Implement Zeno AI smart popups",
      growth_10x: "Scale paid acquisition with content engine",
      revenue_brain_score: 78,
      health_breakdown_foundation: 82,
      health_breakdown_market: 75,
      health_breakdown_ux: 85,
      health_breakdown_trust: 70,
      health_breakdown_revenue_potential: 80,
      health_why_not_100: ["Missing user-generated content", "Checkout friction"],
      health_top_priority: "NOLIX Revenue Recovery",
      missed_revenue_est: 1200,
      missed_revenue_analysis: "Losing est. $1200/mo due to 2% drop-off at checkout step 2.",
      final_verdict: "🔥 High potential",
      action_plan: ["Install NOLIX", "Deploy Zeno AI", "A/B test free shipping"],
      overall_recommendation: "Deploy NOLIX immediately to secure your current traffic and boost conversion by 15-20%.",
    },
    zeno_summary: `${domain} | Foundation 7.2/10 | Brain Score 78/100. Verdict: 🔥 High potential. Deploy NOLIX to recover 20% of lost revenue.`,
  };
}

// ── Zeno briefing summary ──────────────────────────────────────────────────────
function buildZenoSummary(
  url: string,
  f: FoundationAnalysis,
  m: MarketIntelligence,
  s: StrategicAudit,
  source: "live" | "benchmark" | "offline"
): string {
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const dataNote = source === "benchmark" ? " Note: site blocked scraping." : "";
  const rev = m.monthly_revenue_low != null && m.monthly_revenue_high != null
    ? `Revenue est: $${m.monthly_revenue_low.toLocaleString()}–$${m.monthly_revenue_high.toLocaleString()}/month.`
    : "Revenue estimates unavailable.";
  return `${domain} | Foundation ${f.foundation_score}/10 | Brain Score: ${s.revenue_brain_score}/100 | Verdict: ${s.final_verdict}${dataNote}`;
}

