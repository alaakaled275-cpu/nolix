/**
 * NOLIX — ZENO Replay API (Pre-Step 16 PART 9)
 * app/api/zeno/replay/route.ts
 *
 * GET /api/zeno/replay?id=tr_1234567_abc123
 *   → Re-executes the exact same decision with original input
 *   → Returns: original + replayed result + diff
 *
 * This is the "nuclear weapon for debugging":
 *   If a visitor got wrong action, you replay with their exact data
 *   and see why (what the model would do NOW vs what it did THEN)
 */
import { NextRequest, NextResponse }     from "next/server";
import { getDecisionByTraceId, getRecentDecisions } from "@/lib/nolix-decision-trace";
import {
  cmd01ClassifyVisitor, cmd02ScoreIntent,
  cmd03DecideAction,   cmd04ExplainDecision
} from "@/lib/nolix-zeno-commands";
import { getAccessTier, requireTier, getClientId, checkRateLimit } from "@/lib/nolix-security";

export const dynamic = "force-dynamic";

const COMMAND_MAP: Record<string, (raw: any) => Promise<any>> = {
  CMD_01_CLASSIFY_VISITOR: cmd01ClassifyVisitor,
  CMD_02_SCORE_INTENT:     cmd02ScoreIntent,
  CMD_03_DECIDE_ACTION:    cmd03DecideAction,
  CMD_04_EXPLAIN_DECISION: cmd04ExplainDecision
};

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl       = checkRateLimit(clientId, "admin");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const traceId          = searchParams.get("id");
  const historyLimit     = Math.min(Number(searchParams.get("limit") || "20"), 100);

  // ── If no trace_id: return recent decisions list ──────────────────────────
  if (!traceId) {
    const visitorId = searchParams.get("visitor_id") || undefined;
    const command   = searchParams.get("command")    || undefined;
    const decisions = await getRecentDecisions({ visitor_id: visitorId, command, limit: historyLimit });
    return NextResponse.json({ decisions, total: decisions.length });
  }

  // ── Load original decision ────────────────────────────────────────────────
  const original = await getDecisionByTraceId(traceId);
  if (!original) {
    return NextResponse.json({ error: `TRACE_NOT_FOUND: ${traceId}` }, { status: 404 });
  }

  // ── REPLAY: re-execute with original input ────────────────────────────────
  const handler = COMMAND_MAP[original.command];
  let replayed: any = null;
  let replayError: string | undefined;

  if (handler) {
    try {
      replayed = await handler(original.input);
    } catch(e: any) {
      replayError = e.message;
    }
  } else {
    replayError = `Command ${original.command} not re-executable`;
  }

  // ── DIFF: original output vs replayed output ──────────────────────────────
  const diff: Record<string, { original: any; replayed: any }> = {};
  if (replayed && original.output) {
    const allKeys = new Set([...Object.keys(original.output || {}), ...Object.keys(replayed.result || {})]);
    for (const k of allKeys) {
      const origVal    = (original.output as any)[k];
      const replayVal  = (replayed.result || {})[k];
      const origR      = JSON.stringify(origVal);
      const replayR    = JSON.stringify(replayVal);
      if (origR !== replayR) {
        diff[k] = { original: origVal, replayed: replayVal };
      }
    }
  }

  return NextResponse.json({
    trace_id:      traceId,
    original: {
      command:    original.command,
      visitor_id: original.visitor_id,
      created_at: original.created_at,
      reasoning:  original.reasoning,
      output:     original.output,
      latency_ms: original.latency_ms
    },
    replayed: replayed ? {
      command:    original.command,
      output:     replayed.result,
      latency_ms: replayed.latency_ms,
      ok:         replayed.ok
    } : null,
    replay_error:    replayError,
    diff,
    model_changed:   Object.keys(diff).length > 0,
    diff_keys:       Object.keys(diff)
  });
}
