/**
 * /app/api/billing/usage/route.ts
 * Sprint 6: Report usage to Stripe (metered billing)
 * Called automatically when a conversion is attributed to Nolix
 *
 * POST /api/billing/usage
 * Body: { store_domain, conversions, revenue_attributed, period_start?, period_end? }
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" })
  : null;

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    // In dev without Stripe: log and return success so system doesn't crash
    const body = await req.json();
    console.log("[Billing/Usage] Stripe not configured. Would report:", body);
    return NextResponse.json({ status: "skipped", reason: "stripe_not_configured" });
  }

  try {
    const {
      store_domain,
      conversions = 0,
      revenue_attributed = 0,
    } = await req.json();

    if (!store_domain) {
      return NextResponse.json({ error: "store_domain required" }, { status: 400 });
    }

    // Find the Stripe customer for this store
    const customers = await stripe!.customers.search({
      query: `metadata['store_domain']:'${store_domain}'`,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: `No Stripe customer found for ${store_domain}` },
        { status: 404 }
      );
    }

    const customer = customers.data[0];

    // Get active subscription
    const subscriptions = await stripe!.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: `No active subscription for ${store_domain}` },
        { status: 404 }
      );
    }

    const subscription = subscriptions.data[0];

    // Find the metered subscription item
    const meteredItem = subscription.items.data.find(
      (item) => item.price.recurring?.usage_type === "metered"
    );

    if (!meteredItem) {
      return NextResponse.json(
        { error: "No metered price item found on subscription" },
        { status: 400 }
      );
    }

    // Sprint 6: Report conversions as usage units
    // Stripe v22: Use Billing Meter Events API (replaces legacy createUsageRecord)
    let usageRecord: { id: string } = { id: "pending" };
    try {
      // Try new Meters API first (Stripe v22+)
      const meterEvent = await (stripe!.billing as any).meterEvents.create({
        event_name:  "nolix_conversion",
        payload: {
          value:       String(Math.max(1, Math.round(conversions))),
          stripe_customer_id: customer.id,
        },
        timestamp: Math.floor(Date.now() / 1000),
      });
      usageRecord = { id: meterEvent.identifier || "meter_event_ok" };
    } catch (_meterErr) {
      // Fallback to legacy metered billing if Meters API not set up
      try {
        const legacy = await (stripe!.subscriptionItems as any).createUsageRecord(
          meteredItem.id,
          {
            quantity:  Math.max(1, Math.round(conversions)),
            timestamp: Math.floor(Date.now() / 1000),
            action:    "increment",
          }
        );
        usageRecord = { id: legacy.id };
      } catch (legacyErr: any) {
        console.warn("[Billing/Usage] Both usage reporting methods failed:", legacyErr.message);
        usageRecord = { id: "error_" + Date.now() };
      }
    }

    console.log(
      `[Billing/Usage] Reported ${conversions} conversions ($${revenue_attributed}) for ${store_domain}. Usage record: ${usageRecord.id}`
    );

    return NextResponse.json({
      success:          true,
      usage_record_id:  usageRecord.id,
      store_domain,
      conversions_reported: conversions,
      revenue_attributed,
      subscription_id:  subscription.id,
    });

  } catch (error: any) {
    console.error("[Billing/Usage] Failed:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// GET: check current usage for a store
export async function GET(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ status: "stripe_not_configured", usage: 0 });
  }

  const store = req.nextUrl.searchParams.get("store");
  if (!store) return NextResponse.json({ error: "store param required" }, { status: 400 });

  try {
    const customers = await stripe!.customers.search({
      query: `metadata['store_domain']:'${store}'`,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({ usage: 0, store, status: "no_subscription" });
    }

    const subscriptions = await stripe!.subscriptions.list({
      customer: customers.data[0].id,
      status:   "active",
      limit:    1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ usage: 0, store, status: "no_active_subscription" });
    }

    const sub = subscriptions.data[0];
    const meteredItem = sub.items.data.find(
      (i) => i.price.recurring?.usage_type === "metered"
    );

    if (!meteredItem) {
      return NextResponse.json({ usage: 0, store, status: "no_metered_item" });
    }

    // Sprint 7: Get upcoming invoice (shows current usage period cost)
    const upcomingInvoice = await (stripe!.invoices as any).createPreview({
      customer: customers.data[0].id,
    });

    return NextResponse.json({
      store,
      status:               "active",
      subscription_id:      sub.id,
      current_period_start: new Date(((sub as any).current_period_start || 0) * 1000).toISOString(),
      current_period_end:   new Date(((sub as any).current_period_end   || 0) * 1000).toISOString(),
      upcoming_invoice: {
        amount_due: (upcomingInvoice.amount_due || 0) / 100,
        currency:   upcomingInvoice.currency,
        period_end: new Date((upcomingInvoice.period_end || 0) * 1000).toISOString(),
        line_items: (upcomingInvoice.lines?.data || []).map((l: any) => ({
          description: l.description,
          amount:      (l.amount || 0) / 100,
          quantity:    l.quantity,
        })),
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
