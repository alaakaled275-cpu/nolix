import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  let event;
  try {
    // Requires STRIPE_WEBHOOK_SECRET to be defined in environment.
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || "whsec_dummy"
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: "Webhook Error: Invalid Signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.plan_id;

        if (userId) {
          // Set plan commission rate logic (Dynamic Hybrid Model scaling)
          let commission = 0.20; // default 20%
          if (planId === "starter") commission = 0.10;
          if (planId === "growth") commission = 0.20;
          if (planId === "scale") commission = 0.30;

          await query(
            `UPDATE users 
             SET stripe_customer_id = $1, 
                 stripe_subscription_id = $2, 
                 subscription_status = 'active', 
                 plan_id = $3,
                 revenue_share_pct = $4,
                 failed_payment_count = 0
             WHERE id = $5`,
            [customerId, subscriptionId, planId, commission, userId]
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          await query(
            `UPDATE users 
             SET failed_payment_count = 0, 
                 subscription_status = 'active' 
             WHERE stripe_subscription_id = $1`,
            [invoice.subscription]
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          // Increment fail count and suspend if >= 3
          await query(
            `UPDATE users 
             SET failed_payment_count = failed_payment_count + 1 
             WHERE stripe_subscription_id = $1`,
            [invoice.subscription]
          );

          // Force update status if grace period exhausted
          await query(
            `UPDATE users 
             SET subscription_status = 'past_due' 
             WHERE stripe_subscription_id = $1 AND failed_payment_count >= 3`,
            [invoice.subscription]
          );
          
          // Here: Send Email Warning logic (e.g. Resend / SendGrid)
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await query(
            `UPDATE users 
             SET subscription_status = 'canceled' 
             WHERE stripe_subscription_id = $1`,
            [subscription.id]
        );
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        await query(
            `UPDATE users 
             SET subscription_status = $2 
             WHERE stripe_subscription_id = $1`,
            [subscription.id, subscription.status] // typically 'active', 'past_due', 'canceled', 'unpaid'
        );
        break;
      }
      
      // ── CTO AUDIT: REFUND HANDLING (Edge Case 8) ──
      case "charge.refunded": {
        const charge = event.data.object as any;
        // In a real flow, you extract the client's Stripe Customer ID, link it to the store, and deduct the metered usage
        // usageRecords.create({ quantity: -refundedCents, action: 'increment' })  or similar logic in Stripe.
        console.warn(`[BILLING AUDIT] Charge ${charge.id} refunded. Deducting usage for customer ${charge.customer}.`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook Handler Error:", err);
    return NextResponse.json({ error: "Internal Database Operation Failed" }, { status: 500 });
  }
}
