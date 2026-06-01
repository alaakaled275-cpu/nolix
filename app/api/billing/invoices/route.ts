/**
 * /app/api/billing/invoices/route.ts
 * Sprint 7: Retrieve real invoices from Stripe for a store
 *
 * GET /api/billing/invoices?store=gymshark.com
 * Returns: list of paid and upcoming invoices
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" })
  : null;

export async function GET(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !stripe) {
    return NextResponse.json({
      status:   "stripe_not_configured",
      invoices: [],
      message:  "Add STRIPE_SECRET_KEY to .env to enable billing",
    });
  }

  const store = req.nextUrl.searchParams.get("store");
  if (!store) {
    return NextResponse.json({ error: "store param required" }, { status: 400 });
  }

  try {
    // Find customer by store domain
    const customers = await stripe!.customers.search({
      query: `metadata['store_domain']:'${store}'`,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        store,
        status:   "no_customer",
        invoices: [],
        message:  "No Stripe customer found for this store. Activate billing first.",
      });
    }

    const customer = customers.data[0];

    // Get paid invoices
    const paidInvoices = await stripe!.invoices.list({
      customer: customer.id,
      status:   "paid",
      limit:    12, // last 12 months
    });

    // Get upcoming invoice if subscription is active
    let upcomingInvoice = null;
    try {
      const upcoming = await (stripe! as any).invoices.createPreview({
        customer: customer.id,
      });
      upcomingInvoice = {
        status:      "upcoming",
        period_end:  new Date((upcoming.period_end || 0) * 1000).toISOString(),
        amount_due:  (upcoming.amount_due || 0) / 100,
        currency:    (upcoming.currency || "usd").toUpperCase(),
        line_items:  (upcoming.lines?.data || []).map((l: any) => ({
          description: l.description,
          amount:      (l.amount || 0) / 100,
          quantity:    l.quantity,
        })),
      };
    } catch (_e) {
      // No upcoming invoice — subscription may not be active yet
    }

    const invoices = paidInvoices.data.map((inv) => ({
      id:           inv.id,
      status:       inv.status,
      amount_paid:  inv.amount_paid / 100,
      amount_due:   inv.amount_due / 100,
      currency:     inv.currency.toUpperCase(),
      created:      new Date(inv.created * 1000).toISOString(),
      period_start: new Date((inv.period_start || 0) * 1000).toISOString(),
      period_end:   new Date((inv.period_end   || 0) * 1000).toISOString(),
      pdf_url:      inv.invoice_pdf,
      hosted_url:   inv.hosted_invoice_url,
      line_items:   inv.lines?.data?.map((l) => ({
        description: l.description,
        amount:      (l.amount || 0) / 100,
        quantity:    l.quantity,
      })) || [],
    }));

    return NextResponse.json({
      store,
      customer_id:      customer.id,
      status:           "ok",
      invoices,
      upcoming_invoice: upcomingInvoice,
      total_paid:       invoices.reduce((s, i) => s + i.amount_paid, 0),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
