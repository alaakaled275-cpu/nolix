/**
 * lib/calibration-engine.ts
 * ─────────────────────────────────────────────────────────────────
 * CALIBRATED REALITY LEARNING SYSTEM (CRLS)
 *
 * PURPOSE:
 *   The RealityFingerprint produces probabilities.
 *   This module measures whether those probabilities are HONEST.
 *
 *   A model that says "90% ecommerce" for every site is useless.
 *   A calibrated model says "90% ecommerce" and is RIGHT 90% of the time.
 *
 * METRICS:
 *   Brier Score   ↓  : (predicted - actual)² — overall accuracy
 *   Log Loss      ↓  : penalizes overconfident wrong predictions
 *   AUC           ↑  : can the model rank ecommerce sites above non-ecommerce?
 *   Calibration Error↓: Are stated probabilities trustworthy?
 *
 * CALIBRATION QUALITY THRESHOLDS:
 *   Brier < 0.05  → EXCELLENT
 *   Brier < 0.10  → GOOD
 *   Brier < 0.20  → ACCEPTABLE
 *   Brier >= 0.20 → POOR — model needs reweighting
 *
 * FLOW:
 *   RealityFingerprint built
 *   → logPrediction() saves ecommerce_probability to prediction_log
 *   → NOLIX executes
 *   → User behavior proves/disproves classification (checkout, purchase, etc.)
 *   → logOutcome() saves actual_type to outcome_log
 *   → runCalibrationBatch() joins both tables, computes metrics
 *   → Metrics stored in calibration_metrics
 *   → Next model can use these to adjust signal weights
 * ─────────────────────────────────────────────────────────────────
 */

import { query } from "./schema";
import { randomUUID } from "crypto";

export const CALIBRATION_MODEL_VERSION = "rfp-v2.0"; // bump when signal weights change

// ── Types ────────────────────────────────────────────────────────────────────

export interface PredictionRecord {
  id:                      string;
  url:                     string;
  timestamp:               number;
  ecommerce_probability:   number;
  content_probability:     number;
  saas_probability:        number;
  marketplace_probability: number;
  confidence:              number;
  confidence_level:        string;
  data_quality:            string;
  detected_platform:       string | null;
  model_version:           string;
}

export interface OutcomeRecord {
  id:               string;
  url:              string;
  // The ground truth — what the domain ACTUALLY is
  actual_type:      "ecommerce" | "content" | "saas" | "marketplace" | "unknown";
  // How was this verified? (ordered by authority)
  verified_by:      "checkout_data" | "backend_event" | "analytics" | "human" | "inferred";
  // Optional revenue/conversion data if available
  revenue_real?:    number;
  conversion_real?: number;
  timestamp:        number;
}

export interface CalibrationResult {
  model_version:       string;
  sample_size:         number;
  mean_brier:          number;  // Lower = better (0 = perfect, 1 = worst)
  mean_logloss:        number;  // Lower = better
  auc:                 number;  // Higher = better (0.5 = random, 1.0 = perfect)
  calibration_error:   number;  // Expected Calibration Error (ECE)
  calibration_quality: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  overconfidence_bias: number;  // Positive = predicting too high, negative = too low
  computed_at:         number;
}

// ── Core Metrics ─────────────────────────────────────────────────────────────

/**
 * Brier Score: squared difference between predicted probability and actual outcome.
 * Range: 0 (perfect) to 1 (worst).
 * For a calibrated model at p=0.7: should be right 70% of the time.
 */
export function computeBrierScore(pred: number, actual: 0 | 1): number {
  return Math.pow(pred - actual, 2);
}

/**
 * Log Loss: heavily penalizes overconfident wrong predictions.
 * Predicting 0.99 for something that's 0 = catastrophic penalty.
 * Range: 0 (perfect) to ∞.
 */
export function computeLogLoss(pred: number, actual: 0 | 1): number {
  // Clip to avoid log(0) = -Infinity
  const p = Math.min(Math.max(pred, 1e-15), 1 - 1e-15);
  return -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
}

/**
 * AUC (Area Under ROC Curve) via Wilcoxon-Mann-Whitney statistic.
 * Counts: for every (positive, negative) pair, how often does
 * the positive example have a higher predicted score?
 * AUC = 0.5 → model is random. AUC = 1.0 → perfect ranking.
 */
export function computeAUC(
  positives: number[],  // predicted probs for actual ecommerce sites
  negatives: number[]   // predicted probs for non-ecommerce sites
): number {
  if (positives.length === 0 || negatives.length === 0) return 0.5;

  let concordant = 0;
  let tied = 0;
  const total = positives.length * negatives.length;

  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos > neg)       concordant++;
      else if (pos === neg) tied++;
    }
  }
  return (concordant + 0.5 * tied) / total;
}

/**
 * Expected Calibration Error (ECE): bins predictions into deciles,
 * checks whether stated probability matches actual frequency in each bin.
 * ECE = 0 → perfectly calibrated (p=0.8 means right 80% of time).
 */
export function computeECE(
  predictions: number[],
  actuals: (0 | 1)[],
  numBins = 10
): number {
  if (predictions.length === 0) return 0;

  const binSize = 1 / numBins;
  let ece = 0;

  for (let b = 0; b < numBins; b++) {
    const low  = b * binSize;
    const high = low + binSize;

    const inBin = predictions
      .map((p, i) => ({ p, a: actuals[i] }))
      .filter(({ p }) => p >= low && p < high);

    if (inBin.length === 0) continue;

    const avgPred = inBin.reduce((s, { p }) => s + p, 0) / inBin.length;
    const avgActual = inBin.reduce((s, { a }) => s + a, 0) / inBin.length;
    ece += (inBin.length / predictions.length) * Math.abs(avgPred - avgActual);
  }
  return ece;
}

// ── Batch Calibration Computation ────────────────────────────────────────────

export function computeCalibration(
  predictions: Pick<PredictionRecord, "url" | "ecommerce_probability">[],
  outcomes:    Pick<OutcomeRecord, "url" | "actual_type">[]
): CalibrationResult {
  const outcomeMap = new Map(outcomes.map(o => [o.url, o.actual_type]));

  const matched: { pred: number; actual: 0 | 1 }[] = [];

  for (const p of predictions) {
    const actualType = outcomeMap.get(p.url);
    if (!actualType) continue;
    matched.push({
      pred:   p.ecommerce_probability,
      actual: actualType === "ecommerce" ? 1 : 0,
    });
  }

  if (matched.length === 0) {
    return {
      model_version:       CALIBRATION_MODEL_VERSION,
      sample_size:         0,
      mean_brier:          0,
      mean_logloss:        0,
      auc:                 0.5,
      calibration_error:   0,
      calibration_quality: "POOR",
      overconfidence_bias: 0,
      computed_at:         Date.now(),
    };
  }

  const brierScores   = matched.map(m => computeBrierScore(m.pred, m.actual));
  const logLossScores = matched.map(m => computeLogLoss(m.pred, m.actual));

  const meanBrier   = avg(brierScores);
  const meanLogLoss = avg(logLossScores);

  const positives = matched.filter(m => m.actual === 1).map(m => m.pred);
  const negatives = matched.filter(m => m.actual === 0).map(m => m.pred);
  const auc = computeAUC(positives, negatives);

  const ece = computeECE(matched.map(m => m.pred), matched.map(m => m.actual));

  // Overconfidence: avg prediction vs avg actual (positive = predicting too high)
  const avgPred   = avg(matched.map(m => m.pred));
  const avgActual = avg(matched.map(m => m.actual));
  const overconfidenceBias = avgPred - avgActual;

  const quality: CalibrationResult["calibration_quality"] =
    meanBrier < 0.05 ? "EXCELLENT"
    : meanBrier < 0.10 ? "GOOD"
    : meanBrier < 0.20 ? "ACCEPTABLE"
    : "POOR";

  return {
    model_version:       CALIBRATION_MODEL_VERSION,
    sample_size:         matched.length,
    mean_brier:          round4(meanBrier),
    mean_logloss:        round4(meanLogLoss),
    auc:                 round4(auc),
    calibration_error:   round4(ece),
    calibration_quality: quality,
    overconfidence_bias: round4(overconfidenceBias),
    computed_at:         Date.now(),
  };
}

// ── Database Operations ───────────────────────────────────────────────────────

/**
 * Log a prediction to the database after every RealityFingerprint build.
 * This is the "what did the model predict?" record.
 */
export async function logPrediction(
  fingerprint: {
    ecommerce_probability:   number;
    content_probability:     number;
    saas_probability:        number;
    marketplace_probability: number;
    confidence:              number;
    confidence_level:        string;
    data_quality:            string;
    detected_platform:       string | null;
  },
  url: string
): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO prediction_log
       (id, url, ecommerce_probability, content_probability, saas_probability,
        marketplace_probability, confidence, confidence_level, data_quality,
        detected_platform, model_version, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (url) DO UPDATE SET
       ecommerce_probability   = EXCLUDED.ecommerce_probability,
       content_probability     = EXCLUDED.content_probability,
       saas_probability        = EXCLUDED.saas_probability,
       marketplace_probability = EXCLUDED.marketplace_probability,
       confidence              = EXCLUDED.confidence,
       confidence_level        = EXCLUDED.confidence_level,
       data_quality            = EXCLUDED.data_quality,
       detected_platform       = EXCLUDED.detected_platform,
       model_version           = EXCLUDED.model_version,
       created_at              = now()`,
    [
      id, url,
      fingerprint.ecommerce_probability,
      fingerprint.content_probability,
      fingerprint.saas_probability,
      fingerprint.marketplace_probability,
      fingerprint.confidence,
      fingerprint.confidence_level,
      fingerprint.data_quality,
      fingerprint.detected_platform,
      CALIBRATION_MODEL_VERSION,
    ]
  );
  return id;
}

/**
 * Log an outcome — the ground truth about what a domain actually is.
 * Called when a checkout event, purchase, or human verification confirms the truth.
 */
export async function logOutcome(
  url: string,
  actual_type: OutcomeRecord["actual_type"],
  verified_by: OutcomeRecord["verified_by"],
  revenue_real?: number,
  conversion_real?: number
): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO outcome_log
       (id, url, actual_type, verified_by, revenue_real, conversion_real, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now())
     ON CONFLICT (url) DO UPDATE SET
       actual_type     = EXCLUDED.actual_type,
       verified_by     = EXCLUDED.verified_by,
       revenue_real    = EXCLUDED.revenue_real,
       conversion_real = EXCLUDED.conversion_real,
       created_at      = now()`,
    [id, url, actual_type, verified_by, revenue_real ?? null, conversion_real ?? null]
  );
  return id;
}

/**
 * Run the full calibration batch:
 * 1. Load all matched prediction+outcome pairs
 * 2. Compute Brier, LogLoss, AUC, ECE
 * 3. Save to calibration_metrics
 * 4. Return results + interpretation
 */
export async function runCalibrationBatch(): Promise<CalibrationResult & {
  interpretation: string[];
  signal_weight_recommendations: string[];
}> {
  // Load predictions
  type PRow = { url: string; ecommerce_probability: number };
  const predictions = await query<PRow>(
    `SELECT url, ecommerce_probability FROM prediction_log
     WHERE model_version = $1`,
    [CALIBRATION_MODEL_VERSION]
  );

  // Load outcomes
  type ORow = { url: string; actual_type: string };
  const outcomes = await query<ORow>(
    `SELECT url, actual_type FROM outcome_log`
  );

  const result = computeCalibration(
    predictions as Pick<PredictionRecord, "url" | "ecommerce_probability">[],
    outcomes.map(o => ({ url: o.url, actual_type: o.actual_type as OutcomeRecord["actual_type"] }))
  );

  // Save calibration metrics to DB
  await query(
    `INSERT INTO calibration_metrics
       (id, model_version, mean_brier, mean_logloss, auc, calibration_error,
        calibration_quality, overconfidence_bias, sample_size, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
    [
      randomUUID(),
      result.model_version,
      result.mean_brier,
      result.mean_logloss,
      result.auc,
      result.calibration_error,
      result.calibration_quality,
      result.overconfidence_bias,
      result.sample_size,
    ]
  );

  // ── Interpretation layer ────────────────────────────────────────────────────
  const interpretation: string[] = [];
  const recommendations: string[] = [];

  if (result.sample_size < 10) {
    interpretation.push(`⚠️ Only ${result.sample_size} matched pairs. Calibration is not yet statistically reliable. Need >= 10 verified outcomes.`);
  } else {
    interpretation.push(`✅ Calibrated on ${result.sample_size} verified outcomes (model v${result.model_version})`);
  }

  if (result.calibration_quality === "EXCELLENT") {
    interpretation.push(`✅ Brier Score: ${result.mean_brier} — EXCELLENT. Model probabilities are highly trustworthy.`);
  } else if (result.calibration_quality === "GOOD") {
    interpretation.push(`✅ Brier Score: ${result.mean_brier} — GOOD. Model is well-calibrated.`);
  } else if (result.calibration_quality === "ACCEPTABLE") {
    interpretation.push(`⚠️ Brier Score: ${result.mean_brier} — ACCEPTABLE but could improve. Review signal weights.`);
  } else {
    interpretation.push(`🔴 Brier Score: ${result.mean_brier} — POOR. Model is producing unreliable probabilities. Signal weights need rebalancing.`);
    recommendations.push("Increase weight of Tier 1 signals (JSON-LD, platform signatures). Reduce Tier 4 weight.");
  }

  if (result.auc < 0.7) {
    interpretation.push(`🔴 AUC: ${result.auc} — model cannot reliably distinguish ecommerce from non-ecommerce. Near-random ranking.`);
    recommendations.push("Review which signals separate ecommerce from content sites. 'cart', 'checkout', 'add to cart' should be dominant.");
  } else if (result.auc >= 0.9) {
    interpretation.push(`✅ AUC: ${result.auc} — model has excellent ranking ability.`);
  } else {
    interpretation.push(`📊 AUC: ${result.auc} — model has reasonable ranking ability.`);
  }

  if (result.overconfidence_bias > 0.1) {
    interpretation.push(`⚠️ Overconfidence bias: +${result.overconfidence_bias.toFixed(3)} — model is systematically predicting ecommerce probability too HIGH. Apply Platt scaling or reduce signal weights.`);
    recommendations.push(`Lower the TIER1 platform weight from 0.40 to 0.35. The model is overconfident when platform signals exist.`);
  } else if (result.overconfidence_bias < -0.1) {
    interpretation.push(`⚠️ Underconfidence bias: ${result.overconfidence_bias.toFixed(3)} — model is predicting ecommerce probability too LOW. May miss valid stores.`);
    recommendations.push(`Increase TIER2 cart/checkout signals weight. Stores may have functional commerce signals not captured by schema.`);
  } else {
    interpretation.push(`✅ Overconfidence bias: ${result.overconfidence_bias.toFixed(3)} — model predictions are balanced.`);
  }

  if (result.calibration_error > 0.15) {
    interpretation.push(`🔴 Calibration Error (ECE): ${result.calibration_error} — stated probabilities do not match observed frequencies. p=0.80 does NOT mean 80% of sites are ecommerce.`);
    recommendations.push("Apply isotonic regression or bin-based calibration to adjust output probabilities post-prediction.");
  } else {
    interpretation.push(`✅ Calibration Error (ECE): ${result.calibration_error} — stated probabilities are trustworthy.`);
  }

  return {
    ...result,
    interpretation,
    signal_weight_recommendations: recommendations,
  };
}

/**
 * Get the latest calibration status for system health checks.
 */
export async function getCalibrationStatus(): Promise<{
  has_data:            boolean;
  latest_brier:        number | null;
  latest_auc:          number | null;
  latest_quality:      string | null;
  sample_size:         number | null;
  last_calibrated_at:  string | null;
  prediction_count:    number;
  outcome_count:       number;
  matched_count:       number;
}> {
  try {
    type MetRow = { mean_brier: number; auc: number; calibration_quality: string; sample_size: number; created_at: string };
    const latest = await query<MetRow>(
      `SELECT mean_brier, auc, calibration_quality, sample_size, created_at
       FROM calibration_metrics ORDER BY created_at DESC LIMIT 1`
    );

    type CountRow = { count: string };
    const [predCount, outcomeCount, matchedCount] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) as count FROM prediction_log`),
      query<CountRow>(`SELECT COUNT(*) as count FROM outcome_log`),
      query<CountRow>(`SELECT COUNT(*) as count FROM prediction_log p
                       JOIN outcome_log o ON o.url = p.url`),
    ]);

    const L = latest[0];
    return {
      has_data:           !!L,
      latest_brier:       L?.mean_brier ?? null,
      latest_auc:         L?.auc ?? null,
      latest_quality:     L?.calibration_quality ?? null,
      sample_size:        L?.sample_size ?? null,
      last_calibrated_at: L?.created_at ?? null,
      prediction_count:   parseInt(predCount[0]?.count ?? "0"),
      outcome_count:      parseInt(outcomeCount[0]?.count ?? "0"),
      matched_count:      parseInt(matchedCount[0]?.count ?? "0"),
    };
  } catch {
    return {
      has_data: false, latest_brier: null, latest_auc: null,
      latest_quality: null, sample_size: null, last_calibrated_at: null,
      prediction_count: 0, outcome_count: 0, matched_count: 0,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
