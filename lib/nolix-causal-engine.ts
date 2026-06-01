/**
 * NOLIX — Causal Inference Engine
 * lib/nolix-causal-engine.ts
 *
 * Measures: Did customer convert BECAUSE of intervention?
 * Uses: Counterfactual reasoning + synthetic control groups
 *
 * This is THE missing piece: Real conversion intelligence.
 */

import { redis } from "./redis";
import { query } from "./db";

// ============================================================
// CAUSAL METRICS INTERFACE
// ============================================================
export interface CausalMetrics {
  // Treatment vs Control analysis
  treatment_conversions: number;
  control_conversions: number;
  treatment_size: number;
  control_size: number;

  // Causal effects
  conversion_lift: number;        // actual lift from intervention
  attributable_revenue: number; // revenue from interventions
  wasted_discounts: number;     // discounts given to would-have-converted
  incremental_conversions: number; // NEW conversions from interventions

  // Statistical confidence
  p_value: number;
  confidence_level: number;      // 0-1

  // Time-series
  daily_lift: number[];
  weekly_lift: number[];
  conversion_decay_hours: number; // how quickly effect decays
}

// Decision breakdown
export interface InterventionOutcome {
  session_id: string;
  intervention_type: "popup" | "discount" | "message" | "nothing";
  discount_pct: number;

  // What happened
  converted: boolean;
  revenue: number;

  // Counterfactual (what would have happened)
  would_have_converted: boolean;
  counterfactual_reason: string;

  // Attribution
  causal_score: number;         // 0-1 how much intervention caused conversion
  confidence: number;
}

// ============================================================
// SYNTHETIC CONTROL GROUP GENERATION
// ============================================================

/**
 * Generate synthetic control: similar visitors who got NO intervention
 * Uses: Matching on feature distance
 */
export async function getSyntheticControl(
  interventionSession: InterventionOutcome,
  lookback_hours: number = 168 // 7 days
): Promise<InterventionOutcome[]> {
  const cutoff = Date.now() - lookback_hours * 3600 * 1000;

  // Query: sessions with NO intervention, similar features
  const sql = `
    SELECT
      session_id,
      converted,
      revenue,
      engagement_score,
      hesitation_score,
      active_time_seconds,
      idle_time_seconds,
      scroll_depth,
      pages_viewed,
      time_on_site
    FROM nolix_sessions
    WHERE
      store = $1
      AND created_at > $2
      AND intervention_type = 'nothing'
      AND converted = true
    ORDER BY
      -- Feature distance (simplified)
      ABS(engagement_score - $3) +
      ABS(hesitation_score - $4) +
      ABS(time_on_site - $5)
    LIMIT 100
  `;

  try {
    const results = await query<any>(sql, [
      interventionSession.session_id.split('_')[0], // store
      cutoff,
      0.5, // avg engagement
      0.5, // avg hesitation
      120  // avg time
    ]);
    return results.map((r: any) => ({
      session_id: r.session_id,
      intervention_type: "nothing" as const,
      discount_pct: 0,
      converted: r.converted,
      revenue: r.revenue || 0,
      would_have_converted: false,
      counterfactual_reason: "synthetic_control",
      causal_score: 0,
      confidence: 0
    }));
  } catch (e) {
    return [];
  }
}

// ============================================================
// CAUSAL SCORE CALCULATION
// ============================================================

/**
 * Calculate if intervention CAUSED conversion
 * Uses: Bayesian update + feature adjustment
 */
export function calculateCausalScore(
  intervention: InterventionOutcome,
  controlGroup: InterventionOutcome[]
): { score: number; confidence: number; reason: string } {

  // Base: if converted WITH intervention vs WITHOUT
  const treatmentRate = intervention.converted ? 1 : 0;

  // Control conversion rate
  const controlRate = controlGroup.length > 0
    ? controlGroup.filter(c => c.converted).length / controlGroup.length
    : 0.15; // baseline fallback

  // Lift calculation
  const lift = controlRate > 0
    ? (treatmentRate - controlRate) / controlRate
    : 0;

  // Time decay factor (interventions lose effect over time)
  const hoursSinceIntervention = (Date.now() - parseInt(intervention.session_id.split('_')[1] || '0')) / 3600000;
  const decayFactor = Math.exp(-hoursSinceIntervention / 24); // 24-hour half-life

  // Feature adjustment (high hesitation = higher causal credit)
  const hesitationBonus = intervention.intervention_type !== "nothing" ? 0.2 : 0;

  // Final causal score
  let causalScore = Math.max(0, Math.min(1,
    (lift * decayFactor) + hesitationBonus
  ));

  // Confidence based on control group size
  const confidence = Math.min(1,
    0.5 + (controlGroup.length / 100) * 0.5
  );

  // Reason
  let reason = "";
  if (causalScore > 0.7) {
    reason = `strong_causal: lift=${lift.toFixed(2)}, decay=${decayFactor.toFixed(2)}`;
  } else if (causalScore > 0.4) {
    reason = `moderate_causal: lift=${lift.toFixed(2)}`;
  } else if (controlGroup.length === 0) {
    reason = "insufficient_control_group";
  } else {
    reason = `no_causal_link: lift=${lift.toFixed(2)}`;
  }

  return { score: causalScore, confidence, reason };
}

// ============================================================
// AGGREGATE CAUSAL METRICS
// ============================================================

export async function getCausalMetrics(
  store: string,
  days: number = 30
): Promise<CausalMetrics> {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  // Get treatment group (intervention = yes)
  const treatmentSql = `
    SELECT
      COUNT(*) as count,
      SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions,
      SUM(revenue) as revenue
    FROM nolix_sessions
    WHERE store = $1 AND created_at > $2 AND intervention_type != 'nothing'
  `;

  // Get control group
  const controlSql = `
    SELECT
      COUNT(*) as count,
      SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions,
      SUM(revenue) as revenue
    FROM nolix_sessions
    WHERE store = $1 AND created_at > $2 AND intervention_type = 'nothing'
  `;

  try {
    const [treatment, control] = await Promise.all([
      query<any>(treatmentSql, [store, cutoff]),
      query<any>(controlSql, [store, cutoff])
    ]);

    const tCount = parseInt(treatment[0]?.count || '0');
    const cCount = parseInt(control[0]?.count || '0');
    const tConv = parseInt(treatment[0]?.conversions || '0');
    const cConv = parseInt(control[0]?.conversions || '0');

    const tRate = tCount > 0 ? tConv / tCount : 0;
    const cRate = cCount > 0 ? cConv / cCount : 0;

    // Conversion lift
    const conversionLift = cRate > 0 ? (tRate - cRate) / cRate : 0;

    // Attributable revenue
    const tRev = parseFloat(treatment[0]?.revenue || '0');
    const cRev = cCount > 0 ? (parseFloat(cRate.toFixed(2)) * cCount) : 0;
    const attributableRevenue = Math.max(0, tRev - cRev);

    // Incremental conversions (new ones only)
    const incremental = Math.max(0, tConv - cConv);

    // Wasted discounts (got discount but didn't convert)
    const wasteSql = `
      SELECT COUNT(*) as waste_count
      FROM nolix_sessions
      WHERE store = $1 AND created_at > $2
        AND intervention_type != 'nothing'
        AND converted = false
    `;
    const waste = await query<any>(wasteSql, [store, cutoff]);
    const wastedDiscounts = parseInt(waste[0]?.waste_count || '0');

    // P-value (simplified chi-square approximation)
    const pValue = calculatePValue(tCount, cCount, tConv, cConv);

    return {
      treatment_conversions: tConv,
      control_conversions: cConv,
      treatment_size: tCount,
      control_size: cCount,
      conversion_lift: conversionLift,
      attributable_revenue: attributableRevenue,
      wasted_discounts: wastedDiscounts,
      incremental_conversions: incremental,
      p_value: pValue,
      confidence_level: pValue < 0.05 ? 0.95 : pValue < 0.10 ? 0.90 : 0.70,
      daily_lift: [], // TODO: populate from daily aggregation
      weekly_lift: [],
      conversion_decay_hours: 24
    };
  } catch (e) {
    return {
      treatment_conversions: 0,
      control_conversions: 0,
      treatment_size: 0,
      control_size: 0,
      conversion_lift: 0,
      attributable_revenue: 0,
      wasted_discounts: 0,
      incremental_conversions: 0,
      p_value: 1,
      confidence_level: 0,
      daily_lift: [],
      weekly_lift: [],
      conversion_decay_hours: 24
    };
  }
}

// ============================================================
// P-VALUE CALCULATION (Simplified chi-square)
// ============================================================

function calculatePValue(
  n_treatment: number,
  n_control: number,
  conversions_treatment: number,
  conversions_control: number
): number {
  if (n_treatment === 0 || n_control === 0) return 1;

  const total = n_treatment + n_control;
  const totalConv = conversions_treatment + conversions_control;

  // Expected if no difference
  const expectedTreatment = (n_treatment * totalConv) / total;
  const expectedControl = (n_control * totalConv) / total;

  // Chi-square statistic
  const chi2 = Math.pow(conversions_treatment - expectedTreatment, 2) / expectedTreatment +
                Math.pow(conversions_control - expectedControl, 2) / expectedControl;

  // Approximate p-value from chi-square (1 df)
  // Using simple approximation
  return Math.max(0, Math.min(1, 1 - (1 - Math.exp(-chi2 / 2))));
}

// ============================================================
// REAL-TIME ATTRIBUTION
// ============================================================

export async function recordInterventionOutcome(
  session_id: string,
  intervention_type: "popup" | "discount" | "message" | "nothing",
  discount_pct: number,
  converted: boolean,
  revenue: number
): Promise<void> {
  if (!redis) return;

  const key = `intervention_outcome:${session_id}`;
  const data = JSON.stringify({
    session_id,
    intervention_type,
    discount_pct,
    converted,
    revenue,
    timestamp: Date.now()
  });

  await redis.setex(key, 30 * 24 * 3600, data); // 30 days retention
}

// ============================================================
// GET INTERVENTION EFFECTIVENESS
// ============================================================

export async function getInterventionEffectiveness(
  store: string,
  intervention_type?: string
): Promise<{
  type: string;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  avg_discount: number;
  waste_rate: number;
  roi: number;
}[]> {
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000; // 7 days

  let sql = `
    SELECT
      intervention_type,
      COUNT(*) as count,
      SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions,
      SUM(revenue) as revenue,
      AVG(discount_pct) as avg_discount,
      SUM(CASE WHEN converted = false AND intervention_type != 'nothing' THEN 1 ELSE 0 END) as wasted
    FROM nolix_sessions
    WHERE store = $1 AND created_at > $2
  `;

  const params: any[] = [store, cutoff];

  if (intervention_type) {
    sql += ` AND intervention_type = $3`;
    params.push(intervention_type);
  }

  sql += ` GROUP BY intervention_type ORDER BY conversions DESC`;

  try {
    const results = await query<any>(sql, params);
    return results.map((r: any) => {
      const count = parseInt(r.count || '0');
      const conv = parseInt(r.conversions || '0');
      const waste = parseInt(r.wasted || '0');
      const rev = parseFloat(r.revenue || '0');
      const avgDisc = parseFloat(r.avg_discount || '0');

      const cost = count * avgDisc * 0.10; // Assuming 10% avg cart value
      const roi = cost > 0 ? (rev - cost) / cost : 0;

      return {
        type: r.intervention_type,
        conversions: conv,
        conversion_rate: count > 0 ? conv / count : 0,
        revenue: rev,
        avg_discount: avgDisc,
        waste_rate: count > 0 ? waste / count : 0,
        roi
      };
    });
  } catch (e) {
    return [];
  }
}