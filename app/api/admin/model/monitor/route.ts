/**
 * NOLIX — Monitor API (STEP 15 PART 12)
 * app/api/admin/model/monitor/route.ts
 *
 * GET  — return latest monitor report
 * POST — trigger immediate monitor run
 */
import { NextRequest, NextResponse }           from "next/server";
import { runMonitor, getLatestMonitorReport }  from "@/lib/nolix-model-monitor";
import { getAccessTier, requireTier, getClientId } from "@/lib/nolix-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await getLatestMonitorReport();
  return NextResponse.json({ report, has_report: !!report });
}

export async function POST(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await runMonitor();
  return NextResponse.json({ report, ok: true });
}
