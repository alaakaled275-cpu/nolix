import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hours = Math.min(Number(new URL(req.url).searchParams.get("hours") || "24"), 168);

  try {
    const rows = await query(`
      SELECT 
        COUNT(*) as total_decisions,
        AVG(latency_ms) as avg_latency,
        MAX(latency_ms) as peek_latency,
        AVG(ml_contribution) as avg_ml_boost,
        AVG(rule_hits) as avg_rules_fired,
        AVG(economic_ratio) as avg_roi
      FROM nolix_decision_metrics
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
    `);
    
    return NextResponse.json({ 
      success: true, 
      period: `${hours}h`,
      metrics: rows[0] 
    });
  } catch (e: any) {
    return NextResponse.json({ error: "DB Error", message: e.message }, { status: 500 });
  }
}
