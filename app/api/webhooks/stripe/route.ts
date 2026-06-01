/**
 * /app/api/webhooks/stripe/route.ts
 * Sprint 7+8: Complete Stripe Webhook Handler
 *
 * Events handled:
 *   checkout.session.completed  → activate store subscription in DB
 *   invoice.paid                → confirm renewal, send receipt email
 *   invoice.payment_failed      → send warning email, mark past_due
 *   customer.subscription.deleted → mark cancelled
 *   customer.subscription.updated → sync status
 *   charge.refunded             → log refund
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Use stripe singleton safely
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" })
  : null;

// ── Email helper via Resend ────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "Nolix <billing@nolix.ai>",
        to:      [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.warn("[Webhook] Email send failed:", e);
  }
}

// ── DB helper (safe — doesn't crash if DB is down) ────────────────────────────
async function safeQuery(sql: string, params: unknown[]) {
  try {
    const { query } = await import("@/lib/db");
    return await query(sql, params);
  } catch (e: any) {
    console.warn("[Webhook] DB write failed (non-fatal):", e.message);
    return [];
  }
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    console.warn("[Webhook] Stripe not configured — ignoring webhook");
    return NextResponse.json({ received: true, status: "stripe_not_configured" });
  }

  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log(`[Webhook] Event: ${event.type} | ID: ${event.id}`);

  try {
    switch (event.type) {

      // ── Sprint 8: Subscription activated after payment ──────────────────────
      case "checkout.session.completed": {
        const session       = event.data.object as Stripe.Checkout.Session;
        const customerId    = session.customer as string;
        const subscriptionId = session.subscription as string;
        const storeDomain   = session.metadata?.store_domain || "";
        const plan          = session.metadata?.plan || "starter";
        const customerEmail = session.customer_details?.email || "";

        if (storeDomain) {
          await safeQuery(
            `UPDATE stores
             SET stripe_customer_id    = $1,
                 stripe_subscription_id = $2,
                 subscription_status   = 'active',
                 plan                  = $3,
                 activated_at          = NOW()
             WHERE domain = $4`,
            [customerId, subscriptionId, plan, storeDomain]
          );

          console.log(`[Webhook] ✅ Subscription activated: ${storeDomain} → ${plan}`);

          // Send welcome email
          if (customerEmail) {
            await sendEmail(
              customerEmail,
              "🎉 Nolix is now active on your store!",
              `<div style="font-family:sans-serif;max-width:560px;margin:auto;">
                <h2>Welcome to Nolix, ${storeDomain}!</h2>
                <p>Your <strong>${plan}</strong> plan is now active.</p>
                <p>Nolix is now monitoring your store and will start recovering revenue automatically within 24 hours.</p>
                <a href="https://${process.env.NOLIX_API_BASE?.replace('https://', '') || 'nolix.ai'}/dashboard" 
                   style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
                  View Your Dashboard →
                </a>
                <p style="color:#888;margin-top:32px;font-size:12px;">Nolix Intelligence · You are billed only for attributed conversions.</p>
              </div>`
            );
          }
        }
        break;
      }

      // ── Sprint 7: Invoice paid = Renewal confirmed ──────────────────────────
      case "invoice.paid": {
        const invoice        = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        const amountPaid     = (invoice.amount_paid || 0) / 100;
        const customerEmail  = invoice.customer_email || "";
        const periodEnd      = new Date((invoice.period_end || 0) * 1000).toLocaleDateString();

        await safeQuery(
          `UPDATE stores
           SET subscription_status = 'active',
               failed_payment_count = 0,
               last_invoice_paid_at = NOW(),
               last_invoice_amount  = $1
           WHERE stripe_subscription_id = $2`,
          [amountPaid, subscriptionId]
        );

        console.log(`[Webhook] ✅ Invoice paid: $${amountPaid} | Subscription: ${subscriptionId}`);

        // Send receipt email
        if (customerEmail && amountPaid > 0) {
          await sendEmail(
            customerEmail,
            `✅ Payment confirmed — $${amountPaid.toFixed(2)}`,
            `<div style="font-family:sans-serif;max-width:560px;margin:auto;">
              <h2>Payment Confirmed</h2>
              <p>We received your payment of <strong>$${amountPaid.toFixed(2)}</strong>.</p>
              <p>Your Nolix subscription is active through <strong>${periodEnd}</strong>.</p>
              <p><a href="${invoice.hosted_invoice_url || '#'}">View Invoice PDF</a></p>
              <p style="color:#888;font-size:12px;">Nolix Intelligence · Thank you for your business.</p>
            </div>`
          );
        }
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice        = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        const customerEmail  = invoice.customer_email || "";
        const amountDue      = (invoice.amount_due || 0) / 100;


        const rows = await safeQuery(
          `UPDATE stores
           SET failed_payment_count = COALESCE(failed_payment_count, 0) + 1,
               subscription_status  = CASE
                 WHEN COALESCE(failed_payment_count, 0) + 1 >= 3 THEN 'past_due'
                 ELSE subscription_status
               END
           WHERE stripe_subscription_id = $1
           RETURNING domain, failed_payment_count`,
          [subscriptionId]
        ) as any[];

        const domain      = rows[0]?.domain || "";
        const failCount   = rows[0]?.failed_payment_count || 1;

        console.warn(`[Webhook] ⚠️ Payment failed (${failCount}x): ${domain} — $${amountDue}`);

        if (customerEmail) {
          await sendEmail(
            customerEmail,
            "⚠️ Payment failed — action required",
            `<div style="font-family:sans-serif;max-width:560px;margin:auto;">
              <h2>Payment Failed</h2>
              <p>We couldn't charge <strong>$${amountDue.toFixed(2)}</strong> for your Nolix subscription.</p>
              <p>Please update your payment method to keep Nolix active on your store.</p>
              ${failCount >= 3
                ? "<p><strong>⚠️ Your subscription will be suspended if payment is not resolved within 24 hours.</strong></p>"
                : `<p>We will retry automatically. This is attempt ${failCount} of 3.</p>`
              }
              <p style="color:#888;font-size:12px;">Nolix Intelligence · Contact support@nolix.ai if you need help.</p>
            </div>`
          );
        }
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await safeQuery(
          `UPDATE stores
           SET subscription_status = 'canceled',
               canceled_at         = NOW()
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        );
        console.log(`[Webhook] ❌ Subscription cancelled: ${subscription.id}`);
        break;
      }

      // ── Subscription updated (plan change, trial end, etc.) ───────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await safeQuery(
          `UPDATE stores
           SET subscription_status = $1
           WHERE stripe_subscription_id = $2`,
          [subscription.status, subscription.id]
        );
        console.log(`[Webhook] 🔄 Subscription updated: ${subscription.id} → ${subscription.status}`);
        break;
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refunded = (charge.amount_refunded || 0) / 100;
        console.warn(`[Webhook] 💸 Refund: $${refunded} | Customer: ${charge.customer}`);
        // Log refund — in production, deduct metered usage accordingly
        await safeQuery(
          `INSERT INTO billing_events (event_type, stripe_id, amount, created_at)
           VALUES ('refund', $1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [charge.id, refunded]
        );
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, event: event.type });

  } catch (err: any) {
    console.error("[Webhook] Handler error:", err.message);
    // Always return 200 so Stripe doesn't retry on our DB errors
    return NextResponse.json({ received: true, internal_error: err.message });
  }
}
