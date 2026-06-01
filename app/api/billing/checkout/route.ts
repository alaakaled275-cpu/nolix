import { NextResponse, NextRequest } from "next/server";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let basePriceId = STRIPE_PRICES.starter;
    if (plan === "pro")      basePriceId = STRIPE_PRICES.growth;
    if (plan === "enterprise") basePriceId = STRIPE_PRICES.scale;

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: session.email,
      line_items: [{ price: basePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=1`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/billing?canceled=1`,
      metadata: { userId: session.id, plan_id: plan },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("[Billing Checkout] Error:", err.message);
    return NextResponse.json({ error: err.message || "Checkout failed" }, { status: 500 });
  }
}
