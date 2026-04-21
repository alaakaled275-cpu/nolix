import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trace_id = new URL(req.url).searchParams.get("trace_id");
  if (!trace_id) return NextResponse.json({ error: "Missing trace_id" }, { status: 400 });

  try {
    const rows = await query(
      `SELECT * FROM nolix_structured_events WHERE trace_id = $1 ORDER BY created_at ASC`,
      [trace_id]
    );

    const metrics = await query(
      `SELECT * FROM nolix_decision_metrics WHERE trace_id = $1 LIMIT 1`,
      [trace_id]
    );
    
    return NextResponse.json({ 
      success: true, 
      trace_id,
      metrics: metrics.length > 0 ? metrics[0] : null,
      events: rows 
    });
  } catch (e: any) {
    return NextResponse.json({ error: "DB Error", message: e.message }, { status: 500 });
  }
}
