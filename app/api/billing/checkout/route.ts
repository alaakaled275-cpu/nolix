import { NextResponse, NextRequest } from "next/server";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    // 1. Identify User (In a real app, use next-auth session)
    // For this build, we mock the user context using an environment var or default.
    // NOTE: In production, `await getServerSession(authOptions)` is mandatory here.
    const mockUserEmail = "admin@example.com"; 

    // Retrieve user from database
    const users = await query<any>(`SELECT id, stripe_customer_id FROM users WHERE email = $1 LIMIT 1`, [mockUserEmail]);
    
    if (users.length === 0) {
      return NextResponse.json({ error: "Unauthorized / User not found" }, { status: 401 });
    }

    const userId = users[0].id;
    let customerId = users[0].stripe_customer_id;

    // 2. Create Stripe Customer if missing
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: mockUserEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      
      // Save customer ID
      await query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, userId]);
    }

    // 3. Select Base Plan Price ID
    let basePriceId = STRIPE_PRICES.starter;
    if (plan === "growth") basePriceId = STRIPE_PRICES.growth;
    if (plan === "scale") basePriceId = STRIPE_PRICES.scale;

    // 4. Create Stripe Checkout Session (Mode: Subscription)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      billing_address_collection: "auto",
      // Enforce the Hybrid Model -> Base Fee + Metered Usage Commission
      line_items: [
        {
          price: basePriceId,
          quantity: 1, // Fixed Monthly Subscription
        },
        {
          price: STRIPE_PRICES.revenue_share, // Stripe Price ID with "usage_type: metered"
        }
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing`,
      metadata: {
        userId,
        plan_id: plan
      }
    });

    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create checkout session" }, { status: 500 });
  }
}
