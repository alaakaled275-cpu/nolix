/**
 * NOLIX — Runtime Control Panel API (STEP 12 PART 7)
 * GET  /api/admin/runtime     — get all current flags
 * POST /api/admin/runtime     — update one or more flags
 * DELETE /api/admin/runtime   — reset all flags to defaults
 *
 * Requires NOLIX_SYNC_SECRET for ALL operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFlags, setFlag, setFlags, resetFlags, loadRuntimeFlags, RuntimeFlags } from "@/lib/nolix-runtime";
import { startQueueWorker } from "@/lib/nolix-queue";
import { query } from "@/lib/db";

startQueueWorker();

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-nolix-sync-secret") === process.env.NOLIX_SYNC_SECRET;
}

// GET — View all current runtime flags + audit log
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await loadRuntimeFlags();
  const flags = getFlags();

  const audit = await query<any>(
    `SELECT flag_key, old_value, new_value, changed_by, changed_at
     FROM nolix_runtime_audit ORDER BY changed_at DESC LIMIT 20`
  ).catch(() => []);

  return NextResponse.json({
    flags,
    audit,
    note: "POST to update flags. DELETE to reset all to defaults."
  });
}

// POST — Update one or more flags
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { updates, updated_by } = body as {
    updates:    Partial<Record<keyof RuntimeFlags, boolean>>;
    updated_by: string;
  };

  if (!updates || typeof updates !== "object") {
    return NextResponse.json({
      error:   "Invalid payload",
      example: { updates: { ai_enabled: false, training_enabled: true }, updated_by: "admin" }
    }, { status: 400 });
  }

  const results  = await setFlags(updates, updated_by || "admin_api");
  const newFlags = getFlags();

  console.log("⚙ RUNTIME FLAGS UPDATED:", results);
  return NextResponse.json({ updated: results, current_flags: newFlags });
}

// DELETE — Reset all flags to defaults
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await resetFlags("admin_api_reset");
  return NextResponse.json({ reset: true, current_flags: getFlags() });
}
