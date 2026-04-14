/**
 * lib/causal-engine.ts
 * ─────────────────────────────────────────────────────────────────
 * CAUSAL INTELLIGENCE CORE — v2 (Stability Layer Added)
 *
 * v2 adds:
 *  5. Time Decay    — old uplifts lose weight, not treated as permanent truth
 *  6. Stability Score — uplift must survive multiple time windows to be trusted
 *  7. Cohort Drift Detection — if baseline shifts, force re-exploration
 *  8. Anti-overfitting guard — never reduce exploration to 0 on any action
 *
 * Rule: "No uplift is valid until it survives time, cohorts, and re-testing."
 * ─────────────────────────────────────────────────────────────────
 */

import { query } from "./db";

// ── Constants ───────────────────────────────────────────────────────────────
const CONTROL_RATE        = 0.20;  // 20% holdout — estimator for counterfactual
const MIN_CONFIDENCE      = 0.55;  // Below this, fall back to rules
const MIN_UPLIFT          = 0.03;  // Min +3% CVR to justify any action
const MIN_SAMPLE_FOR_CI   = 30;    // Minimum sessions before trusting the model
const EXPLORATION_RATE    = 0.10;  // 10% random exploration (never drops to 0)
const MIN_EXPLORATION     = 0.05;  // Anti-overfitting: always explore at least 5%
const LEARNING_RATE       = 0.15;  // Rate of policy weight update per session
const DECAY_HALF_LIFE_DAYS = 14;   // Uplift data older than 14d loses 50% of weight
const DRIFT_THRESHOLD     = 0.15;  // If baseline CVR shifts >15%, force re-exploration
const STABILITY_WINDOW_DAYS = 7;   // Stability: compare last 7d vs all-time

export type ActionType =
  | "do_nothing" | "urgency" | "popup_info"
  | "discount_5" | "discount_10" | "discount_15"
  | "free_shipping" | "bundle";

export const ALL_ACTIONS: ActionType[] = [
  "urgency", "popup_info", "discount_5",
  "discount_10", "discount_15", "free_shipping", "bundle"
];

export interface SessionSignals {
  intent_level: "low" | "medium" | "high";
  friction: "none" | "hesitant" | "stuck_cart" | "bounce_risk";
  cart_status: "empty" | "added" | "checkout";
  device: "desktop" | "mobile" | "tablet" | "smart_tv";
  traffic_source: "organic" | "paid_ads" | "direct" | "email" | "social" | "referral";
  scroll_depth_pct?: number;
  return_visitor?: boolean;
  price_bucket?: "low" | "mid" | "high";
}

export interface CausalDecision {
  action: ActionType;
  group_assignment: "treatment" | "control";
  cohort_key: string;
  expected_uplift: number;
  uplift_confidence: number;
  stability_score: number;           // NEW: 0–1, how consistent uplift is over time
  decision_mode: "causal" | "exploration" | "rules_fallback" | "control" | "drift_reset";
  reasoning: string;
}

export interface UpliftRecord {
  action_type: string;
  treatment_conversions: number;
  treatment_impressions: number;
  control_conversions: number;
  control_impressions: number;
  uplift_rate: number;
  confidence: number;
  stability_score: number;
  sample_size: number;
  exploration_weight: number;
  updated_at: string;
  // Time-windowed fields (recent 7d)
  recent_treatment_conversions: number;
  recent_treatment_impressions: number;
  recent_control_conversions: number;
  recent_control_impressions: number;
}

// ── Cohort Key Builder ───────────────────────────────────────────────────────
export function buildCohortKey(s: SessionSignals): string {
  const price  = s.price_bucket ?? "unknown";
  const ret    = s.return_visitor ? "returning" : "new";
  const scroll = (s.scroll_depth_pct ?? 0) >= 60 ? "deep"
               : (s.scroll_depth_pct ?? 0) >= 30 ? "mid"
               : "shallow";
  return `${s.intent_level}|${s.friction}|${s.device}|${price}|${ret}|${scroll}`;
}

// ── Statistical Confidence (Wilson Score approximation) ──────────────────────
function calculateConfidence(n: number, treatment_cvr: number, control_cvr: number): number {
  if (n < MIN_SAMPLE_FOR_CI) {
    return (n / MIN_SAMPLE_FOR_CI) * MIN_CONFIDENCE;
  }
  const pooled = (treatment_cvr + control_cvr) / 2;
  if (pooled <= 0 || pooled >= 1) return 0;
  const se = Math.sqrt(pooled * (1 - pooled) / n);
  const z  = se > 0 ? Math.abs(treatment_cvr - control_cvr) / se : 0;
  return Math.min(0.99, z / 3.0);
}

// ── Time Decay Weight ────────────────────────────────────────────────────────
// Uplift measured 30 days ago should have LESS authority than uplift from yesterday.
// Uses exponential decay: weight = 0.5^(days_old / half_life)
function calculateTimeDecay(updatedAt: string): number {
  const daysOld = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysOld / DECAY_HALF_LIFE_DAYS);
}

// ── Stability Score ──────────────────────────────────────────────────────────
// Compares recent 7-day uplift vs all-time uplift.
// If they agree → stable. If they diverge → unstable (possible cohort drift).
// Stable uplift = trustworthy. Unstable uplift = needs re-exploration.
function calculateStability(
  allTimeUplift: number,
  recentTreatConv: number,
  recentTreatImpr: number,
  recentCtrlConv: number,
  recentCtrlImpr: number
): number {
  if (recentTreatImpr < 5 || recentCtrlImpr < 5) {
    // Not enough recent data to assess stability
    return 0.3; // Low-medium: unknown, don't fully trust
  }
  const recentTcvr = recentTreatConv / recentTreatImpr;
  const recentCcvr = recentCtrlConv  / recentCtrlImpr;
  const recentUplift = recentTcvr - recentCcvr;

  // Divergence = |all-time uplift - recent uplift|
  // High divergence → low stability
  const divergence = Math.abs(allTimeUplift - recentUplift);
  const stability  = Math.max(0, 1 - divergence / Math.max(0.01, Math.abs(allTimeUplift)));

  return Math.min(1.0, stability);
}

// ── Cohort Drift Detection ───────────────────────────────────────────────────
// If the baseline (control group CVR) has shifted significantly from its historical
// average → the cohort has drifted. The old uplift data is no longer reliable.
// We must force re-exploration until new data re-establishes the baseline.
function detectCohortDrift(record: UpliftRecord): boolean {
  if (record.control_impressions < MIN_SAMPLE_FOR_CI) return false;
  if (record.recent_control_impressions < 5) return false;

  const historicalBaseline = record.control_conversions / record.control_impressions;
  const recentBaseline     = record.recent_control_conversions / record.recent_control_impressions;

  const drift = Math.abs(recentBaseline - historicalBaseline);
  return drift > DRIFT_THRESHOLD;
}

// ── Fetch Uplift Model for a Cohort (with time-windowed data) ────────────────
export async function getCohortUplift(cohortKey: string): Promise<UpliftRecord[]> {
  try {
    const rows = await query<UpliftRecord>(
      `SELECT
         m.action_type,
         m.treatment_conversions, m.treatment_impressions,
         m.control_conversions,   m.control_impressions,
         m.uplift_rate, m.confidence, m.stability_score,
         m.sample_size, m.exploration_weight, m.updated_at,
         -- Time-windowed: last 7 days only (for stability + drift calculation)
         COALESCE(r.treatment_conversions, 0) AS recent_treatment_conversions,
         COALESCE(r.treatment_impressions, 0) AS recent_treatment_impressions,
         COALESCE(r.control_conversions,   0) AS recent_control_conversions,
         COALESCE(r.control_impressions,   0) AS recent_control_impressions
       FROM nolix_uplift_model m
       LEFT JOIN nolix_uplift_recent r
         ON r.cohort_key = m.cohort_key AND r.action_type = m.action_type
       WHERE m.cohort_key = $1
       ORDER BY m.uplift_rate DESC`,
      [cohortKey]
    );
    return rows;
  } catch {
    return [];
  }
}

// ── THE CORE DECISION FUNCTION ───────────────────────────────────────────────
// action = argmax over A { Expected_Uplift(A | context) × Time_Decay × Stability }
// This is now a STABLE causal estimator, not just a reactive updater.
export async function causalDecide(signals: SessionSignals): Promise<CausalDecision> {
  const cohortKey = buildCohortKey(signals);

  // ── 1. Control Group (Counterfactual Estimator — not ground truth) ──
  if (Math.random() < CONTROL_RATE) {
    return {
      action: "do_nothing",
      group_assignment: "control",
      cohort_key: cohortKey,
      expected_uplift: 0,
      uplift_confidence: 1.0,
      stability_score: 1.0,
      decision_mode: "control",
      reasoning: "CONTROL_GROUP: Counterfactual estimation holdout. Baseline measurement only.",
    };
  }

  // ── 2. Bounce risk gate ──
  if (signals.friction === "bounce_risk" || signals.intent_level === "low") {
    return {
      action: "do_nothing",
      group_assignment: "treatment",
      cohort_key: cohortKey,
      expected_uplift: 0,
      uplift_confidence: 0,
      stability_score: 0,
      decision_mode: "rules_fallback",
      reasoning: "RULES_GATE: bounce_risk or low intent — no action justified.",
    };
  }

  // ── 3. Forced Exploration (never drops below MIN_EXPLORATION) ──
  const dynamicExplorationRate = Math.max(MIN_EXPLORATION, EXPLORATION_RATE);
  if (Math.random() < dynamicExplorationRate) {
    const randAction = ALL_ACTIONS[Math.floor(Math.random() * ALL_ACTIONS.length)];
    return {
      action: randAction,
      group_assignment: "treatment",
      cohort_key: cohortKey,
      expected_uplift: 0,
      uplift_confidence: 0,
      stability_score: 0,
      decision_mode: "exploration",
      reasoning: `EXPLORATION: Testing "${randAction}" to gather causal data. Anti-overfitting guard active.`,
    };
  }

  // ── 4. Query Uplift Model ──
  const cohortData = await getCohortUplift(cohortKey);
  if (cohortData.length === 0) return coldStartFallback(signals, cohortKey);

  // ── 5. Drift Check — if cohort has drifted, force re-exploration ──
  const hasDrift = cohortData.some(detectCohortDrift);
  if (hasDrift) {
    const randAction = ALL_ACTIONS[Math.floor(Math.random() * ALL_ACTIONS.length)];
    return {
      action: randAction,
      group_assignment: "treatment",
      cohort_key: cohortKey,
      expected_uplift: 0,
      uplift_confidence: 0,
      stability_score: 0,
      decision_mode: "drift_reset",
      reasoning: `DRIFT_DETECTED: Cohort baseline has shifted >${DRIFT_THRESHOLD * 100}%. Old uplift data invalidated. Forcing exploration to rebuild model.`,
    };
  }

  // ── 6. Evaluate actions with Time Decay × Stability weighting ──
  let bestAction: ActionType = "do_nothing";
  let bestScore   = MIN_UPLIFT; // Must beat this threshold
  let bestConf    = 0;
  let bestStab    = 0;

  for (const record of cohortData) {
    const treatmentCvr = record.treatment_impressions > 0
      ? record.treatment_conversions / record.treatment_impressions : 0;
    const controlCvr   = record.control_impressions > 0
      ? record.control_conversions / record.control_impressions : 0;

    const uplift    = treatmentCvr - controlCvr;
    const conf      = calculateConfidence(record.sample_size, treatmentCvr, controlCvr);
    const decay     = calculateTimeDecay(record.updated_at);
    const stability = calculateStability(
      uplift,
      record.recent_treatment_conversions,
      record.recent_treatment_impressions,
      record.recent_control_conversions,
      record.recent_control_impressions
    );

    // Adjusted score: uplift × time_decay × stability × (1 + UCB_bonus)
    // An action must prove itself across time AND recent behavior to be chosen.
    const ucbBonus    = record.exploration_weight * 0.02;
    const adjustedScore = (uplift * decay * stability) + ucbBonus;

    if (conf >= MIN_CONFIDENCE && adjustedScore > bestScore) {
      bestAction = record.action_type as ActionType;
      bestScore  = adjustedScore;
      bestConf   = conf;
      bestStab   = stability;
    }
  }

  if (bestAction === "do_nothing" && bestConf === 0) {
    return coldStartFallback(signals, cohortKey);
  }

  return {
    action: bestAction,
    group_assignment: "treatment",
    cohort_key: cohortKey,
    expected_uplift: Math.max(0, bestScore),
    uplift_confidence: bestConf,
    stability_score: bestStab,
    decision_mode: "causal",
    reasoning: `CAUSAL: action="${bestAction}" | uplift_score=${(bestScore * 100).toFixed(1)}% | conf=${(bestConf * 100).toFixed(0)}% | stability=${(bestStab * 100).toFixed(0)}%`,
  };
}

// ── Cold Start Fallback ──────────────────────────────────────────────────────
function coldStartFallback(signals: SessionSignals, cohortKey: string): CausalDecision {
  let action: ActionType = "popup_info";
  if (signals.intent_level === "high") {
    action = "urgency";
  } else if (signals.friction === "stuck_cart") {
    action = signals.traffic_source === "paid_ads" ? "discount_15" : "discount_10";
  } else if (signals.friction === "hesitant") {
    action = signals.device === "mobile" ? "free_shipping" : "bundle";
  }
  return {
    action,
    group_assignment: "treatment",
    cohort_key: cohortKey,
    expected_uplift: 0,
    uplift_confidence: 0,
    stability_score: 0,
    decision_mode: "rules_fallback",
    reasoning: `COLD_START: No causal data for cohort "${cohortKey}" yet. Rule heuristic (temporary).`,
  };
}

// ── UPDATE UPLIFT MODEL ──────────────────────────────────────────────────────
// Mathematical policy mutation. Runs after every resolved session.
// Writes both all-time and recent (7d) stats for stability tracking.
export async function updateUpliftModel(params: {
  cohortKey: string;
  actionType: string;
  groupAssignment: "treatment" | "control";
  converted: boolean;
  causalWeight?: number;   // 0.2–1.5: adjusts attribution based on hesitation
}): Promise<void> {
  const { cohortKey, actionType, groupAssignment, converted } = params;
  // Hesitation-adjusted effective conversion value
  // Natural converter (low hesitation, fast click) → weight < 1 → less credit
  // Resistant converter (high hesitation, overcame friction) → weight > 1 → more credit
  const causalWeight = params.causalWeight ?? 1.0;
  const conv = converted ? causalWeight : 0; // Weighted conversion value

  if (groupAssignment === "treatment") {
    await query(
      `INSERT INTO nolix_uplift_model
         (cohort_key, action_type, treatment_conversions, treatment_impressions, sample_size)
       VALUES ($1, $2, $3, 1, 1)
       ON CONFLICT (cohort_key, action_type) DO UPDATE SET
         treatment_conversions = nolix_uplift_model.treatment_conversions + $3,
         treatment_impressions = nolix_uplift_model.treatment_impressions + 1,
         sample_size           = nolix_uplift_model.sample_size + 1,
         updated_at            = now()`,
      [cohortKey, actionType, conv]
    );
  } else {
    await query(
      `INSERT INTO nolix_uplift_model
         (cohort_key, action_type, control_conversions, control_impressions, sample_size)
       VALUES ($1, $2, $3, 1, 1)
       ON CONFLICT (cohort_key, action_type) DO UPDATE SET
         control_conversions = nolix_uplift_model.control_conversions + $3,
         control_impressions = nolix_uplift_model.control_impressions + 1,
         sample_size         = nolix_uplift_model.sample_size + 1,
         updated_at          = now()`,
      [cohortKey, actionType, conv]
    );
  }

  // Also update recent (7d) tracking table
  await query(
    `INSERT INTO nolix_uplift_recent
       (cohort_key, action_type,
        treatment_conversions, treatment_impressions,
        control_conversions, control_impressions)
     VALUES ($1, $2,
       $3, $4, $5, $6)
     ON CONFLICT (cohort_key, action_type) DO UPDATE SET
       treatment_conversions = nolix_uplift_recent.treatment_conversions + $3,
       treatment_impressions = nolix_uplift_recent.treatment_impressions + $4,
       control_conversions   = nolix_uplift_recent.control_conversions   + $5,
       control_impressions   = nolix_uplift_recent.control_impressions   + $6,
       window_start          = CASE
         WHEN now() - nolix_uplift_recent.window_start > interval '7 days'
         THEN now()  -- Reset window if older than 7 days
         ELSE nolix_uplift_recent.window_start
       END`,
    [
      cohortKey, actionType,
      groupAssignment === "treatment" ? conv : 0,
      groupAssignment === "treatment" ? 1 : 0,
      groupAssignment === "control" ? conv : 0,
      groupAssignment === "control" ? 1 : 0,
    ]
  );

  // ── Recalculate all metrics including stability_score ──
  await query(
    `UPDATE nolix_uplift_model m
     SET
       uplift_rate = CASE
         WHEN treatment_impressions > 0 AND control_impressions > 0
         THEN (treatment_conversions::float / treatment_impressions)
              - (control_conversions::float  / control_impressions)
         ELSE 0
       END,
       confidence = LEAST(0.99, CASE
         WHEN sample_size < $3
         THEN (sample_size::float / $3) * $4
         ELSE LEAST(0.99, ABS(
           CASE WHEN treatment_impressions > 0
                THEN treatment_conversions::float / treatment_impressions ELSE 0 END
           -
           CASE WHEN control_impressions > 0
                THEN control_conversions::float  / control_impressions   ELSE 0 END
         ) / NULLIF(SQRT(0.25 / GREATEST(1, sample_size)), 0) / 3.0)
       END),
       stability_score = CASE
         WHEN r.treatment_impressions >= 5 AND r.control_impressions >= 5
         THEN LEAST(1.0, GREATEST(0.0,
           1.0 - ABS(
             (r.treatment_conversions::float / NULLIF(r.treatment_impressions,0))
             - (r.control_conversions::float / NULLIF(r.control_impressions,0))
             - uplift_rate
           ) / NULLIF(ABS(uplift_rate), 0.01)
         ))
         ELSE 0.3
       END,
       -- Anti-overfitting: exploration_weight never drops below MIN_EXPLORATION cap
       exploration_weight = CASE
         WHEN uplift_rate > $5
         THEN GREATEST($6, exploration_weight - $7)  -- $6 = MIN_EXPLORATION
         ELSE LEAST(2.0, exploration_weight + $7)
       END,
       updated_at = now()
     FROM nolix_uplift_recent r
     WHERE m.cohort_key = $1 AND m.action_type = $2
       AND r.cohort_key = $1 AND r.action_type = $2`,
    [cohortKey, actionType, MIN_SAMPLE_FOR_CI, MIN_CONFIDENCE, MIN_UPLIFT, MIN_EXPLORATION, LEARNING_RATE]
  );
}

// ── POLICY SUMMARY ───────────────────────────────────────────────────────────
export async function getPolicySummary(): Promise<{
  total_cohorts: number;
  confident_actions: number;
  stable_actions: number;
  drifted_cohorts: number;
  best_action: string | null;
  best_uplift: number;
  total_uplift_value: number;
  learning_progress_pct: number;
  avg_stability: number;
}> {
  try {
    type CountRow = {
      total_cohorts: string;
      confident_actions: string;
      stable_actions: string;
      drifted_cohorts: string;
      best_action: string;
      best_uplift: string;
      total_uplift_value: string;
      learning_progress_pct: string;
      avg_stability: string;
    };

    const rows = await query<CountRow>(
      `SELECT
         COUNT(DISTINCT cohort_key)                                      AS total_cohorts,
         COUNT(*) FILTER (WHERE confidence >= $1)                        AS confident_actions,
         COUNT(*) FILTER (WHERE stability_score >= 0.6)                  AS stable_actions,
         COUNT(DISTINCT CASE
           WHEN r.control_impressions >= 5
            AND ABS(
              (r.control_conversions::float / NULLIF(r.control_impressions,0))
              - (control_conversions::float  / NULLIF(control_impressions,0))
            ) > $3
           THEN m.cohort_key END)                                        AS drifted_cohorts,
         MAX(action_type) FILTER (WHERE uplift_rate = MAX(uplift_rate)
           OVER ())                                                       AS best_action,
         MAX(uplift_rate)  FILTER (WHERE confidence >= $1)               AS best_uplift,
         SUM(GREATEST(0, uplift_rate) * treatment_conversions)           AS total_uplift_value,
         AVG(LEAST(1.0, sample_size::float / $2))                        AS learning_progress_pct,
         AVG(stability_score)                                            AS avg_stability
       FROM nolix_uplift_model m
       LEFT JOIN nolix_uplift_recent r
         ON r.cohort_key = m.cohort_key AND r.action_type = m.action_type`,
      [MIN_CONFIDENCE, MIN_SAMPLE_FOR_CI, DRIFT_THRESHOLD]
    );

    const r = rows[0];
    return {
      total_cohorts:         parseInt(r?.total_cohorts ?? "0"),
      confident_actions:     parseInt(r?.confident_actions ?? "0"),
      stable_actions:        parseInt(r?.stable_actions ?? "0"),
      drifted_cohorts:       parseInt(r?.drifted_cohorts ?? "0"),
      best_action:           r?.best_action ?? null,
      best_uplift:           parseFloat(r?.best_uplift ?? "0"),
      total_uplift_value:    parseFloat(r?.total_uplift_value ?? "0"),
      learning_progress_pct: parseFloat(r?.learning_progress_pct ?? "0") * 100,
      avg_stability:         parseFloat(r?.avg_stability ?? "0"),
    };
  } catch {
    return {
      total_cohorts: 0, confident_actions: 0, stable_actions: 0, drifted_cohorts: 0,
      best_action: null, best_uplift: 0, total_uplift_value: 0,
      learning_progress_pct: 0, avg_stability: 0,
    };
  }
}
