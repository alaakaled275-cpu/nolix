/**
 * app/api/analyze/outcome/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Ground Truth Logger — CRLS Calibration Layer
 *
 * POST: Record verified ground truth about a domain's actual type.
 *
 * Who calls this?
 *   - Store owner (human verification): "yes this is my ecommerce store"
 *   - checkout_data: when a real purchase event is confirmed from this domain
 *   - backend_event: webhook from Shopify/WooCommerce confirming store type
 *   - analytics: GA4/analytics data shows product views / transactions
 *
 * Why does this matter?
 *   Without this, ecommerce_probability is a claim.
 *   With this, it becomes a MEASURED score.
 *   The calibration engine needs this to compute Brier/LogLoss/AUC.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logOutcome } from "@/lib/calibration-engine";
import { ensureNolixSchema } from "@/lib/schema";

const schema = z.object({
  url:              z.string().url(),
  actual_type:      z.enum(["ecommerce", "content", "saas", "marketplace", "unknown"]),
  verified_by:      z.enum(["checkout_data", "backend_event", "analytics", "human", "inferred"]).default("human"),
  revenue_real:     z.number().optional(),
  conversion_real:  z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const session = await getSession();

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { url, actual_type, verified_by, revenue_real, conversion_real } = parsed.data;

    const id = await logOutcome(url, actual_type, verified_by, revenue_real, conversion_real);

    return NextResponse.json({
      recorded:      true,
      id,
      url,
      actual_type,
      verified_by,
      message:       `Ground truth recorded: ${url} is confirmed as "${actual_type}" (verified_by: ${verified_by}). Calibration batch will include this data point.`,
    });

  } catch (err) {
    console.error("[analyze/outcome] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
