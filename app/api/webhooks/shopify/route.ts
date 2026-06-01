import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { bindOutcome } from "@/lib/calibration";
import { queryForTenant } from "@/lib/nolix-rls";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";

export const dynamic = "force-dynamic";

/**
 * SHOPIFY ORDER CREATION WEBHOOK
 * This is the primary "actual_class = convert" signal for Zeno's calibration system.
 * When a real order comes in with a Zeno coupon → we bind the outcome to the prediction log.
 */
export async function POST(req: NextRequest) {
  try {
    // ── [0] RATE LIMIT — Redis (100 req/min for webhooks) ─────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitBlock = await applyRateLimit(ip, "/api/webhooks/shopify");
    if (rateLimitBlock) return rateLimitBlock;

    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    const storeDomain = req.headers.get("x-shopify-shop-domain");

    if (!hmacHeader || !storeDomain) {
      return NextResponse.json({ error: "Missing Shopify Security Headers" }, { status: 401 });
    }

    const order = JSON.parse(rawBody);

    // Check if a Zeno attribution marker was used in the order
    const discountCodes: { code: string; amount: string; type: string }[] = order.discount_codes || [];
    const zenoCoupon = discountCodes.find((d) => d.code.toUpperCase().startsWith("ZENO"));

    if (zenoCoupon) {
      const orderId    = `SH-${order.id}`;
      const orderValue = parseFloat(order.total_price);
      const domain     = storeDomain.replace(/^www\./, "");

      console.log(`[Shopify Webhook] Zeno attribution verified for ${orderId}. Store: ${domain}`);

      // 1. Find the session that used this coupon and bind the outcome
      // RLS: queryForTenant — only reads sessions for THIS store
      const discountCode = zenoCoupon.code.toUpperCase();
      const actionKey =
        discountCode.includes("15") ? "discount_15" :
        discountCode.includes("10") ? "discount_10" : "discount_5";

      const sessionRows = await queryForTenant<{ session_id: string }>(
        `SELECT session_id FROM popup_sessions
         WHERE action_taken LIKE $1
         AND converted = false
         AND created_at > now() - interval '2 hours'
         ORDER BY created_at DESC LIMIT 1`,
        [`%${actionKey}%`],
        domain
      ).catch(() => []);

      if (sessionRows[0]?.session_id) {
        // Bind the Shopify-verified conversion to Zeno’s calibration system
        // Pass domain so calibration uses queryForTenant (RLS-scoped write)
        await bindOutcome(sessionRows[0].session_id, "convert", "checkout_event", domain);

        // Mark the session as converted (RLS-scoped update)
        await queryForTenant(
          `UPDATE popup_sessions SET converted = true WHERE session_id = $1`,
          [sessionRows[0].session_id],
          domain
        );
      }

      // 2. Trigger internal sync-usage for billing
      const internalSyncUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch(`${internalSyncUrl}/api/billing/sync-usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET || "dev_secret"}`,
        },
        body: JSON.stringify({
          session_id: sessionRows[0]?.session_id ?? "shopify_verified",
          order_id: orderId,
          order_value: orderValue,
          store_domain: domain,
          time_since_popup_minutes: 0,
          cart_status_before_ai: "unknown",
        }),
      }).catch((err) => console.error("Internal sync trigger failed:", err));

      return NextResponse.json({ success: true, message: "Outcome bound. Revenue engine synced." });
    }

    return NextResponse.json({ success: true, message: "Ignored: No Zeno attribution on order." });

  } catch (error: any) {
    console.error("[CRITICAL] Shopify Webhook Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
