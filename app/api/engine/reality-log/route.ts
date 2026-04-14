/**
 * app/api/engine/reality-log/route.ts
 * Binds actual visitor outcomes to Zeno's predictions.
 * Called when: (1) checkout completed, (2) session timeout, (3) explicit exit.
 *
 * This is the FEEDBACK LOOP that makes the system self-correcting.
 * Without this, predictions are just claims. With this, they are measured.
 */
import { NextRequest, NextResponse } from "next/server";
import { bindOutcome } from "@/lib/calibration";
import { query, ensureNolixSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const body = await req.json();
    const {
      session_id,
      actual_class, // 'convert' | 'exit'
      verification_source = "manual", // 'checkout_event' | 'timeout' | 'manual'
      revenue_amount,
    } = body;

    if (!session_id || !actual_class) {
      return NextResponse.json(
        { error: "session_id and actual_class are required" },
        { status: 400 }
      );
    }

    if (!["convert", "exit"].includes(actual_class)) {
      return NextResponse.json(
        { error: "actual_class must be 'convert' or 'exit'" },
        { status: 400 }
      );
    }

    // 1. Bind outcome to calibration log
    await bindOutcome(session_id, actual_class, verification_source);

    // 2. Update the learning loop: increment conversions in uplift model
    if (actual_class === "convert") {
      try {
        // Mark session as converted
        await query(
          `UPDATE popup_sessions SET converted = true WHERE session_id = $1`,
          [session_id]
        );

        // Update uplift model for the cohort + action combo
        await query(
          `UPDATE zeno_action_metrics
           SET conversions = conversions + 1, updated_at = now()
           WHERE store_domain = (
             SELECT store_url::text FROM users
             WHERE store_url IS NOT NULL LIMIT 1
           )
           AND action_name = (
             SELECT action_taken FROM popup_sessions WHERE session_id = $1
           )`,
          [session_id]
        );

        // Record causal weight for signal importance learning
        const sessionRow = await query<{ cohort_key: string; action_taken: string; expected_uplift: number }>(
          `SELECT cohort_key, action_taken, expected_uplift FROM popup_sessions WHERE session_id = $1`,
          [session_id]
        );

        if (sessionRow[0]) {
          const { cohort_key, action_taken, expected_uplift } = sessionRow[0];
          await query(
            `INSERT INTO nolix_uplift_model (
               cohort_key, action_type,
               treatment_conversions, treatment_impressions,
               control_conversions, control_impressions,
               uplift_rate, confidence, sample_size, updated_at
             ) VALUES ($1,$2,1,1,0,0,$3,0.3,1,now())
             ON CONFLICT (cohort_key, action_type) DO UPDATE SET
               treatment_conversions = nolix_uplift_model.treatment_conversions + 1,
               treatment_impressions = nolix_uplift_model.treatment_impressions + 1,
               uplift_rate = CASE
                 WHEN nolix_uplift_model.treatment_impressions + 1 > 0
                 THEN (nolix_uplift_model.treatment_conversions + 1)::float /
                      (nolix_uplift_model.treatment_impressions + 1)::float
                 ELSE 0
               END,
               confidence = LEAST(0.99,
                 0.3 + (nolix_uplift_model.sample_size + 1)::float * 0.002
               ),
               sample_size = nolix_uplift_model.sample_size + 1,
               updated_at = now()`,
            [cohort_key, action_taken, expected_uplift ?? 0]
          );
        }
      } catch (err) {
        console.warn("[reality-log] Uplift model update failed (non-critical):", err);
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      actual_class,
      verification_source,
      message: `Outcome bound. Calibration system updated.`,
    });

  } catch (err: any) {
    console.error("[reality-log] Error:", err);
    return NextResponse.json({ error: "Failed to bind outcome" }, { status: 500 });
  }
}

// GET: Fetch calibration insights for a domain
export async function GET(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const { computeCalibration } = await import("@/lib/calibration");
    const domain = req.nextUrl.searchParams.get("domain") ?? undefined;

    const report = await computeCalibration(domain, 30);
    return NextResponse.json(report);
  } catch (err: any) {
    console.error("[reality-log] GET error:", err);
    return NextResponse.json({ error: "Failed to compute calibration" }, { status: 500 });
  }
}
