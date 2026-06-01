import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  // In a real app, extract store domain from the session/token.
  // For the sake of the dashboard demo, we'll read it from a header or default to the test store.
  const domain = req.headers.get("x-store-domain") || "test-store.myshopify.com";

  try {
    // Fetch matched attribution logs (decisions that led to outcomes)
    const logs = await query(`
      SELECT 
        d.trace_id,
        d.created_at as popup_time,
        d.intent,
        d.action,
        o.created_at as conversion_time,
        o.revenue_attributed,
        o.order_id
      FROM rl_decisions d
      JOIN rl_outcomes o ON d.trace_id = o.trace_id
      WHERE d.domain = $1
      ORDER BY o.created_at DESC
      LIMIT 100
    `, [domain]);

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("[Audit API] Error:", error);
    // Return mock data if DB is disconnected (for demo purposes)
    return NextResponse.json({
      success: false,
      error: error.message,
      logs: [
        {
          trace_id: "tr_mock_8f9a2",
          popup_time: new Date(Date.now() - 3600000).toISOString(),
          intent: "exit_intent",
          action: "Offer 10% Discount",
          conversion_time: new Date(Date.now() - 1800000).toISOString(),
          revenue_attributed: 120.50,
          order_id: "ORD-9921"
        },
        {
          trace_id: "tr_mock_3b1c4",
          popup_time: new Date(Date.now() - 86400000).toISOString(),
          intent: "hesitation",
          action: "Show Social Proof",
          conversion_time: new Date(Date.now() - 82000000).toISOString(),
          revenue_attributed: 45.00,
          order_id: "ORD-9844"
        }
      ],
      note: "Showing mock data because DB is disconnected."
    });
  }
}
