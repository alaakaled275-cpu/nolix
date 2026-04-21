/**
 * NOLIX — Replay Engine API
 * app/api/engine/replay/route.ts
 *
 * GET /api/engine/replay?trace_id=xxx
 *   → Reconstruct a past decision step by step
 *
 * GET /api/engine/replay?trace_id=aaa&compare=bbb
 *   → Side-by-side diff of two traces
 *
 * GET /api/engine/replay?visitor_id=v_xxx
 *   → Full visitor behavioral timeline
 */

import { NextRequest, NextResponse }    from "next/server";
import { getAccessTier, requireTier }   from "@/lib/nolix-security";
import {
  replayTrace,
  compareTraces,
  getVisitorTimeline,
  getFailedDecisions
}                                       from "@/lib/nolix-replay-engine";
import { logger }                       from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trace_id   = searchParams.get("trace_id");
  const compare    = searchParams.get("compare");
  const visitor_id = searchParams.get("visitor_id");
  const failures   = searchParams.get("failures");

  try {
    // ── Mode 1: Compare two traces ─────────────────────────────────────────
    if (trace_id && compare) {
      const diff = await compareTraces(trace_id, compare);
      return NextResponse.json({
        mode:        "compare",
        trace_a:     trace_id,
        trace_b:     compare,
        same_action: diff.same_action,
        diff_count:  diff.diffs.length,
        diffs:       diff.diffs,
        a_decision:  diff.a_decision,
        b_decision:  diff.b_decision
      });
    }

    // ── Mode 2: Replay a single trace ──────────────────────────────────────
    if (trace_id) {
      const result = await replayTrace(trace_id);
      if (!result.found) {
        return NextResponse.json({ error: "Trace not found", trace_id }, { status: 404 });
      }
      logger.info("replay", `Replayed trace ${trace_id}`, { steps: result.timeline.length });
      return NextResponse.json({
        mode:             "replay",
        trace_id:         result.trace_id,
        visitor_id:       result.visitor_id,
        replay_id:        result.replay_id,
        replay_at:        result.replay_at,
        total_events:     result.total_events,
        timeline:         result.timeline,
        final_decision:   result.final_decision,
        behavior_summary: result.behavior_summary,
        ml_summary:       result.ml_summary
      });
    }

    // ── Mode 3: Visitor full timeline ──────────────────────────────────────
    if (visitor_id) {
      const timeline = await getVisitorTimeline(visitor_id);
      return NextResponse.json({
        mode:            "visitor_timeline",
        visitor_id,
        total_sessions:  timeline.total_sessions,
        first_seen:      timeline.first_seen,
        last_seen:       timeline.last_seen,
        sessions:        timeline.sessions
      });
    }

    // ── Mode 4: Failed decisions audit ─────────────────────────────────────
    if (failures === "true") {
      const failed = await getFailedDecisions(24);
      return NextResponse.json({
        mode:    "failed_audit",
        count:   failed.length,
        events:  failed
      });
    }

    // ── No valid params ────────────────────────────────────────────────────
    return NextResponse.json({
      error: "MISSING_PARAMS",
      usage: {
        replay_trace:    "GET /api/engine/replay?trace_id=xxx",
        compare_traces:  "GET /api/engine/replay?trace_id=aaa&compare=bbb",
        visitor_history: "GET /api/engine/replay?visitor_id=v_xxx",
        failed_audit:    "GET /api/engine/replay?failures=true"
      }
    }, { status: 400 });

  } catch (e: any) {
    logger.error("replay", e.message, { stack: e.stack?.substring(0, 300) });
    return NextResponse.json({ error: "REPLAY_ERROR", detail: e.message }, { status: 500 });
  }
}
