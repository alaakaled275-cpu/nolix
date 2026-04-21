/**
 * NOLIX — Segmentation API (STEP 15 PART 11)
 * app/api/admin/segments/route.ts
 *
 * GET  — cluster distribution
 * POST — run K-Means clustering
 */
import { NextRequest, NextResponse }                 from "next/server";
import { runKMeansClustering, getSegmentDistribution } from "@/lib/nolix-segmentation";
import { getAccessTier, requireTier, getClientId }  from "@/lib/nolix-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const distribution = await getSegmentDistribution();
  return NextResponse.json({ distribution, k: 5, segments: ["high_intent","price_sensitive","loyal","bouncer","window_shopper"] });
}

export async function POST(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const centroids    = await runKMeansClustering();
  const distribution = await getSegmentDistribution();
  return NextResponse.json({ centroids: centroids.map(c => ({ id: c.id, label: c.label, size: c.size, properties: c.properties })), distribution, ok: true });
}
