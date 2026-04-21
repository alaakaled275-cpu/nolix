import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { detectBehaviorEvolution } from "@/lib/nolix-intelligence-reconciliation-engine";
import { logger } from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const visitor_id = url.searchParams.get("visitor_id");
    const hours = Math.min(Number(url.searchParams.get("hours") || "72"), 720);
    
    if (!visitor_id) {
      return NextResponse.json({ error: "Missing visitor_id parameter" }, { status: 400 });
    }

    const evolution = await detectBehaviorEvolution(visitor_id, hours);
    return NextResponse.json({ success: true, data: evolution });
  } catch (e: any) {
    logger.error("engine", `Reconciliation Evolution API error: ${e.message}`, {});
    return NextResponse.json({ error: "EVOLUTION_ERROR", detail: e.message }, { status: 500 });
  }
}
