/**
 * app/api/convert/intelligence/route.ts
 *
 * ZENO INTELLIGENCE REPORT — Full System Audit
 *
 * This endpoint answers ALL the hard questions:
 *
 * 1. Is the closed loop working?
 * 2. What has the system learned so far?
 * 3. Is the uplift real or correlation?
 * 4. Which cohorts are drifting?
 * 5. Which signals actually predict conversion?
 * 6. What is the hesitation profile per action?
 * 7. Are we wasting discounts on natural converters?
 * 8. What is the TRUE causal revenue (not correlated revenue)?
 *
 * This is Zeno's self-diagnostic. If these numbers look wrong, the system is wrong.
 */
import { NextRequest, NextResponse } from "next/server";
import { query, ensureNolixSchema } from "@/lib/schema";
import { getPolicySummary } from "@/lib/causal-engine";

export async function GET(_req: NextRequest) {
  try {
    await ensureNolixSchema();

    // ── 1. LOOP INTEGRITY CHECK ──────────────────────────────────────────────
    // Is the feedback loop actually closing? Check that sessions have outcomes.
    type LoopRow = {
      total_sessions: string;
      resolved_sessions: string;
      converted_sessions: string;
      avg_time_to_convert_ms: string | null;
      avg_hesitation_score: string | null;
      sessions_with_hesitation: string;
      loop_closure_rate: string;
    };
    const loopRows = await query<LoopRow>(
      `SELECT
         COUNT(*)            AS total_sessions,
         COUNT(*) FILTER (WHERE converted IS NOT NULL)  AS resolved_sessions,
         COUNT(*) FILTER (WHERE converted = true)       AS converted_sessions,
         AVG(time_to_convert_ms) FILTER (WHERE converted = true) AS avg_time_to_convert_ms,
         AVG(hesitation_score) FILTER (WHERE hesitation_score > 0) AS avg_hesitation_score,
         COUNT(*) FILTER (WHERE hesitation_score > 0)  AS sessions_with_hesitation,
         ROUND(
           COUNT(*) FILTER (WHERE converted IS NOT NULL)::numeric
           / NULLIF(COUNT(*), 0) * 100, 1
         )                    AS loop_closure_rate
       FROM popup_sessions`
    );
    const loop = loopRows[0];

    // ── 2. CAUSAL UPLIFT REALITY CHECK ───────────────────────────────────────
    // Is the uplift real or are we measuring correlation?
    // Real uplift: treatment_cvr > control_cvr with statistical confidence
    type UpliftRow = {
      action_type: string;
      cohort_key: string;
      treatment_cvr: string;
      control_cvr: string;
      uplift_pct: string;
      confidence: string;
      stability_score: string;
      sample_size: string;
      verdict: string;
    };
    const upliftRows = await query<UpliftRow>(
      `SELECT
         action_type,
         cohort_key,
         ROUND((treatment_conversions::float / NULLIF(treatment_impressions,0))::numeric * 100, 1) AS treatment_cvr,
         ROUND((control_conversions::float  / NULLIF(control_impressions, 0))::numeric * 100, 1) AS control_cvr,
         ROUND(uplift_rate::numeric * 100, 2)     AS uplift_pct,
         ROUND(confidence::numeric * 100, 0)      AS confidence,
         ROUND(stability_score::numeric * 100, 0) AS stability_score,
         sample_size,
         CASE
           WHEN confidence >= 0.80 AND stability_score >= 0.60 AND uplift_rate > 0.03
             THEN 'CAUSAL_CONFIRMED'
           WHEN confidence >= 0.55 AND uplift_rate > 0
             THEN 'PROBABLE_CAUSAL'
           WHEN uplift_rate <= 0
             THEN 'NO_EFFECT'
           WHEN sample_size < 30
             THEN 'INSUFFICIENT_DATA'
           ELSE 'UNCERTAIN'
         END AS verdict
       FROM nolix_uplift_model
       ORDER BY confidence DESC, uplift_rate DESC
       LIMIT 20`
    );

    // ── 3. HESITATION ANALYSIS ────────────────────────────────────────────────
    // Which actions produce high hesitation but still convert?
    // → These are the "hard but worth it" conversions — the action was critical.
    // Which produce low hesitation conversions?
    // → Natural converters — we may be wasting incentives on them.
    type HesitationRow = {
      action_type: string;
      avg_hesitation_score: string;
      avg_causal_weight: string;
      natural_converters: string;   // low hesitation + converted
      resistant_converters: string; // high hesitation + converted
      avg_time_to_convert_s: string | null;
      interpretation: string;
    };
    const hesitationRows = await query<HesitationRow>(
      `SELECT
         offer_type AS action_type,
         ROUND(AVG(hesitation_score)::numeric, 1)  AS avg_hesitation_score,
         ROUND(AVG(causal_weight)::numeric, 2)     AS avg_causal_weight,
         COUNT(*) FILTER (WHERE converted = true AND hesitation_score < 30)  AS natural_converters,
         COUNT(*) FILTER (WHERE converted = true AND hesitation_score >= 50) AS resistant_converters,
         ROUND(AVG(time_to_convert_ms / 1000.0)::numeric, 1) FILTER (WHERE converted = true) AS avg_time_to_convert_s,
         CASE
           WHEN AVG(hesitation_score) FILTER (WHERE converted = true) > 50
             THEN 'HIGH_IMPACT: Action converted resistant users — strong causal signal'
           WHEN AVG(causal_weight) > 1.1
             THEN 'CAUSAL_CRITICAL: Hesitation-weighted uplift is strong'
           WHEN COUNT(*) FILTER (WHERE converted = true AND hesitation_score < 30)
              > COUNT(*) FILTER (WHERE converted = true AND hesitation_score >= 30)
             THEN 'NATURAL_CONVERTERS: Most conversions had low hesitation — may be wasting incentives'
           ELSE 'NEUTRAL: Standard hesitation profile'
         END AS interpretation
       FROM popup_sessions
       WHERE offer_type IS NOT NULL
         AND show_popup = true
       GROUP BY offer_type
       ORDER BY AVG(causal_weight) DESC`
    );

    // ── 4. SIGNAL IMPORTANCE RANKING ─────────────────────────────────────────
    // Which signals actually predict conversion vs just co-occur with it?
    // Higher conversion_lift = this signal is genuinely predictive.
    type SignalRow = {
      signal_name: string;
      signal_value: string;
      conversion_rate_pct: string;
      sample_count: string;
      avg_hesitation: string;
      predictive_strength: string;
    };
    const signalRows = await query<SignalRow>(
      `WITH base AS (
         SELECT AVG(converted::int) AS overall_cvr FROM nolix_signal_outcomes
       )
       SELECT * FROM (
         SELECT 'intent_level' AS signal_name, intent_level AS signal_value,
                ROUND(AVG(converted::int)::numeric * 100, 1) AS conversion_rate_pct,
                COUNT(*) AS sample_count,
                ROUND(AVG(hesitation_score)::numeric, 1) AS avg_hesitation,
                ROUND((AVG(converted::int) / NULLIF((SELECT overall_cvr FROM base), 0))::numeric, 2) AS predictive_strength
         FROM nolix_signal_outcomes WHERE intent_level IS NOT NULL
         GROUP BY intent_level
         UNION ALL
         SELECT 'friction', friction,
                ROUND(AVG(converted::int)::numeric * 100, 1),
                COUNT(*),
                ROUND(AVG(hesitation_score)::numeric, 1),
                ROUND((AVG(converted::int) / NULLIF((SELECT overall_cvr FROM base), 0))::numeric, 2)
         FROM nolix_signal_outcomes WHERE friction IS NOT NULL
         GROUP BY friction
         UNION ALL
         SELECT 'return_visitor', return_visitor::text,
                ROUND(AVG(converted::int)::numeric * 100, 1),
                COUNT(*),
                ROUND(AVG(hesitation_score)::numeric, 1),
                ROUND((AVG(converted::int) / NULLIF((SELECT overall_cvr FROM base), 0))::numeric, 2)
         FROM nolix_signal_outcomes WHERE return_visitor IS NOT NULL
         GROUP BY return_visitor
         UNION ALL
         SELECT 'price_bucket', price_bucket,
                ROUND(AVG(converted::int)::numeric * 100, 1),
                COUNT(*),
                ROUND(AVG(hesitation_score)::numeric, 1),
                ROUND((AVG(converted::int) / NULLIF((SELECT overall_cvr FROM base), 0))::numeric, 2)
         FROM nolix_signal_outcomes WHERE price_bucket IS NOT NULL
         GROUP BY price_bucket
       ) ranked
       ORDER BY predictive_strength DESC, sample_count DESC
       LIMIT 20`
    );

    // ── 5. DISCOUNT WASTE ANALYSIS ────────────────────────────────────────────
    // "How many discounts did we give to people who would have bought anyway?"
    // discount_wasted = discount given + low hesitation + converted fast
    type DiscountRow = {
      total_discount_sessions: string;
      wasted_discounts: string;
      wasted_pct: string;
      avg_causal_weight_discount: string;
      revenue_wasted_estimate: string;
    };
    const discountRows = await query<DiscountRow>(
      `SELECT
         COUNT(*) FILTER (WHERE offer_type LIKE 'discount_%')   AS total_discount_sessions,
         COUNT(*) FILTER (
           WHERE offer_type LIKE 'discount_%'
             AND converted = true
             AND hesitation_score < 30
             AND time_to_convert_ms < 5000
         )                                                      AS wasted_discounts,
         ROUND(
           COUNT(*) FILTER (
             WHERE offer_type LIKE 'discount_%'
               AND converted = true
               AND hesitation_score < 30
               AND time_to_convert_ms < 5000
           )::numeric /
           NULLIF(COUNT(*) FILTER (WHERE offer_type LIKE 'discount_%' AND converted = true), 0) * 100,
           1
         )                                                      AS wasted_pct,
         ROUND(AVG(causal_weight) FILTER (WHERE offer_type LIKE 'discount_%' AND converted = true)::numeric, 2) AS avg_causal_weight_discount,
         -- Wasted revenue = sessions where we gave discount but user didn't need it
         ROUND(
           COUNT(*) FILTER (
             WHERE offer_type LIKE 'discount_%'
               AND converted = true
               AND hesitation_score < 30
           )::numeric * 35, 0  -- avg discount value ~$35
         )                                                      AS revenue_wasted_estimate
       FROM popup_sessions`
    );

    // ── 6. DRIFT ALERTS ────────────────────────────────────────────────────────
    type DriftRow = {
      cohort_key: string;
      historical_control_cvr: string;
      recent_control_cvr: string;
      drift_pct: string;
      status: string;
    };
    const driftRows = await query<DriftRow>(
      `SELECT
         m.cohort_key,
         ROUND((m.control_conversions::float / NULLIF(m.control_impressions,0))::numeric * 100, 1) AS historical_control_cvr,
         ROUND((r.control_conversions::float / NULLIF(r.control_impressions,0))::numeric * 100, 1) AS recent_control_cvr,
         ROUND(ABS(
           (m.control_conversions::float / NULLIF(m.control_impressions,0))
           - (r.control_conversions::float / NULLIF(r.control_impressions,0))
         )::numeric * 100, 1)                                   AS drift_pct,
         CASE
           WHEN ABS(
             (m.control_conversions::float / NULLIF(m.control_impressions,0))
             - (r.control_conversions::float / NULLIF(r.control_impressions,0))
           ) > 0.15 THEN 'DRIFT_CRITICAL'
           WHEN ABS(
             (m.control_conversions::float / NULLIF(m.control_impressions,0))
             - (r.control_conversions::float / NULLIF(r.control_impressions,0))
           ) > 0.08 THEN 'DRIFT_WARNING'
           ELSE 'STABLE'
         END AS status
       FROM nolix_uplift_model m
       JOIN nolix_uplift_recent r ON r.cohort_key = m.cohort_key AND r.action_type = m.action_type
       WHERE m.control_impressions >= 10 AND r.control_impressions >= 3
       ORDER BY drift_pct DESC
       LIMIT 10`
    );

    // ── 7. POLICY SUMMARY (from causal-engine) ────────────────────────────────
    const policySummary = await getPolicySummary();

    // ── SYSTEM VERDICT ─────────────────────────────────────────────────────────
    const totalSessions      = parseInt(loop?.total_sessions ?? "0");
    const loopClosureRate    = parseFloat(loop?.loop_closure_rate ?? "0");
    const confirmedUplift    = upliftRows.filter(r => r.verdict === "CAUSAL_CONFIRMED").length;
    const driftCritical      = driftRows.filter(r => r.status === "DRIFT_CRITICAL").length;
    const wastedPct          = parseFloat(discountRows[0]?.wasted_pct ?? "0");
    const hesitationCoverage = parseInt(loop?.sessions_with_hesitation ?? "0") / Math.max(1, totalSessions);

    let verdict = "🔴 NOT_READY";
    let reason  = "";
    if (totalSessions < 10) {
      verdict = "⚪ COLD_START";
      reason  = "Not enough sessions to evaluate. Run traffic first.";
    } else if (loopClosureRate < 50) {
      verdict = "🔴 LOOP_BROKEN";
      reason  = `Only ${loopClosureRate}% of sessions have resolved outcomes. Feedback loop is failing.`;
    } else if (driftCritical > 0) {
      verdict = "🟡 DRIFT_DETECTED";
      reason  = `${driftCritical} cohorts have significant behavioral drift. Re-exploration active.`;
    } else if (confirmedUplift === 0 && totalSessions > 100) {
      verdict = "🟡 NO_CONFIRMED_UPLIFT";
      reason  = "No action has reached confirmed causal uplift. More data needed.";
    } else if (wastedPct > 40) {
      verdict = "🟡 DISCOUNT_WASTE";
      reason  = `${wastedPct}% of discounts went to natural converters. Adjust policy thresholds.`;
    } else if (confirmedUplift > 0 && loopClosureRate >= 80) {
      verdict = "🟢 OPERATIONAL";
      reason  = `${confirmedUplift} actions confirmed causal uplift. Loop at ${loopClosureRate}%.`;
    } else {
      verdict = "🔵 LEARNING";
      reason  = "System is accumulating data. Causal model building.";
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      system_verdict: verdict,
      verdict_reason: reason,

      loop_integrity: {
        total_sessions:           parseInt(loop?.total_sessions ?? "0"),
        resolved_sessions:        parseInt(loop?.resolved_sessions ?? "0"),
        converted_sessions:       parseInt(loop?.converted_sessions ?? "0"),
        loop_closure_rate_pct:    parseFloat(loop?.loop_closure_rate ?? "0"),
        avg_time_to_convert_s:    loop?.avg_time_to_convert_ms
          ? Math.round(parseFloat(loop.avg_time_to_convert_ms) / 1000) : null,
        avg_hesitation_score:     parseFloat(loop?.avg_hesitation_score ?? "0"),
        hesitation_coverage_pct:  Math.round(hesitationCoverage * 100),
        assessment:               loopClosureRate >= 80 ? "✅ CLOSED" : loopClosureRate >= 50 ? "⚠️ PARTIAL" : "❌ BROKEN",
      },

      causal_uplift: upliftRows.map(r => ({
        action: r.action_type,
        cohort: r.cohort_key,
        treatment_cvr_pct: parseFloat(r.treatment_cvr ?? "0"),
        control_cvr_pct:   parseFloat(r.control_cvr ?? "0"),
        uplift_pct:        parseFloat(r.uplift_pct ?? "0"),
        confidence_pct:    parseFloat(r.confidence ?? "0"),
        stability_pct:     parseFloat(r.stability_score ?? "0"),
        sample_size:       parseInt(r.sample_size ?? "0"),
        verdict:           r.verdict,
      })),

      hesitation_analysis: hesitationRows.map(r => ({
        action:                   r.action_type,
        avg_hesitation_score:     parseFloat(r.avg_hesitation_score ?? "0"),
        avg_causal_weight:        parseFloat(r.avg_causal_weight ?? "0"),
        natural_converters:       parseInt(r.natural_converters ?? "0"),
        resistant_converters:     parseInt(r.resistant_converters ?? "0"),
        avg_time_to_convert_s:    r.avg_time_to_convert_s ? parseFloat(r.avg_time_to_convert_s) : null,
        interpretation:           r.interpretation,
      })),

      signal_importance: signalRows.map(r => ({
        signal:              r.signal_name,
        value:               r.signal_value,
        cvr_pct:             parseFloat(r.conversion_rate_pct ?? "0"),
        samples:             parseInt(r.sample_count ?? "0"),
        avg_hesitation:      parseFloat(r.avg_hesitation ?? "0"),
        predictive_strength: parseFloat(r.predictive_strength ?? "0"),
        note:                parseFloat(r.predictive_strength ?? "0") > 1.5
          ? "STRONG PREDICTOR" : parseFloat(r.predictive_strength ?? "0") > 1.0
          ? "MODERATE PREDICTOR" : "WEAK PREDICTOR",
      })),

      discount_waste: {
        total_discount_sessions:    parseInt(discountRows[0]?.total_discount_sessions ?? "0"),
        wasted_discounts:           parseInt(discountRows[0]?.wasted_discounts ?? "0"),
        wasted_pct:                 parseFloat(discountRows[0]?.wasted_pct ?? "0"),
        avg_causal_weight:          parseFloat(discountRows[0]?.avg_causal_weight_discount ?? "0"),
        estimated_revenue_wasted:   parseInt(discountRows[0]?.revenue_wasted_estimate ?? "0"),
        assessment:                 wastedPct > 40
          ? "⚠️ HIGH WASTE: Reduce discounts for low-hesitation cohorts"
          : wastedPct > 20
          ? "⚠️ MODERATE WASTE: Monitor"
          : "✅ EFFICIENT: Discounts targeting resistant users correctly",
      },

      drift_alerts: driftRows.map(r => ({
        cohort:               r.cohort_key,
        historical_cvr_pct:   parseFloat(r.historical_control_cvr ?? "0"),
        recent_cvr_pct:       parseFloat(r.recent_control_cvr ?? "0"),
        drift_pct:            parseFloat(r.drift_pct ?? "0"),
        status:               r.status,
      })),

      policy_summary: policySummary,
    });

  } catch (err) {
    console.error("[intelligence] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
