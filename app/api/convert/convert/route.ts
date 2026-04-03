import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/schema";

const convertSchema = z.object({
  session_id:  z.string().min(1),
  order_value: z.number().positive().optional(), // Store passes actual order $ if available
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { session_id, order_value } = parsed.data;

    // Mark as converted + record revenue. Also flag discount_avoided if action was NOT a discount.
    const rows = await query<{
      ab_variant: string;
      offer_type: string | null;
      action_taken: string | null;
    }>(
      `UPDATE popup_sessions
       SET
         converted           = true,
         order_value         = COALESCE($2, order_value),
         influenced_by_system = true,
         discount_avoided    = CASE
           WHEN COALESCE(action_taken, offer_type) NOT LIKE 'discount%' THEN true
           ELSE false
         END
       WHERE session_id = $1 AND converted = false
       RETURNING ab_variant, offer_type, action_taken`,
      [session_id, order_value ?? null]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "Already converted or session not found" });
    }

    const { ab_variant, offer_type, action_taken } = rows[0];
    const effectiveOffer = action_taken ?? offer_type;

    // Update A/B conversion counters
    if (effectiveOffer) {
      await query(
        `UPDATE ab_test_results
         SET conversions = conversions + 1, updated_at = now()
         WHERE variant = $1 AND offer_type = $2`,
        [ab_variant, effectiveOffer]
      );
    }

    return NextResponse.json({ success: true, session_id, revenue_attributed: order_value ?? null });
  } catch (err) {
    console.error("[convert] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
