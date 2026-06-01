/**
 * /app/api/billing/create-checkout/route.ts
 * Sprint 8: Create Stripe Checkout Session for store owner subscription
 *
 * POST /api/billing/create-checkout
 * Body: { store_domain: string, store_email: string, plan: "starter"|"growth"|"scale" }
 * Returns: { url: string } — Stripe Checkout URL to redirect the store owner to
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" })
  : null;

// Pricing Plans (usage-based via Stripe Metered Billing)
const PLANS: Record<string, { priceId: string; name: string }> = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER || "price_starter_placeholder",
    name: "Nolix Starter",
  },
  growth: {
    priceId: process.env.STRIPE_PRICE_GROWTH || "price_growth_placeholder",
    name: "Nolix Growth",
  },
  scale: {
    priceId: process.env.STRIPE_PRICE_SCALE || "price_scale_placeholder",
    name: "Nolix Scale",
  },
};

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !stripe) {
    return NextResponse.json(
      { error: "Stripe not configured. Add STRIPE_SECRET_KEY to .env" },
      { status: 503 }
    );
  }

  try {
    const { store_domain, store_email, plan = "starter" } = await req.json();

    if (!store_domain || !store_email) {
      return NextResponse.json(
        { error: "store_domain and store_email required" },
        { status: 400 }
      );
    }

    const planConfig = PLANS[plan] || PLANS.starter;
    const baseUrl = process.env.NOLIX_API_BASE || "http://localhost:3002";

    // Create or retrieve Stripe customer
    const existingCustomers = await stripe.customers.list({
      email: store_email,
      limit: 1,
    });

    let customer: Stripe.Customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update metadata if missing
      if (!customer.metadata?.store_domain) {
        await stripe.customers.update(customer.id, {
          metadata: { store_domain },
        });
      }
    } else {
      customer = await stripe.customers.create({
        email: store_email,
        metadata: { store_domain },
        description: `Nolix store: ${store_domain}`,
      });
    }

    // Sprint 8: Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        store_domain,
        plan,
      },
      subscription_data: {
        metadata: {
          store_domain,
          plan,
        },
      },
      success_url: `${baseUrl}/dashboard?billing=success&store=${encodeURIComponent(store_domain)}`,
      cancel_url:  `${baseUrl}/dashboard?billing=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({
      url:         session.url,
      session_id:  session.id,
      customer_id: customer.id,
    });

  } catch (error: any) {
    console.error("[Billing] Checkout creation failed:", error.message);
    return NextResponse.json(
      { error: error.message || "Checkout creation failed" },
      { status: 500 }
    );
  }
}
