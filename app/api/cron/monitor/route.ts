/**
 * NOLIX — Cron: Monitor (STEP 15 PART 12)
 * app/api/cron/monitor/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { runMonitor }                from "@/lib/nolix-model-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.NOLIX_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await runMonitor();
  return NextResponse.json({ ok: true, report, ran_at: new Date().toISOString() });
}
