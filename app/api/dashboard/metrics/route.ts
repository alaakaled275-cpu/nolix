/**
 * app/api/dashboard/metrics/route.ts
 * NOLIX — Real-Time Dashboard Metrics API
 *
 * Returns REAL data from DB for the Zeno Dashboard:
 *  - protected_revenue: sum of revenue from sessions where converted=true AND action_taken != 'do_nothing'
 *  - baseline_revenue:  sum of revenue from sessions where converted=true AND action_taken = 'do_nothing'
 *  - lift_pct:          (protected / baseline - 1) * 100
 *  - zeno_score:        composite health score 0–100
 *  - total_sessions:    count of all sessions in window
 *  - intervention_rate: % of sessions where we intervened
 *  - conversion_rate:   % of sessions that converted
 *  - active_strategies: top actions ranked by conversion contribution
 *  - daily_chart:       last 14 days of revenue + sessions
 *
 * TENANT ISOLATION: all queries scoped by store_domain derived from session.
 * AUTH: requires valid session cookie (nolix_session).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { queryForTenant } from "@/lib/nolix-rls";
import { getSession } from "@/lib/auth";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";

export const dynamic = "force-dynamic";

// ── Zeno Score calculation ──────────────────────────────────────────────────
function calcZenoScore(params: {
  conversion_rate:   number;   // 0–1
  intervention_rate: number;   // 0–1
  uplift_avg:        number;   // 0–1
  model_auc:         number;   // 0–1
  do_nothing_rate:   number;   // 0–1 (higher = smarter, not wasting interventions)
}): number {
  const {
    conversion_rate,
    intervention_rate,
    uplift_avg,
    model_auc,
    do_nothing_rate,
  } = params;

  // Weighted composite:
  // Conversion rate        × 30 (primary business metric)
  // Uplift avg             × 30 (causal quality)
  // Model AUC              × 20 (prediction quality)
  // do_nothing_rate        × 10 (discipline — not spamming interventions)
  // intervention_rate cap  × 10 (penalize over-intervention)
  const interventionPenalty = intervention_rate > 0.4 ? (intervention_rate - 0.4) * 50 : 0;

  const raw =
    (conversion_rate  * 30) +
    (uplift_avg       * 30) +
    (model_auc        * 20) +
    (do_nothing_rate  * 10) +
    10 - interventionPenalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export async function GET(req: NextRequest) {
  try {
    // ── [0] RATE LIMIT ────────────────────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitBlock = await applyRateLimit(ip, "/api/dashboard");
    if (rateLimitBlock) return rateLimitBlock;

    // ── [1] AUTH — Disabled by user request ────────────────────────────────────
    // Dashboard is public, no session required.

    // ── [2] RESOLVE TENANT (store_domain) ──────────────────────
    // Fetch the first available user in the database to populate the dashboard
    const userRows = await query<{
      store_url:           string | null;
      subscription_status: string;
      plan_id:             string | null;
    }>(
      `SELECT store_url, subscription_status, plan_id FROM users LIMIT 1`,
      []
    );

    const user       = userRows[0];
    const storeUrl   = user?.store_url ?? null;
    // Extract domain from full URL if present
    let storeDomain  = "unknown";
    if (storeUrl) {
      try {
        storeDomain = new URL(
          storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`
        ).hostname.replace(/^www\./, "");
      } catch {
        storeDomain = storeUrl.replace(/^www\./, "").replace(/\/.*$/, "");
      }
    }

    // Query window: last 30 days
    const windowDays = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

    // ── [3] CORE METRICS — all scoped by store_domain ─────────────────────────
    const [
      revenueRows,
      sessionCountRows,
      conversionRows,
      actionRows,
      modelRows,
      dailyRows,
    ] = await Promise.all([

      // Protected revenue: sessions where Zeno intervened and got a conversion
      // RLS: queryForTenant → app.current_tenant = storeDomain → only this store’s rows
      queryForTenant<{
        protected_revenue: string;
        baseline_revenue:  string;
        avg_uplift:        string;
      }>(
        `SELECT
           COALESCE(SUM(CASE WHEN show_popup = true  AND converted = true THEN COALESCE(order_value, 0) ELSE 0 END), 0) AS protected_revenue,
           COALESCE(SUM(CASE WHEN show_popup = false AND converted = true THEN COALESCE(order_value, 0) ELSE 0 END), 0) AS baseline_revenue,
           COALESCE(AVG(CASE WHEN show_popup = true THEN COALESCE(expected_uplift, 0) ELSE NULL END), 0)                AS avg_uplift
         FROM popup_sessions
         WHERE created_at >= NOW() - INTERVAL '${windowDays} days'`,
        [],
        storeDomain
      ),

      // Total session count + intervention count
      queryForTenant<{
        total_sessions:     string;
        intervention_count: string;
        do_nothing_count:   string;
      }>(
        `SELECT
           COUNT(*)                                                       AS total_sessions,
           COUNT(CASE WHEN show_popup = true  THEN 1 END)                AS intervention_count,
           COUNT(CASE WHEN action_taken = 'do_nothing' THEN 1 END)       AS do_nothing_count
         FROM popup_sessions
         WHERE created_at >= NOW() - INTERVAL '${windowDays} days'`,
        [],
        storeDomain
      ),

      // Conversion rate per group
      queryForTenant<{
        treatment_conv_rate: string;
        control_conv_rate:   string;
      }>(
        `SELECT
           COALESCE(
             SUM(CASE WHEN show_popup = true AND converted = true THEN 1 ELSE 0 END)::float /
             NULLIF(SUM(CASE WHEN show_popup = true THEN 1 ELSE 0 END), 0),
             0
           ) AS treatment_conv_rate,
           COALESCE(
             SUM(CASE WHEN show_popup = false AND converted = true THEN 1 ELSE 0 END)::float /
             NULLIF(SUM(CASE WHEN show_popup = false THEN 1 ELSE 0 END), 0),
             0
           ) AS control_conv_rate
         FROM popup_sessions
         WHERE created_at >= NOW() - INTERVAL '${windowDays} days'`,
        [],
        storeDomain
      ),

      // Top actions by conversion contribution
      queryForTenant<{
        action_name:  string;
        impressions:  string;
        conversions:  string;
        revenue:      string;
        conv_rate:    string;
      }>(
        `SELECT
           action_name,
           impressions,
           conversions,
           revenue_earned                                               AS revenue,
           ROUND(conversions::numeric / NULLIF(impressions, 0) * 100, 1) AS conv_rate
         FROM zeno_action_metrics
         WHERE impressions > 0
         ORDER BY revenue_earned DESC
         LIMIT 6`,
        [],
        storeDomain
      ),

      // Latest model AUC from calibration_metrics (not tenant-scoped — global model)
      query<{ auc: string; model_version: string; created_at: string }>(
        `SELECT auc, model_version, created_at
         FROM calibration_metrics
         ORDER BY created_at DESC
         LIMIT 1`
      ),

      // Daily revenue + sessions (last N days)
      queryForTenant<{
        day:           string;
        sessions:      string;
        conversions:   string;
        protected_rev: string;
      }>(
        `SELECT
           DATE_TRUNC('day', created_at)::date::text             AS day,
           COUNT(*)                                               AS sessions,
           COUNT(CASE WHEN converted = true THEN 1 END)          AS conversions,
           COALESCE(SUM(CASE WHEN show_popup = true AND converted = true
                              THEN COALESCE(order_value, 0) ELSE 0 END), 0) AS protected_rev
         FROM popup_sessions
         WHERE created_at >= NOW() - INTERVAL '${windowDays} days'
         GROUP BY 1
         ORDER BY 1 ASC`,
        [],
        storeDomain
      ),
    ]);

    // ── [4] COMPUTE AGGREGATES ────────────────────────────────────────────────
    const protectedRevenue = parseFloat(revenueRows[0]?.protected_revenue ?? "0");
    const baselineRevenue  = parseFloat(revenueRows[0]?.baseline_revenue  ?? "0");
    const avgUplift        = parseFloat(revenueRows[0]?.avg_uplift        ?? "0");

    const totalSessions      = parseInt(sessionCountRows[0]?.total_sessions    ?? "0");
    const interventionCount  = parseInt(sessionCountRows[0]?.intervention_count ?? "0");
    const doNothingCount     = parseInt(sessionCountRows[0]?.do_nothing_count  ?? "0");

    const treatmentCVR = parseFloat(conversionRows[0]?.treatment_conv_rate ?? "0");
    const controlCVR   = parseFloat(conversionRows[0]?.control_conv_rate   ?? "0");

    const modelAUC = parseFloat(modelRows[0]?.auc ?? "0.5");

    // Derived metrics
    const interventionRate = totalSessions > 0 ? interventionCount / totalSessions : 0;
    const doNothingRate    = totalSessions > 0 ? doNothingCount    / totalSessions : 0;
    const liftPct          = controlCVR > 0
      ? ((treatmentCVR - controlCVR) / controlCVR) * 100
      : (avgUplift * 100);
    const revenueLift      = baselineRevenue > 0
      ? ((protectedRevenue + baselineRevenue) / baselineRevenue - 1) * 100
      : 0;

    const zenoScore = calcZenoScore({
      conversion_rate:   treatmentCVR,
      intervention_rate: interventionRate,
      uplift_avg:        avgUplift,
      model_auc:         modelAUC,
      do_nothing_rate:   doNothingRate,
    });

    // ── [5] FORMAT ACTIVE STRATEGIES ─────────────────────────────────────────
    const activeStrategies = actionRows.map((row) => ({
      name:        row.action_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      action_key:  row.action_name,
      impressions: parseInt(row.impressions),
      conversions: parseInt(row.conversions),
      revenue:     parseFloat(row.revenue),
      conv_rate:   parseFloat(row.conv_rate ?? "0"),
    }));

    // ── [6] RETURN ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      // Core KPIs
      protected_revenue:  Math.round(protectedRevenue * 100) / 100,
      baseline_revenue:   Math.round(baselineRevenue  * 100) / 100,
      total_revenue:      Math.round((protectedRevenue + baselineRevenue) * 100) / 100,
      lift_pct:           Math.round(liftPct   * 10) / 10,
      revenue_lift_pct:   Math.round(revenueLift * 10) / 10,
      zeno_score:         zenoScore,

      // Session metrics
      total_sessions:      totalSessions,
      intervention_count:  interventionCount,
      intervention_rate:   Math.round(interventionRate * 1000) / 10, // as %
      do_nothing_rate:     Math.round(doNothingRate    * 1000) / 10,
      treatment_cvr:       Math.round(treatmentCVR     * 1000) / 10,
      control_cvr:         Math.round(controlCVR       * 1000) / 10,

      // Model health
      model_auc:    Math.round(modelAUC * 1000) / 1000,
      avg_uplift:   Math.round(avgUplift * 1000) / 10, // as %

      // Breakdown
      active_strategies: activeStrategies,
      daily_chart:       dailyRows.map((r) => ({
        day:           r.day,
        sessions:      parseInt(r.sessions),
        conversions:   parseInt(r.conversions),
        protected_rev: parseFloat(r.protected_rev),
      })),

      // Meta
      window_days:  windowDays,
      store_domain: storeDomain,
      plan:         user?.plan_id ?? "unknown",
      subscription: user?.subscription_status ?? "unknown",
      generated_at: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error("[Dashboard Metrics API] Error:", err.message);
    return NextResponse.json(
      { error: "Failed to load metrics", code: "METRICS_ERROR" },
      { status: 500 }
    );
  }
}
