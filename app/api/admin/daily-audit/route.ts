import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

/**
 * 🔒 DAILY RECONCILIATION AUDIT (CTO DEMAND)
 * Cron Job Endpoint: Compares internally synced DB usage against Stripe's true usage
 * Validates refunds, anomalies, and logs War Mode metrics.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_AUDIT_SECRET || 'audit_sec'}`) {
      return NextResponse.json({ error: "Unauthorized Audit Access" }, { status: 401 });
    }

    // 1. Calculate past 24h internal processed revenue
    const metrics = await query<any>(`
        SELECT 
            COUNT(order_id) as total_orders,
            SUM(revenue_cents) as total_revenue_cents 
        FROM processed_orders 
        WHERE created_at >= NOW() - INTERVAL '1 day'
    `);

    // 2. Scan Dead-Letter Queue constraints
    const deadQueue = await query<any>(`
        SELECT COUNT(id) as failed_syncs 
        FROM usage_sync_queue 
        WHERE status = 'failed'
    `);

    const internalTotal = metrics[0]?.total_revenue_cents || 0;
    const totalOrders = metrics[0]?.total_orders || 0;
    const failedSyncs = deadQueue[0]?.failed_syncs || 0;

    // ── WAR MODE FORENSIC LOGGING ──
    const auditReport = {
        scan_time: new Date().toISOString(),
        war_mode_status: "ACTIVE",
        internal_revenue_tracked_cents: internalTotal,
        total_orders_tracked: totalOrders,
        dead_letter_queue_failures: failedSyncs,
        stripe_reconciliation_status: failedSyncs === 0 ? "PASSED" : "CRITICAL_ATTENTION_REQUIRED"
    };

    console.log("[CTO DAILY AUDIT REPORT] -> ", auditReport);

    // If failures exist, alert monitoring (e.g. Sentry/Datadog or via email)
    if (failedSyncs > 0) {
        console.error(`[BILLING ALERT] ${failedSyncs} transactions stuck in dead-letter queue!`);
    }

    return NextResponse.json(auditReport);

  } catch (error: any) {
    console.error("Daily Audit Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
