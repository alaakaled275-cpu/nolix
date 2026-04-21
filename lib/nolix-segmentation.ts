/**
 * NOLIX — Segmentation Engine (STEP 15 PART 11)
 * lib/nolix-segmentation.ts
 *
 * K-Means clustering on visitor embeddings.
 * Segments visitors into meaningful behavioral clusters:
 *   - high_intent:      high conversion probability, cart active
 *   - price_sensitive:  hesitates, responds to discounts
 *   - loyal:            return visitor, high engagement
 *   - bouncer:          low engagement, exit intent
 *   - window_shopper:   high pages, low cart
 *
 * Runs asynchronously — does NOT block main decision flow.
 */

import { query }     from "./db";
import { logMetric } from "./nolix-metrics";

const FEATURE_DIM = 8;
const K           = 5;   // number of clusters

export type SegmentLabel =
  | "high_intent"
  | "price_sensitive"
  | "loyal"
  | "bouncer"
  | "window_shopper"
  | "unknown";

export interface Centroid {
  id:      number;
  label:   SegmentLabel;
  center:  number[];
  size:    number;
  properties: Record<string, number>;
}

export interface SegmentResult {
  visitor_id:    string;
  segment:       SegmentLabel;
  cluster_id:    number;
  distance:      number;
  confidence:    number;
  properties:    Record<string, number>;
}

// ── In-memory centroids ───────────────────────────────────────────────────────
let _centroids:       Centroid[] = [];
let _lastClusterRun   = 0;
const CLUSTER_INTERVAL = 6 * 60 * 60_000; // 6 hours

// ── Initialize default centroids (before real training) ───────────────────────
function _defaultCentroids(): Centroid[] {
  return [
    {
      id: 0, label: "high_intent",   size: 0, properties: {},
      center: [0.8, 0.8, 0.9, 1.0, 0.3, 0.5, 0.0, 0.8]   // long time, many pages, cart checkout
    },
    {
      id: 1, label: "price_sensitive", size: 0, properties: {},
      center: [0.6, 0.5, 0.5, 0.6, 0.9, 0.3, 0.6, 0.5]   // hesitates a lot, exit intent
    },
    {
      id: 2, label: "loyal", size: 0, properties: {},
      center: [0.9, 0.7, 0.8, 0.4, 0.2, 1.0, 0.0, 0.6]   // return visitor, long time
    },
    {
      id: 3, label: "bouncer", size: 0, properties: {},
      center: [0.1, 0.1, 0.1, 0.0, 0.1, 0.0, 0.8, 0.0]   // low everything, exit intent
    },
    {
      id: 4, label: "window_shopper", size: 0, properties: {},
      center: [0.5, 0.9, 0.7, 0.1, 0.4, 0.2, 0.2, 0.3]   // many pages, no cart
    }
  ];
}

// ── Euclidean distance ────────────────────────────────────────────────────────
function _euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

// ── Assign to nearest centroid ────────────────────────────────────────────────
function _assign(vector: number[], centroids: Centroid[]): { id: number; distance: number } {
  let bestId   = 0;
  let bestDist = Infinity;

  for (const c of centroids) {
    const dist = _euclidean(vector, c.center);
    if (dist < bestDist) { bestDist = dist; bestId = c.id; }
  }

  return { id: bestId, distance: bestDist };
}

// ── K-Means Training ──────────────────────────────────────────────────────────
export async function runKMeansClustering(maxIter = 20): Promise<Centroid[]> {
  const now = Date.now();
  if (now - _lastClusterRun < CLUSTER_INTERVAL && _centroids.length > 0) return _centroids;
  _lastClusterRun = now;

  console.log("📊 SEGMENTATION: Starting K-Means clustering...");

  try {
    // Load embeddings from DB
    const rows = await query<any>(`
      SELECT visitor_id, vector_8d, vector_native
      FROM nolix_embeddings
      WHERE vector_8d IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 5000
    `);

    const vectors: Array<{ visitor_id: string; v: number[] }> = [];
    for (const row of rows as any[]) {
      try {
        const raw = row.vector_native || row.vector_8d;
        const v: number[] = typeof raw === "string"
          ? JSON.parse(raw.replace(/[[\]]/g, "").split(",").map(Number).toString())
              .split ? JSON.parse(raw) : raw.replace(/[[\]]/g,"").split(",").map(Number)
          : raw;
        if (Array.isArray(v) && v.length === FEATURE_DIM && v.every(n => isFinite(n))) {
          vectors.push({ visitor_id: row.visitor_id, v });
        }
      } catch {}
    }

    if (vectors.length < K * 5) {
      console.log("⏭ SEGMENTATION: Insufficient data for K-Means. Using defaults.");
      _centroids = _defaultCentroids();
      return _centroids;
    }

    // K-Means++ initialization
    const initCenters: number[][] = [vectors[0].v];
    for (let k = 1; k < K; k++) {
      const dists = vectors.map(v => Math.min(...initCenters.map(c => _euclidean(v.v, c))));
      const sum   = dists.reduce((a, b) => a + b, 0);
      let   r     = Math.random() * sum;
      for (let i = 0; i < dists.length; i++) {
        r -= dists[i];
        if (r <= 0) { initCenters.push(vectors[i].v); break; }
      }
      if (initCenters.length <= k) initCenters.push(vectors[Math.floor(Math.random() * vectors.length)].v);
    }

    let centers = initCenters;

    // Iteration
    for (let iter = 0; iter < maxIter; iter++) {
      const newCenters: number[][] = new Array(K).fill(null).map(() => new Array(FEATURE_DIM).fill(0));
      const counts:    number[]    = new Array(K).fill(0);

      for (const { v } of vectors) {
        const dists = centers.map(c => _euclidean(v, c));
        const best  = dists.indexOf(Math.min(...dists));
        counts[best]++;
        for (let d = 0; d < FEATURE_DIM; d++) newCenters[best][d] += v[d];
      }

      let converged = true;
      for (let k = 0; k < K; k++) {
        if (counts[k] === 0) continue;
        const updated = newCenters[k].map(s => s / counts[k]);
        if (centers[k].some((v, i) => Math.abs(v - updated[i]) > 0.001)) converged = false;
        centers[k] = updated;
      }

      if (converged) { console.log(`📊 SEGMENTATION: Converged at iter ${iter}`); break; }
    }

    // Build centroid objects
    const tempCentroids: Centroid[] = centers.map((c, i) => ({
      id: i, center: c, size: 0, label: "unknown" as SegmentLabel, properties: {}
    }));

    // Assign all vectors to centroids for sizes
    for (const { v } of vectors) {
      const { id } = _assign(v, tempCentroids);
      tempCentroids[id].size++;
    }

    // Label centroids by their center characteristics
    _centroids = tempCentroids.map(c => ({
      ...c,
      label:      _labelCentroid(c.center),
      properties: _centroidProperties(c.center)
    }));

    // Persist clusters to DB
    await _persistClusters(_centroids, vectors).catch(() => {});

    console.log(`✅ SEGMENTATION: K-Means done. ${vectors.length} visitors → ${K} clusters`);
    await logMetric("segmentation_run", vectors.length, { k: K }).catch(() => {});

    return _centroids;
  } catch(e) {
    console.error("❌ SEGMENTATION: K-Means failed:", e);
    _centroids = _defaultCentroids();
    return _centroids;
  }
}

// ── Label centroid by its feature profile ────────────────────────────────────
function _labelCentroid(center: number[]): SegmentLabel {
  const [time, pages, scroll, cart, hesitations, returnV, exitIntent, ctaHover] = center;

  if (cart >= 0.7 && (time >= 0.6 || ctaHover >= 0.6))     return "high_intent";
  if (hesitations >= 0.6 && exitIntent >= 0.4)              return "price_sensitive";
  if (returnV >= 0.5 && time >= 0.6)                        return "loyal";
  if (time <= 0.2 && pages <= 0.2)                          return "bouncer";
  if (pages >= 0.6 && cart <= 0.2)                          return "window_shopper";
  return "unknown";
}

function _centroidProperties(center: number[]): Record<string, number> {
  return {
    avg_time:        Math.round(center[0] * 120),
    avg_pages:       Math.round(center[1] * 10),
    avg_scroll:      Math.round(center[2] * 100),
    cart_rate:       Math.round(center[3] * 100) / 100,
    hesitation_rate: Math.round(center[4] * 100) / 100,
    return_rate:     Math.round(center[5] * 100) / 100,
    exit_intent_rate: Math.round(center[6] * 100) / 100
  };
}

// ── Segment a visitor ─────────────────────────────────────────────────────────
export async function segmentVisitor(
  visitorId: string,
  vector:    number[]
): Promise<SegmentResult> {
  if (_centroids.length === 0) await runKMeansClustering();
  const centroids = _centroids.length > 0 ? _centroids : _defaultCentroids();

  const { id, distance } = _assign(vector, centroids);
  const centroid          = centroids[id];

  // Confidence: inversely proportional to distance (normalized 0-1)
  const maxDistance  = Math.sqrt(FEATURE_DIM); // max possible distance in unit hypercube
  const confidence   = Math.max(0, 1 - distance / maxDistance);

  // Persist visitor segment
  await query(
    `INSERT INTO nolix_visitor_segments (visitor_id, segment, cluster_id, confidence, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (visitor_id) DO UPDATE SET
       segment=EXCLUDED.segment, cluster_id=EXCLUDED.cluster_id,
       confidence=EXCLUDED.confidence, updated_at=NOW()`,
    [visitorId, centroid.label, id, confidence]
  ).catch(() => {});

  return {
    visitor_id: visitorId, segment: centroid.label, cluster_id: id,
    distance:   Math.round(distance * 10000) / 10000,
    confidence: Math.round(confidence * 10000) / 10000,
    properties: centroid.properties
  };
}

// ── Get segment distribution ──────────────────────────────────────────────────
export async function getSegmentDistribution(): Promise<Array<{
  segment: string; count: number; pct: number;
}>> {
  try {
    const rows = await query<any>(`
      SELECT segment, COUNT(*) as cnt,
             ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
      FROM nolix_visitor_segments
      GROUP BY segment ORDER BY cnt DESC
    `);
    return (rows as any[]).map(r => ({ segment: r.segment, count: Number(r.cnt), pct: Number(r.pct) }));
  } catch { return []; }
}

// ── Persist clusters ──────────────────────────────────────────────────────────
async function _persistClusters(centroids: Centroid[], vectors: Array<{ visitor_id: string; v: number[] }>): Promise<void> {
  for (const { visitor_id, v } of vectors.slice(0, 1000)) {
    const { id, distance } = _assign(v, centroids);
    const centroid = centroids[id];
    const confidence = Math.max(0, 1 - distance / Math.sqrt(FEATURE_DIM));
    await query(
      `INSERT INTO nolix_visitor_segments (visitor_id, segment, cluster_id, confidence, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (visitor_id) DO UPDATE SET segment=$2, cluster_id=$3, confidence=$4, updated_at=NOW()`,
      [visitor_id, centroid.label, id, confidence]
    ).catch(() => {});
  }
}
