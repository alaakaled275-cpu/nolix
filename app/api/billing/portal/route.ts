import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // In production: await getServerSession()
    const mockUserEmail = "admin@example.com";

    const users = await query<any>(`SELECT id, stripe_customer_id FROM users WHERE email = $1 LIMIT 1`, [mockUserEmail]);
    
    if (users.length === 0 || !users[0].stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const { stripe_customer_id } = users[0];

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (err: any) {
    console.error("Stripe Portal Error:", err);
    return NextResponse.json({ error: err.message || "Failed to launch billing portal" }, { status: 500 });
  }
}
