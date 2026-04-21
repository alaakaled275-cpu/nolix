/**
 * NOLIX — Vector Search API (STEP 14 PART 10)
 * GET /api/vector/search?vector=0.1,0.2,...&store=example.com&limit=20
 * POST /api/vector/search { vector: [...], store: "...", limit: 20 }
 *
 * Returns nearest similar visitors with similarity scores.
 * Useful for:
 *   - Dashboard: "who is this visitor similar to?"
 *   - Model debugging: "is the embedding space correct?"
 *   - A/B analysis: "which cluster does this visitor belong to?"
 */

import { NextRequest, NextResponse } from "next/server";
import { findSimilarUsers, getVectorEngineStatus, normalizeVector } from "@/lib/nolix-vector-engine";
import { getCircuitStatus } from "@/lib/nolix-circuit-breaker";

function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  return key === process.env.NOLIX_SYNC_SECRET ||
         key === process.env.NOLIX_API_SECRET;
}

async function handleSearch(
  vectorRaw: number[] | string | null,
  store:     string | null,
  limit:     number,
  minSim:    number
) {
  // Parse vector
  let vector: number[];
  if (typeof vectorRaw === "string") {
    vector = vectorRaw.split(",").map(Number).filter(n => !isNaN(n));
  } else if (Array.isArray(vectorRaw)) {
    vector = vectorRaw.map(Number);
  } else {
    return { error: "vector is required (comma-separated 8 floats or JSON array)", status: 400 };
  }

  if (vector.length !== 8) {
    return { error: `vector must have exactly 8 dimensions. Got: ${vector.length}`, status: 400 };
  }

  const start = Date.now();
  const result = await findSimilarUsers(vector, store || undefined, limit, minSim);
  const engineStatus = await getVectorEngineStatus();
  const latencyMs = Date.now() - start;

  return {
    data: {
      query_vector:        normalizeVector(vector),
      mode:                result.mode,
      similar_users:       result.users,
      high_similarity:     result.high_similarity,
      cluster_size:        result.cluster_size,
      avg_similarity:      result.avg_similarity,
      similarity_boost:    result.boost,
      latency_ms:          latencyMs,
      engine:              engineStatus,
    },
    status: 200
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vectorRaw = searchParams.get("vector");
  const store     = searchParams.get("store");
  const limit     = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const minSim    = parseFloat(searchParams.get("min_similarity") || "0.60");

  const { data, error, status } = await handleSearch(vectorRaw, store, limit, minSim) as any;
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body       = await req.json().catch(() => ({}));
  const vectorRaw  = body.vector || null;
  const store      = body.store  || null;
  const limit      = Math.min(parseInt(body.limit || "20"), 100);
  const minSim     = parseFloat(body.min_similarity || "0.60");

  const { data, error, status } = await handleSearch(vectorRaw, store, limit, minSim) as any;
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
