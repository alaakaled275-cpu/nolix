/**
 * app/api/zeno/self-improve/route.ts
 * 
 * Zeno 6-Phase Self-Improvement Loop
 * Runs after every analysis to detect errors, create correction rules,
 * store them in DB, and return an improvement summary.
 * 
 * Phase 1 — Error Detection
 * Phase 2 — Root Cause Analysis
 * Phase 3 — Correction Rules
 * Phase 4 — Memory Storage (DB)
 * Phase 5 — Re-Run Thinking
 * Phase 6 — Output Improvement Summary
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { query, ensureNolixSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SelfImprovementEntry {
  phase: "foundation" | "market" | "strategic" | "general";
  error_type:
    | "wrong_model_logic"
    | "unrealistic_number"
    | "missing_data"
    | "contradiction"
    | "weak_assumption"
    | "incorrect_classification"
    | "logical_error";
  error_description: string;
  root_cause: string;
  correction_rule: string;
  confidence_before: number;
  confidence_after: number;
}

export interface SelfImprovementResult {
  url: string;
  business_model: string;
  overall_confidence_before: number;
  overall_confidence_after: number;
  confidence_gain: number;
  errors_found: number;
  errors_fixed: number;
  entries: SelfImprovementEntry[];
  improvement_summary: string;
  re_analysis_notes: string;
  zeno_verdict_before: string;
  zeno_verdict_after: string;
  learning_applied: boolean;
  saved_to_memory: boolean;
}

// ── 6-Phase Prompt ─────────────────────────────────────────────────────────────
function buildSelfImprovementPrompt(
  url: string,
  analysisSnapshot: Record<string, unknown>,
  existingRules: string
): string {
  return `You are Zeno — a self-improving revenue intelligence system.
You just completed an analysis. You MUST now run the 6-Phase Self-Improvement Loop.

ANALYZED URL: ${url}
EXISTING LEARNED RULES (apply these first):
${existingRules || "No prior rules stored yet."}

YOUR PREVIOUS ANALYSIS OUTPUT:
${JSON.stringify(analysisSnapshot, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — ERROR DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Review the output and detect:
- Unrealistic numbers (traffic, revenue, CVR) vs. site size and signals
- Weak or unjustified assumptions
- Missing critical data that should have been flagged
- Incorrect business model classification (e.g., Content site classified as E-Commerce)
- Logical contradictions (e.g., "strong brand" but "no trust elements found")
- E-Commerce metrics applied to Content/Media sites (AOV, checkout for news sites is WRONG)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — ROOT CAUSE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each error found, explain:
- WHY did this error happen?
- Was it: missing data? weak reasoning? wrong assumption? wrong model applied?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — CORRECTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each error, create a specific rule. Examples:
- "Rule: If site is Content/Media → never output AOV, checkout_friction, or order metrics."
- "Rule: If no prices detected → classify revenue as null, not estimated $X."
- "Rule: If known large brand/media (bbc.com, cnn.com) → never classify as low traffic."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — MEMORY STORAGE (these will be saved to DB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each correction_rule will be persisted and injected into ALL future analyses.
Make rules precise, general, and actionable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — RE-RUN THINKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Re-evaluate the SAME analysis with corrections applied:
- What would have changed?
- What improved in accuracy?
- What data gaps remain?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 6 — OUTPUT IMPROVEMENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return: what was detected, what was fixed, what improved, confidence delta.

CRITICAL: If no errors were found, still return your confidence assessment.
If Zeno found NO errors → confidence_gain should be 0-5 (no improvement needed).

Reply ONLY with valid JSON:
{
  "overall_confidence_before": <int 0-100>,
  "overall_confidence_after": <int 0-100>,
  "zeno_verdict_before": <string — original verdict in 1 sentence>,
  "zeno_verdict_after": <string — corrected verdict in 1 sentence>,
  "re_analysis_notes": <string — what would change if re-run with corrections>,
  "improvement_summary": <string — 2-3 sentences summary of what improved>,
  "entries": [
    {
      "phase": <"foundation"|"market"|"strategic"|"general">,
      "error_type": <"wrong_model_logic"|"unrealistic_number"|"missing_data"|"contradiction"|"weak_assumption"|"incorrect_classification"|"logical_error">,
      "error_description": <string — exact description of the error>,
      "root_cause": <string — why this error happened>,
      "correction_rule": <string — new rule, start with "Rule:">,
      "confidence_before": <int 0-100>,
      "confidence_after": <int 0-100>
    }
  ]
}`;
}

// ── POST handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema().catch(() => {});

    const body = await req.json();
    const { url, business_model, analysis } = body as {
      url: string;
      business_model: string;
      analysis: Record<string, unknown>;
    };

    if (!url || !analysis) {
      return NextResponse.json({ error: "url and analysis are required" }, { status: 400 });
    }

    const env = getEnv();
    const apiKey = env.GROQ_ANALYZE_KEY || env.OPENAI_API_KEY || env.GROQ_CHAT_KEY || env.GROQ_OPS_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    // ── Fetch existing learned rules from DB ─────────────────────────────────
    let existingRules = "";
    try {
      const rows = await query(
        `SELECT error_type, correction_rule, created_at 
         FROM zeno_learning_log 
         ORDER BY created_at DESC LIMIT 20`,
        []
      );
      if (rows.length > 0) {
        existingRules = rows
          .map((r: any, i: number) => `${i + 1}. [${r.error_type}] → ${r.correction_rule}`)
          .join("\n");
      }
    } catch (e) {
      console.warn("[self-improve] Could not fetch existing rules:", e);
    }

    // ── Run 6-Phase Self-Improvement with AI ─────────────────────────────────
    const baseURL = env.AI_BASE_URL ?? "https://api.groq.com/openai/v1";
    const client = new OpenAI({ apiKey, baseURL });
    const model = env.GROQ_ANALYZE_MODEL ?? env.OPENAI_MODEL ?? "llama-3.3-70b-versatile";

    // Send a compact snapshot of the analysis (not the full 37kb)
    const snapshot = {
      url,
      business_model: analysis.business_model,
      data_source: analysis.data_source,
      signals: analysis.signals,
      foundation: {
        foundation_score: (analysis.foundation as any)?.foundation_score,
        judgment: (analysis.foundation as any)?.judgment,
        business_type: (analysis.foundation as any)?.business_type,
        product_classification: (analysis.foundation as any)?.product_classification,
        weaknesses: (analysis.foundation as any)?.weaknesses,
        strengths: (analysis.foundation as any)?.strengths,
      },
      market: {
        market_strength: (analysis.market as any)?.market_strength,
        monthly_revenue_low: (analysis.market as any)?.monthly_revenue_low,
        monthly_revenue_high: (analysis.market as any)?.monthly_revenue_high,
        aov_est: (analysis.market as any)?.aov_est,
        cvr_reasoning: (analysis.market as any)?.cvr_reasoning,
        upsell_potential: (analysis.market as any)?.upsell_potential,
        daily_visitors_low: (analysis.market as any)?.daily_visitors_low,
        daily_visitors_high: (analysis.market as any)?.daily_visitors_high,
      },
      strategic: {
        revenue_brain_score: (analysis.strategic as any)?.revenue_brain_score,
        checkout_friction: (analysis.strategic as any)?.checkout_friction,
        final_verdict: (analysis.strategic as any)?.final_verdict,
        missed_revenue_est: (analysis.strategic as any)?.missed_revenue_est,
        health_why_not_100: (analysis.strategic as any)?.health_why_not_100,
        action_plan: (analysis.strategic as any)?.action_plan,
      },
    };

    const aiResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: buildSelfImprovementPrompt(url, snapshot, existingRules),
        },
      ],
      temperature: 0.15,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }, { timeout: 45000 });

    let content = aiResponse.choices[0]?.message?.content || "{}";
    content = content.trim();
    if (content.startsWith("```json")) content = content.substring(7);
    if (content.startsWith("```")) content = content.substring(3);
    if (content.endsWith("```")) content = content.slice(0, -3);

    const improvement = JSON.parse(content.trim());
    const entries: SelfImprovementEntry[] = improvement.entries ?? [];

    // ── Phase 4: Save rules to DB ─────────────────────────────────────────────
    let savedCount = 0;
    for (const e of entries) {
      try {
        await query(
          `INSERT INTO zeno_learning_log
             (url, business_model, error_type, error_description, correction_rule, confidence_before, confidence_after, phase)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            url,
            business_model ?? "Unknown",
            e.error_type,
            e.error_description,
            e.correction_rule,
            e.confidence_before ?? 0,
            e.confidence_after ?? 0,
            e.phase ?? "general",
          ]
        );
        savedCount++;
      } catch (dbErr) {
        console.warn("[self-improve] DB insert failed:", dbErr);
      }
    }

    const confidenceBefore = improvement.overall_confidence_before ?? 70;
    const confidenceAfter = improvement.overall_confidence_after ?? 70;

    const result: SelfImprovementResult = {
      url,
      business_model: business_model ?? "Unknown",
      overall_confidence_before: confidenceBefore,
      overall_confidence_after: confidenceAfter,
      confidence_gain: Math.max(0, confidenceAfter - confidenceBefore),
      errors_found: entries.length,
      errors_fixed: entries.filter(e => e.confidence_after > e.confidence_before).length,
      entries,
      improvement_summary: improvement.improvement_summary ?? "Self-audit complete.",
      re_analysis_notes: improvement.re_analysis_notes ?? "",
      zeno_verdict_before: improvement.zeno_verdict_before ?? "",
      zeno_verdict_after: improvement.zeno_verdict_after ?? "",
      learning_applied: existingRules.length > 0,
      saved_to_memory: savedCount > 0,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[zeno/self-improve] error:", err);
    return NextResponse.json(
      { error: "Self-improvement loop failed: " + err.message },
      { status: 500 }
    );
  }
}

// ── GET: History of self-improvement runs ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await ensureNolixSchema().catch(() => {});
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const url = searchParams.get("url");

    const rows = await query(
      `SELECT id, url, business_model, error_type, error_description, correction_rule,
              confidence_before, confidence_after, phase, created_at
       FROM zeno_learning_log
       ${url ? "WHERE url = $2" : ""}
       ORDER BY created_at DESC
       LIMIT $1`,
      url ? [limit, url] : [limit]
    );

    // Aggregate stats
    const entries = rows;
    const totalGain = entries.reduce(
      (sum: number, e: any) => sum + Math.max(0, (e.confidence_after ?? 0) - (e.confidence_before ?? 0)),
      0
    );
    const byPhase = entries.reduce((acc: Record<string, number>, e: any) => {
      acc[e.phase] = (acc[e.phase] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byType = entries.reduce((acc: Record<string, number>, e: any) => {
      acc[e.error_type] = (acc[e.error_type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      entries,
      total: entries.length,
      total_confidence_gain: totalGain,
      by_phase: byPhase,
      by_error_type: byType,
    });
  } catch (err: any) {
    console.error("[zeno/self-improve GET] error:", err);
    return NextResponse.json({ entries: [], total: 0 });
  }
}
