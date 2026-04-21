/**
 * NOLIX — Coupon Registry API (STEP 9.1)
 * POST /api/track/coupon
 *
 * Registers coupon → visitor mapping in PostgreSQL.
 * Replaces in-memory COUPON_VISITOR_MAP (which died on server restart).
 * Called from master.js when a coupon is issued.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { enqueue } from "@/lib/nolix-queue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coupon_code, visitor_id, session_id, store } = body;

    if (!coupon_code || !visitor_id) {
      return NextResponse.json(
        { error: "Missing: coupon_code, visitor_id" },
        { status: 400 }
      );
    }

    // Persist coupon → visitor mapping (survives server restart)
    await query(
      `INSERT INTO nolix_coupon_registry (coupon_code, visitor_id, session_id, store, issued_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (coupon_code) DO NOTHING`,
      [coupon_code, visitor_id, session_id || null, store || "unknown"]
    );

    // Enqueue event log (non-blocking)
    enqueue({
      type:       "coupon_issued",
      visitor_id,
      session_id,
      store:      store || "unknown",
      payload:    { coupon_code },
      queued_at:  Date.now()
    });

    console.log("🎟 COUPON REGISTERED (DB):", coupon_code, "→", visitor_id);

    return NextResponse.json({ registered: true, coupon_code, visitor_id });

  } catch(err: any) {
    console.error("❌ /api/track/coupon ERROR:", err);
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}
