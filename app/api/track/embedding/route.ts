/**
 * NOLIX — Global Embedding Registry (STEP 9.1)
 * POST /api/track/embedding
 *
 * LAYER 2 + LAYER 3: Enqueue embedding + compute centroid server-side.
 * Persists embeddings to PostgreSQL (replaces in-memory Map).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { enqueue, startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

const MAX_VECTORS = 100;

function computeCentroid(vectors: number[][]): number[] | null {
  if (!vectors || !vectors.length) return null;
  const len    = vectors[0].length;
  const result = new Array(len).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < len; i++) { result[i] += vec[i] || 0; }
  }
  return result.map(v => Math.round((v / vectors.length) * 10000) / 10000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitor_id, session_id, store, vector, timestamp } = body;

    if (!visitor_id || !Array.isArray(vector) || vector.length !== 7) {
      return NextResponse.json({ error: "Invalid payload: visitor_id + 7D vector required" }, { status: 400 });
    }

    // Load existing profile from DB (persistent, survives server restart)
    let existingVectors: number[][] = [];
    try {
      const rows = await query<{ vectors: string }>(
        `SELECT vectors FROM nolix_embeddings WHERE visitor_id = $1 LIMIT 1`,
        [visitor_id]
      );
      if (rows.length > 0 && (rows[0] as any).vectors) {
        existingVectors = JSON.parse((rows[0] as any).vectors) as number[][];
      }
    } catch(e) {
      console.warn("⚠ EMBEDDING: Could not load from DB. Using empty profile.");
    }

    // Append + FIFO decay
    existingVectors.push(vector);
    if (existingVectors.length > MAX_VECTORS) { existingVectors.shift(); }

    // Recompute centroid
    const centroid      = computeCentroid(existingVectors);
    const session_count = existingVectors.length;

    // Persist to DB (upsert)
    try {
      await query(
        `INSERT INTO nolix_embeddings (visitor_id, store, vectors, centroid, session_count, last_updated)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (visitor_id) DO UPDATE SET
           vectors       = EXCLUDED.vectors,
           centroid      = EXCLUDED.centroid,
           session_count = EXCLUDED.session_count,
           last_updated  = NOW()`,
        [visitor_id, store || "unknown", JSON.stringify(existingVectors), JSON.stringify(centroid), session_count]
      );
    } catch(e) {
      console.warn("⚠ EMBEDDING: DB upsert failed:", e);
    }

    // Also enqueue for event log (non-blocking)
    enqueue({
      type:       "embedding_updated",
      visitor_id,
      session_id,
      store:      store || "unknown",
      payload:    { vector, centroid, session_count },
      queued_at:  timestamp || Date.now()
    });

    console.log("🧠 EMBEDDING STORED (DB):", { visitor_id, session_count, centroid });

    // Return updated centroid to client for local sync
    return NextResponse.json({
      success:       true,
      visitor_id,
      centroid,
      session_count,
      last_updated:  Date.now()
    });

  } catch(err: any) {
    console.error("❌ /api/track/embedding ERROR:", err);
    return NextResponse.json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
}

// GET — retrieve centroid for a visitor (server-side decisions)
export async function GET(req: NextRequest) {
  const visitor_id = req.nextUrl.searchParams.get("visitor_id");
  if (!visitor_id) {
    return NextResponse.json({ error: "Missing visitor_id" }, { status: 400 });
  }
  try {
    const rows = await query<{ centroid: string; session_count: number; last_updated: string }>(
      `SELECT centroid, session_count, last_updated FROM nolix_embeddings WHERE visitor_id = $1 LIMIT 1`,
      [visitor_id]
    );
    if (!rows.length) {
      return NextResponse.json({ found: false, visitor_id });
    }
    const r = rows[0] as any;
    return NextResponse.json({
      found:         true,
      visitor_id,
      centroid:      JSON.parse(r.centroid),
      session_count: r.session_count,
      last_updated:  r.last_updated
    });
  } catch(e) {
    return NextResponse.json({ error: "DB read error" }, { status: 500 });
  }
}
