/**
 * NOLIX — ZENO Command API (Pre-Step 16 PARTS 3-10)
 * app/api/zeno/route.ts
 *
 * POST /api/zeno — READ-ONLY analyst layer (no DB writes, no flag changes)
 * { command: "CMD_02_SCORE_INTENT", ...signal_fields }
 *
 * Supports:
 *   CMD_01_CLASSIFY_VISITOR
 *   CMD_02_SCORE_INTENT
 *   CMD_03_DECIDE_ACTION
 *   CMD_04_EXPLAIN_DECISION
 */
import { NextRequest, NextResponse } from "next/server";
import {
  cmd01ClassifyVisitor, cmd02ScoreIntent,
  cmd03DecideAction,   cmd04ExplainDecision
} from "@/lib/nolix-zeno-commands";
import { validateCommandPayload }  from "@/lib/nolix-signal-validator";
import { getAccessTier, requireTier, checkRateLimit, getClientId } from "@/lib/nolix-security";

export const dynamic = "force-dynamic";

const COMMAND_MAP: Record<string, (raw: any) => Promise<any>> = {
  CMD_01_CLASSIFY_VISITOR: cmd01ClassifyVisitor,
  CMD_02_SCORE_INTENT:     cmd02ScoreIntent,
  CMD_03_DECIDE_ACTION:    cmd03DecideAction,
  CMD_04_EXPLAIN_DECISION: cmd04ExplainDecision
};

export async function POST(req: NextRequest) {
  const key  = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl       = checkRateLimit(clientId, "predict");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body    = await req.json().catch(() => ({}));
  const command = body.command as string;

  if (!command || !COMMAND_MAP[command]) {
    return NextResponse.json({
      error:    "UNKNOWN_COMMAND",
      message:  `Unknown command: '${command}'. Valid: ${Object.keys(COMMAND_MAP).join(", ")}`,
      version:  "v1"
    }, { status: 400 });
  }

  const { command: _, ...payload } = body;

  // PART 6+7: Quick pre-check (full check happens inside command fn)
  const contractCheck = validateCommandPayload(command, payload);
  if (!contractCheck.valid && contractCheck.errors.some(e => e.code === "UNEXPECTED_FIELD")) {
    return NextResponse.json({
      error:   "UNEXPECTED_FIELD",
      message: contractCheck.errors.map(e => e.message).join("; "),
      version: "v1"
    }, { status: 422 });
  }

  const handler = COMMAND_MAP[command];
  const result  = await handler(payload);

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    zeno_version: "v1",
    commands:     Object.keys(COMMAND_MAP),
    rules: [
      "ZENO does NOT predict — uses /api/engine/predict internally",
      "ZENO does NOT write to DB — logs only",
      "ZENO does NOT change runtime flags",
      "All commands check ai_enabled flag first",
      "All responses include version field",
      "Unknown fields are rejected with UNEXPECTED_FIELD"
    ]
  });
}
