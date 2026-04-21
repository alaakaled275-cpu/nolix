import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { buildReconciliationReport } from "@/lib/nolix-intelligence-reconciliation-engine";
import { logger } from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const hours = Math.min(Number(url.searchParams.get("hours") || "24"), 168);
    
    const report = await buildReconciliationReport(hours);
    return NextResponse.json({ success: true, data: report });
  } catch (e: any) {
    logger.error("engine", `Reconciliation System Report error: ${e.message}`, {});
    return NextResponse.json({ error: "SYSTEM_REPORT_ERROR", detail: e.message }, { status: 500 });
  }
}
