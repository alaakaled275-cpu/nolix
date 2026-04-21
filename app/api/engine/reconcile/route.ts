/**
 * NOLIX — Intelligence Reconciliation API (COMMAND 2.5)
 * app/api/engine/reconcile/route.ts
 *
 * ⚔️ GET /api/engine/reconcile?trace_id=xxx
 *   → Triple-state Brain Re-execution (Original vs Simulated Old vs Current)
 *
 * ⚔️ GET /api/engine/reconcile/evolution?visitor_id=xxx&hours=72
 *   → Behavioral Evolution Tracking (Feature-level and Segment-level drift)
 *
 * ⚔️ GET /api/engine/reconcile/system?hours=24
 *   → System-wide Reconciliation Report (Intelligence state classifier)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { getSnapshot } from "@/lib/nolix-intelligence-snapshot-engine";
import {
  reExecuteDecision,
  detectBehaviorEvolution,
  buildReconciliationReport
} from "@/lib/nolix-intelligence-reconciliation-engine";
import { logger } from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  
  try {
    // ── Single Trace Re-execution Mode ────────────────────────────────────────
    const trace_id = url.searchParams.get("trace_id");
    if (!trace_id) {
      return NextResponse.json({ 
        error: "Missing trace_id parameter", 
        endpoints: ["?trace_id=...", "/evolution?visitor_id=...", "/system?hours=..."] 
      }, { status: 400 });
    }

    const snapshot = await getSnapshot(trace_id);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found cannot perform reconciliation" }, { status: 404 });
    }

    const reconciliation = await reExecuteDecision(snapshot);
    logger.info("engine", `Intelligence Reconciliation run for ${trace_id}`, {
      overall_divergence: reconciliation.divergence.overall
    });

    return NextResponse.json({
      success: true,
      data: reconciliation
    });

  } catch (e: any) {
    logger.error("engine", `Reconciliation API error: ${e.message}`, { path });
    return NextResponse.json({ error: "RECONCILIATION_ERROR", detail: e.message }, { status: 500 });
  }
}
