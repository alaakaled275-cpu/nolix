/**
 * NOLIX — Feature Store API (STEP 15 PART 3 + 7)
 * app/api/features/route.ts
 *
 * GET  /api/features?visitor_id=xxx
 * GET  /api/features?visitor_id=xxx&at_time=2024-01-01T00:00:00Z
 * POST /api/features  { visitor_id, features, session_id, store, label }
 *
 * Full feature pipeline:
 *   raw event → validate (data contract) → normalize → store → serve
 */
import { NextRequest, NextResponse }                    from "next/server";
import {
  storeFeatureSnapshot, getLatestFeatures, getFeatureAtTime,
  featureMapToVector, validateFeatures, SCHEMA_VERSION
} from "@/lib/nolix-feature-store-v2";
import { getAccessTier, requireTier, checkRateLimit, getClientId, sanitizeString } from "@/lib/nolix-security";
import { runEmbeddingPipeline } from "@/lib/nolix-vector-engine";
import { segmentVisitor }       from "@/lib/nolix-segmentation";

export const dynamic = "force-dynamic";

// ── GET — retrieve features ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const visitorId = sanitizeString(searchParams.get("visitor_id") || "", 128);
  const atTime    = searchParams.get("at_time");

  if (!visitorId) return NextResponse.json({ error: "visitor_id required" }, { status: 400 });

  // Point-in-time OR latest
  const features = atTime
    ? await getFeatureAtTime(visitorId, new Date(atTime))
    : await getLatestFeatures(visitorId);

  if (!features) {
    return NextResponse.json({ visitor_id: visitorId, features: null, vector: null, found: false });
  }

  // Convert to ML vector (online/offline parity)
  const vector = featureMapToVector(features);

  return NextResponse.json({
    visitor_id:     visitorId,
    features,
    vector,
    schema_version: SCHEMA_VERSION,
    at_time:        atTime || "latest",
    found:          true
  });
}

// ── POST — ingest features (full pipeline) ────────────────────────────────────
export async function POST(req: NextRequest) {
  const key      = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  const tier     = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl       = checkRateLimit(clientId, "predict");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded", reset_at: rl.reset_at }, { status: 429 });

  const body       = await req.json().catch(() => ({}));
  const visitorId  = sanitizeString(body.visitor_id || "", 128);
  const sessionId  = sanitizeString(body.session_id || "", 128);
  const store      = sanitizeString(body.store || "", 128);
  const features   = body.features || {};
  const label: number | undefined = body.label !== undefined ? Number(body.label) : undefined;

  if (!visitorId) return NextResponse.json({ error: "visitor_id required" }, { status: 400 });

  // PART 13: DATA CONTRACT VALIDATION — reject invalid events
  const validation = validateFeatures(features);
  if (!validation.valid) {
    return NextResponse.json({
      error:    "DATA_CONTRACT_VIOLATION",
      details:  "Required features missing or invalid. Event rejected.",
      errors:   validation.errors,
      warnings: validation.warnings
    }, { status: 422 });
  }

  // Store feature snapshot (point-in-time)
  const stored = await storeFeatureSnapshot(visitorId, features, label, sessionId, store);

  // Run embedding pipeline (normalize → store → return similarity boost)
  const vector  = featureMapToVector(features);
  const embeddingResult = await runEmbeddingPipeline(visitorId, vector, store).catch(() => null);

  // Run segmentation (async, non-blocking)
  const segmentResult = await segmentVisitor(visitorId, vector).catch(() => null);

  return NextResponse.json({
    ok:             stored,
    visitor_id:     visitorId,
    vector,
    schema_version: SCHEMA_VERSION,
    warnings:       validation.warnings,
    embedding:      embeddingResult ? {
      mode:  (embeddingResult as any).mode  ?? "unknown",
      boost: (embeddingResult as any).boost ?? 0
    } : null,
    segment:        segmentResult   ? { segment: segmentResult.segment, confidence: segmentResult.confidence } : null,
    pipeline_steps: ["validate", "store", "embed", "segment"]
  });
}
