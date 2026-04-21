/**
 * NOLIX — Backlog Drain API (STEP 13.5 PART 3)
 * POST /api/admin/backlog/drain   — drain up to N events
 * GET  /api/admin/backlog/status  — check backlog size
 */

import { NextRequest, NextResponse } from "next/server";
import { processBacklogBatch, getBacklogStatus } from "@/lib/nolix-training-backlog";
import { getFlags, loadRuntimeFlags } from "@/lib/nolix-runtime";

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-nolix-sync-secret") === process.env.NOLIX_SYNC_SECRET;
}

// POST — trigger backlog drain
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const batchSize = parseInt(body.batch_size || "1000");

  await loadRuntimeFlags();
  const flags = getFlags();

  if (!flags.training_enabled) {
    return NextResponse.json({
      drained: false,
      reason:  "training_still_disabled",
      message: "Cannot drain backlog — training_enabled is still false. System must recover first."
    }, { status: 503 });
  }

  const result = await processBacklogBatch(batchSize);
  return NextResponse.json({ drained: true, ...result });
}

// GET — backlog status
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getBacklogStatus();
  return NextResponse.json(status);
}
