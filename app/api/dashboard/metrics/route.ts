/**
 * NOLIX — Dashboard Metrics API (STEP 12 PART 3)
 * GET /api/dashboard/metrics
 *
 * Returns real aggregated system metrics for the dashboard:
 * - AUC, model health, drift status
 * - Conversion rate (ML group, last 24h)
 * - A/B uplift (ML vs control)
 * - Active users (last 30 min)
 * - Revenue (ML group vs control, last 7 days)
 * - Health score
 */

import { NextRequest, NextResponse } from "next/server";
import { getModelState } from "@/lib/nolix-ml-engine";
import { computeSystemHealth } from "@/lib/nolix-health-engine";
import { getABResults } from "@/lib/nolix-ab-engine";
import { getFlags, loadRuntimeFlags } from "@/lib/nolix-runtime";
import { applyAPIGuard } from "@/lib/nolix-api-guard";
import { guardRoute } from "@/lib/nolix-license";
import { startQueueWorker } from "@/lib/nolix-queue";
import { query } from "@/lib/db";

startQueueWorker();

export async function GET(req: NextRequest) {
  // Rate limit check
  const guard = await applyAPIGuard(req, undefined, { skipSignature: true });
  if (!guard.passed) return guard.response;

  // License check
  const licGuard = await guardRoute(req);
  if (!licGuard.valid) return licGuard.response;

  const store = req.nextUrl.searchParams.get("store") || undefined;
  await loadRuntimeFlags();

  try {
    const model = getModelState();

    // 1. Health Score (computed live)
    const health = await computeSystemHealth();

    // 2. A/B Results
    const ab = await getABResults(store);

    // 3. Active users (last 30 min)
    const activeRows = await query<any>(
      `SELECT COUNT(DISTINCT visitor_id) as cnt FROM nolix_events
       WHERE created_at > NOW() - INTERVAL '30 minutes'
       ${store ? "AND store=$1" : ""}`,
      store ? [store] : []
    ).catch(() => [{ cnt: 0 }]);
    const activeUsers = Number((activeRows as any[])[0]?.cnt) || 0;

    // 4. Total events today
    const eventsRows = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
       ${store ? "AND store=$1" : ""}`,
      store ? [store] : []
    ).catch(() => [{ cnt: 0 }]);
    const eventsToday = Number((eventsRows as any[])[0]?.cnt) || 0;

    // 5. Coupons issued today
    const couponRows = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_coupon_registry
       WHERE issued_at > NOW() - INTERVAL '24 hours'
       ${store ? "AND store=$1" : ""}`,
      store ? [store] : []
    ).catch(() => [{ cnt: 0 }]);
    const couponsToday = Number((couponRows as any[])[0]?.cnt) || 0;

    // 6. Revenue last 7 days (total + ML uplift)
    const revRows = await query<any>(`
      SELECT
        COALESCE(SUM(c.order_value::NUMERIC), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN c.ab_group='ml'      THEN c.order_value::NUMERIC ELSE 0 END), 0) AS ml_revenue,
        COALESCE(SUM(CASE WHEN c.ab_group='control' THEN c.order_value::NUMERIC ELSE 0 END), 0) AS control_revenue,
        COUNT(DISTINCT c.order_id)                 AS total_orders,
        COUNT(DISTINCT CASE WHEN c.ab_group='ml'      THEN c.order_id END) AS ml_orders,
        COUNT(DISTINCT CASE WHEN c.ab_group='control' THEN c.order_id END) AS control_orders
      FROM nolix_ab_conversions c
      WHERE c.converted_at > NOW() - INTERVAL '7 days'
    `).catch(() => [{ total_revenue: 0, ml_revenue: 0, control_revenue: 0, total_orders: 0 }]);
    const rev = (revRows as any[])[0] || {};

    // 7. Last training run
    const lastTrain = await query<any>(
      `SELECT logged_at, model_version, auc, train_loss, val_loss, drift_detected
       FROM nolix_training_logs ORDER BY logged_at DESC LIMIT 1`
    ).catch(() => []);

    // 8. Model version history (last 5)
    const modelHistory = await query<any>(
      `SELECT model_id, version, metrics, drift_detected, ai_enabled, created_at
       FROM nolix_models ORDER BY created_at DESC LIMIT 5`
    ).catch(() => []);

    const runtimeFlags = getFlags();

    return NextResponse.json({
      // Model Health
      model: {
        auc:            model.last_auc,
        val_loss:       model.last_val_loss,
        train_loss:     model.last_loss,
        accuracy:       model.last_accuracy,
        precision:      model.last_precision,
        recall:         model.last_recall,
        f1:             model.last_f1,
        drift:          model.drift_detected,
        drift_score:    model.drift_score,
        version:        model.version,
        model_id:       model.model_id,
        ai_enabled:     model.ai_enabled,
        allow_sync:     model.allow_sync,
        online_trained: model.online_trained,
        batch_trained:  model.batch_trained
      },

      // System Health
      health: {
        score:  health.score,
        status: health.status,
        issues: health.issues
      },

      // A/B Testing
      ab_test: {
        ml_sessions:       ab.ml.sessions,
        ml_conversions:    ab.ml.conversions,
        ml_revenue:        ab.ml.revenue,
        ml_rate:           ab.ml.rate,
        ml_ci:             ab.ml.ci,
        control_sessions:  ab.control.sessions,
        control_revenue:   ab.control.revenue,
        control_rate:      ab.control.rate,
        lift:              ab.lift,
        revenue_lift:      ab.revenue_lift,
        significant:       ab.significant,
        p_value:           ab.p_value,
        chi_squared:       ab.chi_squared,
        interpretation:    ab.interpretation
      },

      // Revenue Summary (7 days)
      revenue_7d: {
        total:          Math.round(Number(rev.total_revenue)   * 100) / 100,
        ml_group:       Math.round(Number(rev.ml_revenue)      * 100) / 100,
        control_group:  Math.round(Number(rev.control_revenue) * 100) / 100,
        total_orders:   Number(rev.total_orders)  || 0,
        ml_orders:      Number(rev.ml_orders)     || 0,
        control_orders: Number(rev.control_orders)|| 0
      },

      // Activity
      activity: {
        active_users_30m: activeUsers,
        events_24h:       eventsToday,
        coupons_24h:      couponsToday
      },

      // Training History
      training: {
        last_run:    (lastTrain as any[])[0] || null,
        model_history: modelHistory
      },

      // Runtime Flags
      runtime: runtimeFlags,

      generated_at: new Date().toISOString(),
      store:        store || "all"
    });

  } catch(err: any) {
    console.error("❌ DASHBOARD METRICS ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
