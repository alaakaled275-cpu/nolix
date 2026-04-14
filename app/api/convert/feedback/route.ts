/**
 * app/api/convert/feedback/route.ts — v3 COMPLETE
 *
 * THE CLOSED LEARNING LOOP WITH HESITATION-ADJUSTED ATTRIBUTION
 *
 * Full chain:
 * Signal → Brain (Zeno) → Decision → Action (NOLIX) → Behavioral Tracking
 * → Outcome + Hesitation → Causal Weight Adjustment → Policy Mutation → Next Decision
 *
 * KEY INSIGHT:
 *   high_hesitation + converted  → causal_weight > 1.0 (action was CRITICAL to sale)
 *   low_hesitation  + converted  → causal_weight < 1.0 (would have bought anyway)
 *   no_conversion   + hesitation → policy recalibrate (action failed despite engagement)
 *
 * This makes the uplift model attribution honest.
 * Without hesitation: "converted" always counts equally.
 * With hesitation:    "converted" is weighted by how much we actually caused it.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, ensureNolixSchema } from "@/lib/schema";
import { updateUpliftModel } from "@/lib/causal-engine";

const feedbackSchema = z.object({
  session_id:         z.string(),
  converted:          z.boolean(),
  order_value:        z.number().optional(),
  time_to_convert_ms: z.number().optional(),
  // Behavioral hesitation signals from popup.js
  hesitation_score:   z.number().min(0).max(100).optional(),
  cta_hover_count:    z.number().min(0).optional(),
  mouse_leave_count:  z.number().min(0).optional(),
  tab_hidden_count:   z.number().min(0).optional(),
  // Direct causal metadata
  cohort_key:         z.string().optional(),
  action_type:        z.string().optional(),
  group_assignment:   z.enum(["treatment", "control"]).optional(),
});

// ── Hesitation-Adjusted Causal Weight ────────────────────────────────────────
// This is the core insight: not all conversions are equal.
//
// If hesitation_score is HIGH and user still converted:
//   → The action overcame real resistance → HIGH causal credit (weight > 1)
//
// If hesitation_score is LOW and user converted fast:
//   → User was going to buy anyway → LOW causal credit (weight < 1)
//   → This is the "natural converter" problem: discount was wasted
//
// Formula: weight = baseline + hesitation_factor - speed_discount
//   where:
//   - baseline = 1.0 (neutral)
//   - hesitation_factor ∈ [0, +0.5]: high hesitation = high causal credit
//   - speed_discount ∈ [0, -0.3]:    instant click = likely natural converter
function calculateCausalWeight(
  converted: boolean,
  hesitationScore: number, // 0-100
  timeToConvertMs: number | null
): number {
  if (!converted) return 0;

  // Hesitation factor: 0 to +0.5
  const hesitationFactor = (hesitationScore / 100) * 0.5;

  // Speed discount: instant converts (< 3s) get reduced credit
  // They likely would have bought without the popup
  const speedDiscount = timeToConvertMs !== null && timeToConvertMs < 3000
    ? 0.3 * (1 - timeToConvertMs / 3000)
    : 0;

  // Weight: clamp between 0.2 and 1.5
  const weight = 1.0 + hesitationFactor - speedDiscount;
  return Math.max(0.2, Math.min(1.5, Math.round(weight * 100) / 100));
}

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const body   = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const {
      session_id, converted, order_value, time_to_convert_ms,
      hesitation_score, cta_hover_count, mouse_leave_count, tab_hidden_count,
    } = parsed.data;

    const hScore    = hesitation_score    ?? 0;
    const ctaHovers = cta_hover_count     ?? 0;
    const mouseLeft = mouse_leave_count   ?? 0;
    const tabHidden = tab_hidden_count    ?? 0;

    // ── STEP 1: Fetch Full Session Context ──────────────────────────────────
    type SessionRow = {
      session_id: string;
      cohort_key: string | null;
      offer_type: string | null;
      group_assignment: string;
      converted: boolean;
      intent_level: string | null;
      friction_detected: string | null;
      device: string | null;
      traffic_source: string | null;
      scroll_depth_pct: number | null;
      return_visitor: boolean | null;
      price_bucket: string | null;
      expected_uplift: number | null;
      uplift_confidence: number | null;
      created_at: string;
    };

    const sessionRows = await query<SessionRow>(
      `SELECT session_id, cohort_key, offer_type, group_assignment,
              converted, intent_level, friction_detected, device, traffic_source,
              scroll_depth_pct, return_visitor, price_bucket,
              expected_uplift, uplift_confidence, created_at
       FROM popup_sessions WHERE session_id = $1 LIMIT 1`,
      [session_id]
    );

    const session = sessionRows[0];
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.converted && converted) {
      return NextResponse.json({ status: "already_recorded" });
    }

    // ── STEP 2: Calculate Hesitation-Adjusted Causal Weight ─────────────────
    // This is the key differentiator from simple attribution.
    const causalWeight = calculateCausalWeight(converted, hScore, time_to_convert_ms ?? null);

    // Revenue estimation
    const sessionAgeMs = Date.now() - new Date(session.created_at).getTime();
    const resolvedTimeMs = time_to_convert_ms ?? (converted ? Math.min(sessionAgeMs, 30 * 60 * 1000) : null);
    const aov = order_value ?? (session.price_bucket === "high" ? 120 : session.price_bucket === "mid" ? 55 : 25);

    // Causal revenue = full revenue × hesitation-adjusted causal weight × expected uplift
    const causalRevenueCredit = converted && session.group_assignment === "treatment"
      ? (session.expected_uplift ?? 0) * aov * causalWeight
      : 0;

    const discountAvoided =
      converted &&
      session.group_assignment === "treatment" &&
      !["discount_5","discount_10","discount_15"].includes(session.offer_type ?? "");

    // ── STEP 3: Outcome Binding (full behavioral context stored) ────────────
    await query(
      `UPDATE popup_sessions SET
         converted             = $1,
         order_value           = $2,
         causal_revenue_credit = $3,
         time_to_convert_ms    = $4,
         influenced_by_system  = ($5 = 'treatment' AND $6 IS NOT NULL),
         action_taken          = $6,
         discount_avoided      = $7,
         hesitation_score      = $8,
         cta_hover_count       = $9,
         mouse_leave_count     = $10,
         tab_hidden_count      = $11,
         causal_weight         = $12
       WHERE session_id = $13`,
      [
        converted, order_value ?? null, causalRevenueCredit, resolvedTimeMs,
        session.group_assignment, session.offer_type, discountAvoided,
        hScore, ctaHovers, mouseLeft, tabHidden, causalWeight,
        session_id,
      ]
    );

    // ── STEP 4: A/B Results ─────────────────────────────────────────────────
    if (converted && session.offer_type) {
      await query(
        `UPDATE ab_test_results
         SET conversions = conversions + 1, updated_at = now()
         WHERE offer_type = $1`,
        [session.offer_type]
      );
    }

    // ── STEP 5: POLICY MUTATION (Hesitation-Weighted) ───────────────────────
    // THE CORE: We pass the causal_weight to uplift model.
    // High hesitation converts count MORE. Quick converts count LESS.
    // This prevents the model from over-crediting "would-have-bought-anyway" conversions.
    const cohortKey       = parsed.data.cohort_key ?? session.cohort_key;
    const actionType      = parsed.data.action_type ?? session.offer_type ?? "do_nothing";
    const groupAssignment = (parsed.data.group_assignment ?? session.group_assignment ?? "treatment") as "treatment" | "control";

    if (cohortKey) {
      await updateUpliftModel({
        cohortKey,
        actionType,
        groupAssignment,
        converted,
        causalWeight,  // ← Hesitation-adjusted weight
      });
    }

    // ── STEP 6: Signal Importance Learning (full hesitation context) ─────────
    if (cohortKey) {
      await query(
        `INSERT INTO nolix_signal_outcomes
           (cohort_key, intent_level, friction, device, traffic_source,
            scroll_depth_pct, return_visitor, price_bucket,
            action_type, group_assignment, converted,
            hesitation_score, cta_hover_count, mouse_leave_count, tab_hidden_count,
            causal_weight, causal_revenue_credit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          cohortKey, session.intent_level, session.friction_detected,
          session.device, session.traffic_source, session.scroll_depth_pct,
          session.return_visitor, session.price_bucket,
          actionType, groupAssignment, converted,
          hScore, ctaHovers, mouseLeft, tabHidden,
          causalWeight, causalRevenueCredit,
        ]
      ).catch(() => {
        // Non-blocking: signal learning is additive
      });
    }

    return NextResponse.json({
      recorded:              true,
      cohort_key:            cohortKey,
      group_assignment:      groupAssignment,
      action_type:           actionType,
      converted,
      hesitation_score:      hScore,
      causal_weight:         causalWeight,
      causal_revenue_credit: causalRevenueCredit,
      time_to_convert_ms:    resolvedTimeMs,
      model_updated:         !!cohortKey,
      loop_closed:           true,
      causal_interpretation: converted
        ? (causalWeight > 1.1
          ? "HIGH_CAUSAL: Action overcame strong resistance. Full credit."
          : causalWeight < 0.7
          ? "LOW_CAUSAL: User converted fast. Likely natural converter. Reduced credit."
          : "NEUTRAL_CAUSAL: Standard conversion. Normal credit.")
        : "NO_CONVERSION: Policy recalibrated downward for this cohort×action.",
    });

  } catch (err) {
    console.error("[feedback] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
