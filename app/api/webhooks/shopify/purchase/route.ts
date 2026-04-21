/**
 * NOLIX — Shopify Webhook v2 (STEP 10 LAYER 6 — Final)
 * POST /api/webhooks/shopify/purchase
 * Uses truthEngine.register() — no direct training in request
 */

import { NextRequest, NextResponse } from "next/server";
import crypto                        from "crypto";
import { truthEngine }               from "@/lib/nolix-truth-engine";
import { retryInsert, startQueueWorker } from "@/lib/nolix-queue";
import { query }                     from "@/lib/db";

startQueueWorker();

function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("❌ SHOPIFY_WEBHOOK_SECRET missing in production. Rejecting.");
      return false;
    }
    console.warn("⚠ HMAC skipped (dev mode — secret not set)");
    return true;
  }
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let rawBody = "";
  try {
    rawBody            = await req.text();
    const hmacHeader   = req.headers.get("x-shopify-hmac-sha256") || "";
    const shopDomain   = req.headers.get("x-shopify-shop-domain") || "unknown";

    // LAYER 6: HARD HMAC ENFORCEMENT
    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      console.error("❌ WEBHOOK: Invalid HMAC.", { shop: shopDomain });
      return NextResponse.json({ error: "Unauthorized — HMAC invalid" }, { status: 401 });
    }

    const order = JSON.parse(rawBody);

    // ONLY process fully paid orders — truth_label = 1.0
    if (order.financial_status !== "paid") {
      return NextResponse.json({ skipped: true, reason: "not_paid", status: order.financial_status });
    }

    const discountCodes: string[] = (order.discount_codes || []).map((d: any) => String(d.code));
    const nolixCoupon = discountCodes.find(c => c.startsWith("NOLIX-")) || null;

    // ATTRIBUTION via truthEngine (coupon → visitor, then Shopify customer fallback)
    const visitorId = await truthEngine.resolveVisitor(nolixCoupon, order.customer?.id);

    if (!visitorId) {
      // Unresolved: persist for manual reconciliation
      await retryInsert(
        `INSERT INTO nolix_unresolved_conversions
         (order_id, coupon_code, shop, total_price, raw_payload, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT DO NOTHING`,
        [String(order.id), nolixCoupon, shopDomain, String(order.total_price || "0"), rawBody],
        3, 300
      );
      return NextResponse.json({ success: false, reason: "visitor_not_resolved" });
    }

    // LAYER 6: Register truth event (queues online training internally)
    await truthEngine.register({
      visitor_id: visitorId,
      event_type: "purchase_confirmed",
      store:      shopDomain,
      order_id:   String(order.id),
      value:      String(order.total_price || "0"),
      meta: { coupon: nolixCoupon, customer: order.customer?.id, items: order.line_items?.length }
    });

    // Record conversion with LAYER 5 retry safety
    await retryInsert(
      `INSERT INTO nolix_conversions
       (visitor_id, order_id, coupon_code, store, total_price, truth_label, financial_status, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, 1.0, 'paid', NOW())
       ON CONFLICT (order_id) DO NOTHING`,
      [visitorId, String(order.id), nolixCoupon, shopDomain, String(order.total_price || "0")],
      3, 500
    );

    // STEP 11 PART 1: Record A/B Conversion proof
    const { recordABConversion } = await import("@/lib/nolix-ab-engine");
    await recordABConversion(visitorId, String(order.id), order.total_price || 0);

    console.log("✅ WEBHOOK: purchase_confirmed processed:", { visitor_id: visitorId, order_id: order.id });

    return NextResponse.json({ success: true, visitor_id: visitorId, order_id: order.id, truth_label: 1.0 });

  } catch(err: any) {
    console.error("❌ WEBHOOK ERROR:", err);
    // Dead letter: persist raw payload for manual recovery
    if (rawBody) {
      try {
        await retryInsert(
          `INSERT INTO nolix_webhook_errors (raw_payload, error, created_at) VALUES ($1, $2, NOW())`,
          [rawBody, String(err.message)], 2, 200
        );
      } catch { /* silent */ }
    }
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}

// GET — client polls for pending purchase signal
export async function GET(req: NextRequest) {
  const visitor_id = req.nextUrl.searchParams.get("visitor_id");
  if (!visitor_id) return NextResponse.json({ error: "Missing visitor_id" }, { status: 400 });
  try {
    const rows = await query<any>(
      `SELECT truth_label, order_id, trained FROM nolix_purchase_signals
       WHERE visitor_id = $1 AND trained = false LIMIT 1`,
      [visitor_id]
    );
    if (!rows.length) return NextResponse.json({ confirmed: false, visitor_id });
    const signal = rows[0] as any;
    await query(
      `UPDATE nolix_purchase_signals SET trained = true WHERE visitor_id = $1 AND order_id = $2`,
      [visitor_id, signal.order_id]
    );
    return NextResponse.json({ confirmed: true, visitor_id, truth_label: signal.truth_label, order_id: signal.order_id });
  } catch(e: any) {
    return NextResponse.json({ error: "DB read error" }, { status: 500 });
  }
}
