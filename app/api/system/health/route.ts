/**
 * NOLIX — System Health Monitor API (STEP 12 PART 2)
 * GET /api/system/health   — live health score + history
 * POST /api/system/health  — trigger manual health check
 */

import { NextRequest, NextResponse } from "next/server";
import { computeSystemHealth, getHealthHistory } from "@/lib/nolix-health-engine";
import { startQueueWorker } from "@/lib/nolix-queue";
import { applyAPIGuard } from "@/lib/nolix-api-guard";

startQueueWorker();

// GET — health history (cached — don't recompute)
export async function GET(req: NextRequest) {
  const guard = await applyAPIGuard(req, undefined, { skipSignature: true });
  if (!guard.passed) return guard.response;

  const limit   = parseInt(req.nextUrl.searchParams.get("limit") || "48");
  const history = await getHealthHistory(limit);

  // Return latest snapshot from history (no recompute for GET)
  const latest  = (history as any[])[0] || null;

  return NextResponse.json({
    latest,
    history,
    thresholds: {
      healthy:  ">= 0.80",
      degraded: ">= 0.50",
      critical: ">= 0.40 (AI auto-disabled)",
      failed:   "<  0.40 (alert sent)"
    }
  });
}

// POST — trigger live health check (admin use only or cron)
export async function POST(req: NextRequest) {
  const isAdmin = req.headers.get("x-nolix-sync-secret") === process.env.NOLIX_SYNC_SECRET;
  const isCron  = req.headers.get("x-vercel-cron") === "1";
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await computeSystemHealth();
  return NextResponse.json({ health, triggered_at: new Date().toISOString() });
}
