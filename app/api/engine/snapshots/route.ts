/**
 * NOLIX — Intelligence Snapshots API (COMMAND 01)
 * app/api/engine/snapshots/route.ts
 *
 * GET /api/engine/snapshots?trace_id=xxx
 *   → Full snapshot + drift report for one trace
 *
 * GET /api/engine/snapshots?replay=xxx
 *   → Full time-travel reconstruction (8-step timeline)
 *
 * GET /api/engine/snapshots?compare=aaa&with=bbb
 *   → Side-by-side diff of two decision snapshots
 *
 * GET /api/engine/snapshots?stats=true&hours=24
 *   → Aggregate stats: approval rate, ML usage, intent breakdown
 *
 * GET /api/engine/snapshots?limit=50&action=show_popup
 *   → Recent snapshots (with optional action filter)
 */

import { NextRequest, NextResponse }      from "next/server";
import { getAccessTier, requireTier }     from "@/lib/nolix-security";
import {
  getSnapshot,
  getRecentSnapshots,
  getSnapshotStats,
  compareSnapshots,
  replayFromSnapshot,
  detectDrift
}                                          from "@/lib/nolix-intelligence-snapshot-engine";
import { logger }                         from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trace_id   = searchParams.get("trace_id");
  const replay     = searchParams.get("replay");
  const compare    = searchParams.get("compare");
  const withTrace  = searchParams.get("with");
  const statsMode  = searchParams.get("stats");
  const limit      = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const hours      = Math.min(Number(searchParams.get("hours") || "24"), 168);
  const action     = searchParams.get("action") || undefined;

  try {
    // ── Mode: Full time-travel replay (8-step timeline) ───────────────────
    if (replay) {
      const result = await replayFromSnapshot(replay);
      if (!result) {
        return NextResponse.json({ error: "Snapshot not found", trace_id: replay }, { status: 404 });
      }
      logger.info("replay", `Replay from snapshot: ${replay}`, {
        drift: result.drift.drift_severity,
        steps: result.timeline.length
      });
      return NextResponse.json({
        mode:              "replay",
        original_trace_id: result.original_trace_id,
        replay_trace_id:   result.replay_trace_id,
        replayed_at:       result.replayed_at,
        original_decision: result.original_decision,
        drift:             result.drift,
        timeline:          result.timeline,
        full_snapshot:     result.full_snapshot
      });
    }

    // ── Mode: Single trace snapshot + drift ───────────────────────────────
    if (trace_id) {
      const snapshot = await getSnapshot(trace_id);
      if (!snapshot) {
        return NextResponse.json({ error: "Snapshot not found", trace_id }, { status: 404 });
      }
      const drift = detectDrift(snapshot);
      return NextResponse.json({
        mode:      "single",
        trace_id,
        snapshot,
        drift
      });
    }

    // ── Mode: Compare two snapshots ────────────────────────────────────────
    if (compare && withTrace) {
      const result = await compareSnapshots(compare, withTrace);
      return NextResponse.json({
        mode:        "compare",
        trace_a:     compare,
        trace_b:     withTrace,
        same_action: result.same_action,
        same_intent: result.same_intent,
        same_gate:   result.same_gate,
        diff_count:  result.diffs.length,
        diffs:       result.diffs,
        snapshot_a:  result.a,
        snapshot_b:  result.b
      });
    }

    // ── Mode: Aggregate stats ─────────────────────────────────────────────
    if (statsMode === "true") {
      const stats = await getSnapshotStats(hours);
      return NextResponse.json({
        mode:         "stats",
        period_hours: hours,
        ...stats
      });
    }

    // ── Mode: Recent snapshots list ───────────────────────────────────────
    const snapshots = await getRecentSnapshots(limit, action);
    return NextResponse.json({
      mode:   "list",
      count:  snapshots.length,
      filter: action || "all",
      snapshots: snapshots.map(s => ({
        trace_id:      s.trace_id,
        timestamp:     s.timestamp,
        action:        s.decision.action,
        popup_type:    s.decision.popup_type,
        intent:        s.behavior.intent_level,
        friction:      s.behavior.friction_type,
        ml_used:       !s.ml.skipped,
        approved:      s.economic.approved,
        roi_ratio:     s.economic.roi_ratio,
        gate:          s.rules.final_gate,
        rules_version: s.rules.version_label
      }))
    });

  } catch (e: any) {
    logger.error("engine", `Snapshots API error: ${e.message}`, { stack: e.stack?.substring(0, 300) });
    return NextResponse.json({ error: "SNAPSHOT_ERROR", detail: e.message }, { status: 500 });
  }
}
