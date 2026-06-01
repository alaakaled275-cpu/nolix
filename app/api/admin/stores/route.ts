import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { ensureNolixSchema } = await import("@/lib/schema");
    await ensureNolixSchema();

    // Fetch stores and their Stripe subscription status from the DB
    const stores = await query(`
      SELECT 
        s.id,
        s.domain as store_domain,
        s.plan,
        s.active,
        s.created_at,
        u.email,
        u.subscription_status,
        u.plan_id,
        u.stripe_subscription_id,
        (SELECT COUNT(*) FROM popup_sessions ps WHERE ps.store_domain = s.domain) as session_count
      FROM stores s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);

    return NextResponse.json({ stores });
  } catch (err: any) {
    console.error("Admin Stores API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
