/**
 * NOLIX — Deterministic Replay Engine API v2 (COMMAND 02)
 * app/api/engine/replay-v2/route.ts
 *
 * ⚔️ GET /api/engine/replay-v2?trace_id=xxx&mode=REEXECUTION
 * Re-runs the Hybrid Brain against a frozen snapshot to detect drift and evolution.
 * Modes: PURE_REPLAY | REEXECUTION | COMPARISON
 *
 * ⚔️ POST /api/engine/replay-v2/batch
 * Body: { trace_ids: [...], mode: "COMPARISON" }
 * Replays multiple traces for bulk drift analytics.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { replayDecision, batchReplay, ReplayMode } from "@/lib/nolix-deterministic-replay-engine";
import { logger } from "@/lib/nolix-structured-logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trace_id = searchParams.get("trace_id");
  const mode     = (searchParams.get("mode") || "COMPARISON") as ReplayMode;

  if (!trace_id) {
    return NextResponse.json({ error: "Missing trace_id" }, { status: 400 });
  }

  try {
    const result = await replayDecision({ trace_id, mode });
    
    if (!result) {
      return NextResponse.json({ error: "Snapshot not found for replay", trace_id }, { status: 404 });
    }

    logger.info("replay", `Replay executed: ${trace_id}`, { mode, drift: result.drift });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (e: any) {
    logger.error("engine", `Replay execution failed: ${e.message}`, { trace_id, mode });
    return NextResponse.json({ error: "REPLAY_ERROR", detail: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trace_ids, mode } = body;

    if (!Array.isArray(trace_ids) || trace_ids.length === 0) {
      return NextResponse.json({ error: "trace_ids array is required" }, { status: 400 });
    }

    const m = (mode || "COMPARISON") as ReplayMode;
    const result = await batchReplay(trace_ids, m);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (e: any) {
    return NextResponse.json({ error: "BATCH_REPLAY_ERROR", detail: e.message }, { status: 500 });
  }
}
