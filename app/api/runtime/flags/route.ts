/**
 * NOLIX — Public Runtime Flags API (STEP 13 PART 7)
 * GET /api/runtime/flags
 *
 * Called by master.js on every boot to get LIVE flags from server.
 * This ensures distributed safety — client always reads from DB,
 * not from stale in-memory state.
 *
 * NO secret required (public — but we only return safe flags)
 * Rate limited by applyAPIGuard
 */

import { NextRequest, NextResponse } from "next/server";
import { loadRuntimeFlags, getFlags } from "@/lib/nolix-runtime";
import { applyAPIGuard } from "@/lib/nolix-api-guard";
import { startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

export async function GET(req: NextRequest) {
  const guard = await applyAPIGuard(req, undefined, { skipSignature: true });
  if (!guard.passed) return guard.response;

  // Force-reload from DB (distributed-safe — no stale memory)
  await loadRuntimeFlags();
  const flags = getFlags();

  // Return ONLY safe flags (no secrets, no internal config)
  return NextResponse.json({
    ai_enabled:        flags.ai_enabled,
    training_enabled:  flags.training_enabled,
    embedding_enabled: flags.embedding_enabled,
    ab_test_enabled:   flags.ab_test_enabled,
    coupons_enabled:   flags.coupons_enabled,
    maintenance_mode:  flags.maintenance_mode,
    fetched_at:        Date.now()
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0"  // Never cache — always fresh
    }
  });
}
