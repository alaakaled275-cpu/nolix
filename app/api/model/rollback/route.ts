/**
 * NOLIX — Model Rollback Endpoint (STEP 11.1 PART 7)
 * POST /api/model/rollback
 * GET  /api/model/rollback
 *
 * Allows restoring any saved model version.
 * Requires NOLIX_SYNC_SECRET for security.
 */

import { NextRequest, NextResponse } from "next/server";
import { rollbackToVersion, getModelState } from "@/lib/nolix-ml-engine";
import { query } from "@/lib/db";
import { startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

// GET — list available model versions for rollback
export async function GET(req: NextRequest) {
  try {
    const rows = await query<any>(
      `SELECT model_id, version, metrics, drift_detected, ai_enabled, created_at
       FROM nolix_models ORDER BY created_at DESC LIMIT 20`
    );
    const current = getModelState();
    return NextResponse.json({
      current_model: {
        version:       current.version,
        model_id:      current.model_id,
        ai_enabled:    current.ai_enabled,
        allow_sync:    current.allow_sync,
        drift:         current.drift_detected,
        auc:           current.last_auc
      },
      available_versions: rows,
      total:              (rows as any[]).length
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — perform rollback to a specific model_id
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-nolix-sync-secret");
  if (!secret || secret !== process.env.NOLIX_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { model_id } = await req.json().catch(() => ({}));
  if (!model_id) {
    return NextResponse.json({ error: "model_id required" }, { status: 400 });
  }

  const success = await rollbackToVersion(model_id);
  if (!success) {
    return NextResponse.json({ error: "Rollback failed — model_id not found or invalid" }, { status: 404 });
  }

  const state = getModelState();
  return NextResponse.json({
    success:        true,
    restored_to:    model_id,
    current_version: state.version,
    ai_enabled:     state.ai_enabled,
    allow_sync:     state.allow_sync
  });
}
