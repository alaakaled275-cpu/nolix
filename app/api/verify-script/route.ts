/**
 * NOLIX — Script Validation Gate (STEP 11.1 PART 8)
 * GET /api/verify-script
 *
 * Verifies that the NOLIX script is active on a store:
 * - Last event received within 24h
 * - Embedding system functional
 * - Model loaded and AI enabled
 * - Dashboard access guard
 *
 * If NOLIX is not active → dashboard returns ACCESS DENIED.
 * Prevents showing fake "AI is working" metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { getModelState, isLoaded, loadModelFromDB } from "@/lib/nolix-ml-engine";
import { startQueueWorker } from "@/lib/nolix-queue";
import { query } from "@/lib/db";

startQueueWorker();

export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store") || null;

  try {
    if (!isLoaded()) { await loadModelFromDB(); }
    const model = getModelState();

    // 1. Check last event received from this store
    const eventParams  = store ? [store]   : [];
    const eventWhere   = store ? "AND store=$1" : "";
    const lastEventRow = await query<any>(
      `SELECT MAX(created_at) as last_event, COUNT(*) as total_events
       FROM nolix_events WHERE created_at > NOW() - INTERVAL '24 hours' ${eventWhere}`,
      eventParams
    ).catch(() => []);

    const lastEvent    = (lastEventRow as any[])[0];
    const lastEventAt  = lastEvent?.last_event  || null;
    const eventCount24h = Number(lastEvent?.total_events) || 0;
    const scriptActive = eventCount24h > 0;

    // 2. Check embedding health
    const embeddingRow = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_embeddings ${store ? "WHERE store=$1" : ""}`,
      store ? [store] : []
    ).catch(() => [{ cnt: 0 }]);
    const embeddingCount = Number((embeddingRow as any[])[0]?.cnt) || 0;
    const embeddingActive = embeddingCount > 0;

    // 3. Model health
    const modelHealthy   = model.ai_enabled && !model.drift_detected;
    const modelVersion   = model.version;

    // 4. Training activity (last 24h)
    const trainingRow  = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_training_logs
       WHERE logged_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => [{ cnt: 0 }]);
    const recentTraining = Number((trainingRow as any[])[0]?.cnt) || 0;

    // 5. Coupon registry health
    const couponRow = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_coupon_registry ${store ? "WHERE store=$1" : ""}`,
      store ? [store] : []
    ).catch(() => [{ cnt: 0 }]);
    const couponsIssued = Number((couponRow as any[])[0]?.cnt) || 0;

    // 6. ACCESS GATE: dashboard access denied if script not active
    const dashboardAccess = scriptActive;

    const result = {
      script_active:     scriptActive,
      dashboard_access:  dashboardAccess,
      store:             store || "all",
      events_last_24h:   eventCount24h,
      last_event_at:     lastEventAt,
      embedding_active:  embeddingActive,
      embedding_count:   embeddingCount,
      model: {
        loaded:          isLoaded(),
        version:         modelVersion,
        ai_enabled:      model.ai_enabled,
        drift_detected:  model.drift_detected,
        allow_sync:      model.allow_sync,
        auc:             model.last_auc,
        last_accuracy:   model.last_accuracy,
        healthy:         modelHealthy
      },
      training_runs_24h: recentTraining,
      coupons_issued:    couponsIssued,
      denial_reason:     !scriptActive
        ? `No events received in last 24h for store: ${store || "any"}. Install NOLIX script.`
        : null,
      verified_at:       new Date().toISOString()
    };

    if (!dashboardAccess) {
      return NextResponse.json({ ...result, ACCESS: "DENIED" }, { status: 403 });
    }

    return NextResponse.json({ ...result, ACCESS: "GRANTED" });

  } catch(err: any) {
    return NextResponse.json({ error: "Verification failed", detail: err.message }, { status: 500 });
  }
}
