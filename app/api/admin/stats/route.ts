import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db"; // Assuming query is exported from lib/db

// Security Check: Ensure only admin token can access
function isAdmin(req: NextRequest) {
  const token = req.headers.get("Authorization");
  // For now, simple token validation from the frontend logic
  return token && token.includes("nolix_admin_token");
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Total Stores
    const storesResult = await query(`SELECT count(*) as total FROM stores`);
    const totalStores = parseInt(storesResult[0]?.total || "0", 10);

    // 2. Active Subscriptions
    const subsResult = await query(`SELECT count(*) as active FROM stores WHERE subscription_status = 'active'`);
    const activeSubscriptions = parseInt(subsResult[0]?.active || "0", 10);

    // 3. Total Revenue (Sum of all invoices paid)
    const revResult = await query(`SELECT sum(last_invoice_amount) as revenue FROM stores WHERE last_invoice_amount IS NOT NULL`);
    const totalRevenue = parseFloat(revResult[0]?.revenue || "0");

    // Financial Intelligence: API Cost Calculation
    // Groq costs ~ $0.0001 per call (average input+output). Let's calculate total AI decisions made.
    const allDecisions = await query(`SELECT count(*) as total FROM rl_decisions`);
    const totalAiCalls = parseInt(allDecisions[0]?.total || "0", 10);
    const estimatedApiCost = totalAiCalls * 0.0001;
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - estimatedApiCost) / totalRevenue) * 100 : 0;

    // 4. Recent Stores (Live Table Data)
    const recentStores = await query(`
      SELECT 
        id, 
        domain, 
        subscription_status, 
        created_at, 
        last_invoice_amount 
      FROM stores 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    // 5. System Health (Basic check if events are flowing)
    const eventsResult = await query(`SELECT count(*) as events FROM rl_decisions WHERE created_at > NOW() - INTERVAL '24 hours'`);
    const eventsLast24h = parseInt(eventsResult[0]?.events || "0", 10);

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalStores,
          activeSubscriptions,
          totalRevenue,
          eventsLast24h,
          financial: {
            aiCost: estimatedApiCost,
            profitMargin: profitMargin.toFixed(2),
            aiCalls: totalAiCalls
          }
        },
        stores: recentStores
      }
    });

  } catch (error: any) {
    console.error("[Admin API] Error fetching stats:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      // Provide dummy data if DB fails during local dev so the UI still works
      data: {
        metrics: {
          totalStores: 0,
          activeSubscriptions: 0,
          totalRevenue: 0,
          eventsLast24h: 0
        },
        stores: [],
        note: "Database disconnected. Showing 0."
      }
    }, { status: 500 });
  }
}