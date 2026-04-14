/**
 * app/api/analyze/initialize/route.ts — v2 REALITY FINGERPRINT
 *
 * NOLIX × ZENO — Domain Reality Extraction Entry Point
 *
 * FLOW:
 *   1. Scrape URL (real HTML — not assumptions)
 *   2. Build RealityFingerprint (probabilistic, multi-signal)
 *   3a. NOT ELIGIBLE → return full fingerprint + block_reason
 *       No analysis. No numbers. No guessing.
 *   3b. ELIGIBLE (ecommerce_probability >= 0.70, confidence >= 70)
 *       → Save fingerprint to DB → proceed to Zeno analysis
 *
 * OUTPUT FORMAT (mandatory fields on every response):
 *   reality_fingerprint: { ... }    ← Always present
 *   eligible: boolean               ← Gateway decision
 *   block_reason: string | null     ← Why blocked (if not eligible)
 *   analysis: object | null         ← Only if eligible
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { scrapeStore } from "@/lib/scraper";
import { buildRealityFingerprint, type RealityFingerprint } from "@/lib/domain-gate";
import { logPrediction } from "@/lib/calibration-engine";
import { query, ensureNolixSchema } from "@/lib/schema";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const session = await getSession();

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const normalizedUrl = url.trim().startsWith("http")
      ? url.trim()
      : `https://${url.trim()}`;

    // ── STEP 1: Reality Extraction (Scrape) ──────────────────────────────────
    let signals;
    try {
      signals = await scrapeStore(normalizedUrl);
    } catch {
      return NextResponse.json({
        eligible:            false,
        block_reason:        "SITE_UNREACHABLE",
        block_explanation:   "Could not reach the site. Ensure it is live and accessible.",
        action_required:     "Ensure the store is publicly accessible and not behind a firewall.",
        reality_fingerprint: null,
        analysis:            null,
      });
    }

    // ── STEP 2: Domain Classification via RealityFingerprint ─────────────────
    const fingerprint: RealityFingerprint = buildRealityFingerprint(signals);

    // ── STEP 2b: Log prediction to calibration system (fire and forget) ───────
    // Every fingerprint is stored. When we later learn the true domain type
    // via /api/analyze/outcome, the calibration engine will match these records.
    logPrediction(fingerprint, normalizedUrl).catch(err =>
      console.warn("[analyze/initialize] prediction log failed (non-blocking):", err)
    );

    // Store fingerprint regardless of eligibility (audit trail + gate memory)
    await query(
      `UPDATE users
       SET domain_gate_result = $1, domain_gate_checked_at = now()
       WHERE id = $2`,
      [JSON.stringify({
        eligible:              fingerprint.eligible_for_analysis,
        stop_reason:           fingerprint.block_reason,
        domain_type:           fingerprint.classification,
        ecommerce_probability: fingerprint.ecommerce_probability,
        confidence:            fingerprint.confidence,
        confidence_level:      fingerprint.confidence_level,
        data_quality:          fingerprint.data_quality,
        store_priority:        fingerprint.store_priority,
        url:                   normalizedUrl,
      }), session.id]
    ).catch(() => {});

    // ── STEP 3A: HARD STOP — Not eligible ────────────────────────────────────
    if (!fingerprint.eligible_for_analysis) {
      return NextResponse.json({
        eligible:            false,
        block_reason:        fingerprint.block_reason,
        block_explanation:   fingerprint.block_explanation,
        action_required:     fingerprint.action_required,
        // Full fingerprint always returned (no hiding of evidence)
        reality_fingerprint: {
          ecommerce_probability:   fingerprint.ecommerce_probability,
          content_probability:     fingerprint.content_probability,
          marketplace_probability: fingerprint.marketplace_probability,
          saas_probability:        fingerprint.saas_probability,
          evidence:                fingerprint.evidence,
          confidence:              fingerprint.confidence,
          confidence_level:        fingerprint.confidence_level,
          data_quality:            fingerprint.data_quality,
          classification:          fingerprint.classification,
        },
        analysis: null,
      });
    }

    // ── STEP 3B: ELIGIBLE — Return fingerprint + raw signals for Zeno ────────
    return NextResponse.json({
      eligible:     true,
      block_reason: null,

      reality_fingerprint: {
        ecommerce_probability:   fingerprint.ecommerce_probability,
        content_probability:     fingerprint.content_probability,
        marketplace_probability: fingerprint.marketplace_probability,
        saas_probability:        fingerprint.saas_probability,
        evidence:                fingerprint.evidence,
        confidence:              fingerprint.confidence,
        confidence_level:        fingerprint.confidence_level,
        data_quality:            fingerprint.data_quality,
        classification:          fingerprint.classification,
        store_priority:          fingerprint.store_priority,
        price_reality:           fingerprint.price_reality,
      },

      // Bounded signals — only what was FOUND, nothing invented
      signals: {
        url:              signals.url,
        title:            signals.title.value,
        meta_description: signals.metaDescription.value,
        h1:               signals.h1.value,
        platform:         fingerprint.detected_platform,
        price_range:      fingerprint.price_reality.price_range,
        price_source:     fingerprint.price_reality.price_source,
        currency:         signals.currency.value,
        trust_keywords:   signals.trustKeywords.value,
        word_count:       signals.wordCount,
      },

      // Anti-hallucination mandate: what Zeno IS and IS NOT allowed to estimate
      analysis_permissions: {
        may_estimate_revenue:     fingerprint.data_quality === "VERIFIED",
        may_estimate_traffic:     false,  // Never — no traffic data in scrape
        may_estimate_cvr:         fingerprint.confidence >= 80,
        may_estimate_market_size: false,  // Never without verified external data
        revenue_caveat:           fingerprint.data_quality !== "VERIFIED"
          ? "Revenue estimates must be labeled as INFERRED RANGES, not real figures."
          : null,
      },

      analysis: null, // Full Zeno analysis is a separate call (progressive loading)
    });

  } catch (err) {
    console.error("[analyze/initialize] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
