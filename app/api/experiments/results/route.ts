import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // We group decisions by ab_group, count how many popups shown, and how many conversions.
    const results = await query(`
      SELECT 
        COALESCE(d.ab_group, 'Control') as variant,
        count(d.id) as total_shown,
        count(o.id) as total_conversions,
        SUM(COALESCE(o.revenue_attributed, 0)) as revenue
      FROM rl_decisions d
      LEFT JOIN rl_outcomes o ON d.trace_id = o.trace_id
      WHERE d.intent != 'none'
      GROUP BY COALESCE(d.ab_group, 'Control')
    `);

    // Format for frontend
    const variants = results.map((row: any) => ({
      name: row.variant,
      shown: parseInt(row.total_shown),
      conversions: parseInt(row.total_conversions),
      revenue: parseFloat(row.revenue || "0"),
      cvr: parseInt(row.total_shown) > 0 ? ((parseInt(row.total_conversions) / parseInt(row.total_shown)) * 100).toFixed(1) : 0
    }));

    return NextResponse.json({ success: true, variants });
  } catch (error: any) {
    console.error("[Experiments API] Error:", error);
    // Fallback for UI if DB is offline
    return NextResponse.json({
      success: false,
      error: error.message,
      variants: [
        { name: "Control (10%)", shown: 450, conversions: 12, revenue: 540, cvr: 2.6 },
        { name: "Variant A (15%)", shown: 452, conversions: 24, revenue: 980, cvr: 5.3 }
      ]
    });
  }
}
