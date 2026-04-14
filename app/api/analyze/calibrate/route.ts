/**
 * app/api/analyze/calibrate/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Calibration Batch Runner — CRLS Core
 *
 * GET:  Returns current calibration status (latest metrics + coverage)
 * POST: Runs a full calibration batch + returns results + recommendations
 *
 * This is the system's self-diagnostic for domain classification accuracy.
 * Run after every N new outcome records, or on a schedule.
 *
 * The response tells you:
 *   - Was the model overconfident? (overconfidence_bias > 0.10)
 *   - Is the model's ranking working? (AUC)
 *   - Are stated probabilities trustworthy? (calibration_error/ECE)
 *   - What should change in signal weights if performance is poor?
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runCalibrationBatch, getCalibrationStatus } from "@/lib/calibration-engine";
import { ensureNolixSchema } from "@/lib/schema";

export async function GET(_req: NextRequest) {
  try {
    await ensureNolixSchema();
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = await getCalibrationStatus();

    return NextResponse.json({
      ...status,
      // Explain what the numbers mean
      metric_guide: {
        brier_score:     "Lower = better. < 0.05: EXCELLENT | < 0.10: GOOD | < 0.20: ACCEPTABLE | ≥ 0.20: POOR",
        auc:             "Higher = better. > 0.90: EXCELLENT | > 0.70: GOOD | <= 0.50: RANDOM (useless)",
        calibration_error: "Lower = better. < 0.05: trustworthy probabilities | > 0.15: probabilities are misleading",
        overconfidence:  "Near 0 = good. Positive = model predicts ecommerce too often. Negative = too conservative.",
      },
      note: status.matched_count < 10
        ? "⚠️ INSUFFICIENT DATA: Need at least 10 matched prediction+outcome pairs for reliable calibration. Log outcomes via POST /api/analyze/outcome."
        : `✅ ${status.matched_count} matched pairs available for calibration.`,
    });

  } catch (err) {
    console.error("[analyze/calibrate GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  try {
    await ensureNolixSchema();
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = await getCalibrationStatus();

    if (status.matched_count < 5) {
      return NextResponse.json({
        error:      "INSUFFICIENT_DATA",
        message:    `Only ${status.matched_count} matched pairs. Need at least 5 to compute meaningful calibration metrics. Log more outcomes via POST /api/analyze/outcome.`,
        prediction_count: status.prediction_count,
        outcome_count:    status.outcome_count,
        matched_count:    status.matched_count,
      }, { status: 422 });
    }

    const result = await runCalibrationBatch();

    return NextResponse.json({
      calibration_complete: true,
      model_version:        result.model_version,
      sample_size:          result.sample_size,

      metrics: {
        brier_score:        result.mean_brier,        // ↓ accuracy
        log_loss:           result.mean_logloss,      // ↓ no overconfidence
        auc:                result.auc,               // ↑ ranking quality
        calibration_error:  result.calibration_error, // ↓ probability trustworthiness
        overconfidence_bias: result.overconfidence_bias,
        quality:            result.calibration_quality,
      },

      interpretation:                   result.interpretation,
      signal_weight_recommendations:    result.signal_weight_recommendations,

      next_steps: result.calibration_quality === "POOR"
        ? [
            "1. Review signal weight recommendations above.",
            "2. Adjust TIER weights in lib/domain-gate.ts.",
            "3. Bump CALIBRATION_MODEL_VERSION in lib/calibration-engine.ts.",
            "4. Re-run /api/analyze/initialize on a fresh set of known stores.",
            "5. Collect 20+ outcomes and re-run this calibration.",
          ]
        : [
            "Model is performing well. Continue accumulating outcome data.",
            "Run calibration again after 50+ new outcome records.",
          ],
    });

  } catch (err) {
    console.error("[analyze/calibrate POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
