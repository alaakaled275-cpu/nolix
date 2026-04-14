/**
 * lib/calibration.ts
 * ZENO Calibration Engine — Measures honesty of probabilistic predictions.
 *
 * The most important question: "Is the system honest, or just confident?"
 * - Brier Score: mean((predicted - actual)^2) — lower = more honest
 * - LogLoss: penalizes confident wrong predictions exponentially
 * - Drift Detection: compares 7-day vs 30-day Brier — catches model degradation
 */
import { query } from "./db";

export interface CalibrationReport {
  brier_score: number;        // 0.0 = perfect, 0.25 = random, 1.0 = perfectly wrong
  brier_label: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  log_loss: number;
  sample_size: number;
  drift_detected: boolean;
  drift_magnitude: number;    // positive = model is getting worse
  drift_direction: "improving" | "stable" | "degrading";
  accuracy_rate: number;      // % of predictions where argmax class == actual
  overconfidence_bias: number; // positive = overconfident, negative = underconfident
  calibration_curve: CalibrationBucket[]; // for chart rendering
  recommendation: string;
}

export interface CalibrationBucket {
  predicted_range: string;   // e.g. "0.7-0.8"
  mean_predicted: number;
  actual_rate: number;       // fraction that actually converted
  count: number;
}

/**
 * Compute Brier Score from structured rows.
 * brier = mean((p - y)^2)
 */
function computeBrier(rows: { p: number; y: number }[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + Math.pow(r.p - r.y, 2), 0);
  return sum / rows.length;
}

/**
 * Compute Binary Cross-Entropy (LogLoss)
 * Penalizes confident wrong predictions much harder than Brier.
 */
function computeLogLoss(rows: { p: number; y: number }[]): number {
  if (rows.length === 0) return 0;
  const eps = 1e-7; // avoid log(0)
  const sum = rows.reduce((acc, r) => {
    const p = Math.max(eps, Math.min(1 - eps, r.p));
    return acc + (r.y * Math.log(p) + (1 - r.y) * Math.log(1 - p));
  }, 0);
  return -(sum / rows.length);
}

/**
 * Brier Score human label
 */
function brierLabel(b: number): CalibrationReport["brier_label"] {
  if (b < 0.05) return "Excellent";
  if (b < 0.10) return "Good";
  if (b < 0.15) return "Fair";
  if (b < 0.20) return "Poor";
  return "Critical";
}

/**
 * Build calibration curve buckets for chart rendering.
 * Groups predictions by probability bins (0-0.1, 0.1-0.2, ... 0.9-1.0).
 */
function buildCalibrationCurve(rows: { p: number; y: number }[]): CalibrationBucket[] {
  const buckets: Record<string, { sum_p: number; sum_y: number; count: number }> = {};

  for (let i = 0; i < 10; i++) {
    const lo = i / 10;
    const hi = (i + 1) / 10;
    const key = `${lo.toFixed(1)}-${hi.toFixed(1)}`;
    buckets[key] = { sum_p: 0, sum_y: 0, count: 0 };
  }

  rows.forEach(({ p, y }) => {
    const bucketIdx = Math.min(9, Math.floor(p * 10));
    const lo = bucketIdx / 10;
    const hi = (bucketIdx + 1) / 10;
    const key = `${lo.toFixed(1)}-${hi.toFixed(1)}`;
    buckets[key].sum_p += p;
    buckets[key].sum_y += y;
    buckets[key].count += 1;
  });

  return Object.entries(buckets)
    .filter(([, b]) => b.count > 0)
    .map(([range, b]) => ({
      predicted_range: range,
      mean_predicted: b.sum_p / b.count,
      actual_rate: b.sum_y / b.count,
      count: b.count,
    }));
}

/**
 * Main calibration function.
 * Reads from zeno_reality_logs and computes full calibration report.
 */
export async function computeCalibration(
  storeDomain?: string,
  windowDays: number = 30
): Promise<CalibrationReport> {
  const domainClause = storeDomain ? "AND store_domain = $2" : "";
  const params: any[] = [`${windowDays} days`];
  if (storeDomain) params.push(storeDomain);

  // Fetch settled predictions (where actual_class is known)
  const rows = await query<{
    predicted_probability: number;
    actual_class: string;
  }>(
    `SELECT predicted_probability, actual_class
     FROM zeno_reality_logs
     WHERE actual_class IS NOT NULL
       AND verification_source != 'pending'
       AND timestamp > now() - $1::interval
       ${domainClause}`,
    params
  );

  const structured = rows.map((r) => ({
    p: Number(r.predicted_probability),
    y: r.actual_class === "convert" ? 1 : 0,
  }));

  const brier = computeBrier(structured);
  const logLoss = computeLogLoss(structured);
  const accuracy = structured.length > 0
    ? structured.filter((r) => (r.p >= 0.5 ? 1 : 0) === r.y).length / structured.length
    : 0;

  // Overconfidence bias: mean(predicted) - actual_rate
  const meanPredicted = structured.length > 0
    ? structured.reduce((a, r) => a + r.p, 0) / structured.length
    : 0;
  const actualRate = structured.length > 0
    ? structured.reduce((a, r) => a + r.y, 0) / structured.length
    : 0;
  const overconfidenceBias = meanPredicted - actualRate;

  // 7-day Brier for drift detection
  const recent7Params: any[] = ["7 days"];
  if (storeDomain) recent7Params.push(storeDomain);

  const recent7Rows = await query<{
    predicted_probability: number;
    actual_class: string;
  }>(
    `SELECT predicted_probability, actual_class
     FROM zeno_reality_logs
     WHERE actual_class IS NOT NULL
       AND verification_source != 'pending'
       AND timestamp > now() - $1::interval
       ${domainClause}`,
    recent7Params
  );

  const recent7 = recent7Rows.map((r) => ({
    p: Number(r.predicted_probability),
    y: r.actual_class === "convert" ? 1 : 0,
  }));

  const brier7 = computeBrier(recent7);
  const driftMagnitude = brier7 - brier; // positive = getting worse recently
  const driftDetected = Math.abs(driftMagnitude) > 0.05 && recent7.length >= 10;
  const driftDirection: CalibrationReport["drift_direction"] =
    driftMagnitude > 0.05 ? "degrading" : driftMagnitude < -0.05 ? "improving" : "stable";

  const calibrationCurve = buildCalibrationCurve(structured);

  const recommendation =
    brier < 0.05
      ? "System is well-calibrated. Predictions match reality with high fidelity."
      : brier < 0.10
      ? "Good calibration. Monitor overconfidence bias and continue collecting data."
      : brier < 0.15
      ? "Fair calibration. Consider recalibrating thresholds or collecting more varied sessions."
      : brier < 0.20
      ? "Poor calibration. Model is systematically wrong. Investigate signal quality."
      : "Critical: Model predictions do not match reality. Stop relying on estimates. Run full audit.";

  return {
    brier_score: Math.round(brier * 10000) / 10000,
    brier_label: brierLabel(brier),
    log_loss: Math.round(logLoss * 10000) / 10000,
    sample_size: structured.length,
    drift_detected: driftDetected,
    drift_magnitude: Math.round(driftMagnitude * 10000) / 10000,
    drift_direction: driftDirection,
    accuracy_rate: Math.round(accuracy * 10000) / 10000,
    overconfidence_bias: Math.round(overconfidenceBias * 10000) / 10000,
    calibration_curve: calibrationCurve,
    recommendation,
  };
}

/**
 * Log a new prediction to zeno_reality_logs.
 * Call this every time Zeno makes a decision.
 */
export async function logPrediction(data: {
  session_id: string;
  store_domain: string;
  predicted_class: string;
  predicted_probability: number;
  p_convert_no_action: number;
  p_convert_action: number;
  uplift_estimated: number;
  action_taken: string;
  economic_decision: "intervene" | "wait";
  decision_cost: number;
  causal_weights: Record<string, number>;
  session_signals: Record<string, any>;
}): Promise<string | null> {
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO zeno_reality_logs (
        session_id, store_domain, predicted_class, predicted_probability,
        p_convert_no_action, p_convert_action, uplift_estimated,
        action_taken, economic_decision, decision_cost,
        causal_weights, session_signals
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (session_id) DO NOTHING
       RETURNING id`,
      [
        data.session_id,
        data.store_domain,
        data.predicted_class,
        data.predicted_probability,
        data.p_convert_no_action,
        data.p_convert_action,
        data.uplift_estimated,
        data.action_taken,
        data.economic_decision,
        data.decision_cost,
        JSON.stringify(data.causal_weights),
        JSON.stringify(data.session_signals),
      ]
    );
    return result[0]?.id ?? null;
  } catch (err) {
    console.warn("[calibration] logPrediction failed:", err);
    return null;
  }
}

/**
 * Bind actual outcome to an existing prediction.
 * Called when a conversion event OR timeout arrives.
 */
export async function bindOutcome(
  session_id: string,
  actual_class: "convert" | "exit",
  verification_source: "checkout_event" | "timeout" | "manual"
): Promise<void> {
  try {
    await query(
      `UPDATE zeno_reality_logs
       SET actual_class = $1, verification_source = $2
       WHERE session_id = $3 AND actual_class IS NULL`,
      [actual_class, verification_source, session_id]
    );
  } catch (err) {
    console.warn("[calibration] bindOutcome failed:", err);
  }
}
