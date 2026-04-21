/**
 * NOLIX — Vector Re-ranking + Hybrid Search (pgvector upgrade)
 * lib/nolix-hybrid-search.ts
 *
 * Solves "pgvector not enough alone":
 *   1. Hybrid Search: combines feature similarity + vector ANN
 *   2. Re-ranking: re-scores ANN results using full feature vector
 *   3. Segment-aware: same-segment users weighted higher
 *
 * This is the "second pass" after ANN gives top-N candidates.
 */

import { query }          from "./db";
import { featureMapToVector, FeatureMap } from "./nolix-feature-store-v2";

const FEATURE_DIM = 8;

export interface HybridSearchResult {
  visitor_id:      string;
  ann_score:       number;   // raw cosine similarity
  feature_score:   number;   // feature-level Euclidean similarity
  segment_bonus:   number;   // same-segment bonus
  reranked_score:  number;   // final fused score
  same_segment:    boolean;
  segment:         string;
}

// ── Cosine similarity (JS) ────────────────────────────────────────────────────
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

// ── Feature-level Euclidean similarity ───────────────────────────────────────
function euclideanSim(a: number[], b: number[]): number {
  const dist = Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  return 1 / (1 + dist); // inverse distance = similarity
}

// ── HYBRID SEARCH (PART 6 + vector re-ranking) ───────────────────────────────
export async function hybridSearch(
  queryVector:     number[],
  queryFeatureMap: FeatureMap,
  store?:          string,
  limit:           number = 20
): Promise<HybridSearchResult[]> {
  if (queryVector.length !== FEATURE_DIM) return [];

  const queryFeatures = featureMapToVector(queryFeatureMap);

  // Step 1: ANN search (top 3x candidates for re-ranking)
  const annLimit = Math.min(limit * 3, 60);
  let candidates: Array<{ visitor_id: string; vector: number[]; segment: string; ann_score: number }> = [];

  try {
    // Try pgvector first (production)
    const vectorStr = `[${queryVector.join(",")}]`;
    const whereStore = store ? "AND store=$2" : "";
    const params: any[] = store ? [vectorStr, store, annLimit] : [vectorStr, annLimit];

    const rows = await query<any>(`
      SELECT
        e.visitor_id,
        e.vector_native::TEXT AS vector_str,
        COALESCE(s.segment, 'unknown') AS segment,
        1 - (e.vector_native <=> $1::vector) AS cosine_sim
      FROM nolix_embeddings e
      LEFT JOIN nolix_visitor_segments s ON s.visitor_id = e.visitor_id
      WHERE e.vector_native IS NOT NULL ${whereStore}
      ORDER BY e.vector_native <=> $1::vector
      LIMIT ${params[params.length - 1] === annLimit ? "$" + params.length : annLimit}
    `, [...params.slice(0, -1), annLimit]);

    for (const row of rows as any[]) {
      try {
        const vStr   = String(row.vector_str || "").replace(/[[\]]/g, "");
        const vector = vStr.split(",").map(Number);
        if (vector.length === FEATURE_DIM && vector.every(isFinite)) {
          candidates.push({
            visitor_id: row.visitor_id,
            vector,
            segment:    row.segment || "unknown",
            ann_score:  Number(row.cosine_sim) || 0
          });
        }
      } catch {}
    }
  } catch {
    // Fallback: JS linear scan with stored vectors
    try {
      const rows = await query<any>(
        `SELECT visitor_id, vector_8d, COALESCE(segment, 'unknown') AS segment FROM nolix_embeddings e
         LEFT JOIN nolix_visitor_segments s USING (visitor_id)
         WHERE vector_8d IS NOT NULL ${store ? "AND store='" + store.replace(/'/g, "") + "'" : ""}
         LIMIT 300`
      );
      for (const row of rows as any[]) {
        try {
          const raw = String(row.vector_8d).replace(/[[\]]/g, "");
          const vector = raw.split(",").map(Number);
          if (vector.length === FEATURE_DIM && vector.every(isFinite)) {
            candidates.push({
              visitor_id: row.visitor_id, vector,
              segment:    row.segment || "unknown",
              ann_score:  cosineSim(queryVector, vector)
            });
          }
        } catch {}
      }
    } catch {}
  }

  if (candidates.length === 0) return [];

  // Step 2: Re-ranking with feature + segment awareness
  const visitorFeatures = await _getFeatureVectors(candidates.map(c => c.visitor_id));

  // Determine query segment
  const querySegment = await _getSegment(queryVector);

  const reranked: HybridSearchResult[] = candidates.map(c => {
    const featureVec   = visitorFeatures.get(c.visitor_id) || c.vector;
    const featureScore = euclideanSim(queryFeatures, featureVec);
    const sameSegment  = c.segment === querySegment;
    const segmentBonus = sameSegment ? 0.10 : 0;

    // Hybrid re-ranking formula:
    // 60% ANN cosine + 30% feature Euclidean + 10% segment bonus
    const rerankedScore = 0.60 * c.ann_score + 0.30 * featureScore + segmentBonus;

    return {
      visitor_id:     c.visitor_id,
      ann_score:      Math.round(c.ann_score    * 10000) / 10000,
      feature_score:  Math.round(featureScore   * 10000) / 10000,
      segment_bonus:  segmentBonus,
      reranked_score: Math.round(rerankedScore  * 10000) / 10000,
      same_segment:   sameSegment,
      segment:        c.segment
    };
  });

  // Sort by reranked score descending
  return reranked
    .sort((a, b) => b.reranked_score - a.reranked_score)
    .slice(0, limit);
}

// ── Load feature vectors for a batch of visitors ──────────────────────────────
async function _getFeatureVectors(visitorIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (visitorIds.length === 0) return result;

  try {
    const rows = await query<any>(`
      SELECT DISTINCT ON (visitor_id) visitor_id, features_json
      FROM nolix_feature_snapshots
      WHERE visitor_id = ANY($1)
      ORDER BY visitor_id, created_at DESC
    `, [visitorIds]);

    for (const row of rows as any[]) {
      try {
        const f = typeof row.features_json === "string" ? JSON.parse(row.features_json) : row.features_json;
        const { featureMapToVector: fmtv } = await import("./nolix-feature-store-v2");
        result.set(row.visitor_id, fmtv(f));
      } catch {}
    }
  } catch {}

  return result;
}

// ── Determine segment for query vector ────────────────────────────────────────
async function _getSegment(vector: number[]): Promise<string> {
  try {
    const { segmentVisitor } = await import("./nolix-segmentation");
    const r = await segmentVisitor("__query__", vector);
    return r.segment;
  } catch { return "unknown"; }
}

// ── Hybrid Search API summary ─────────────────────────────────────────────────
export function summarizeHybridSearch(results: HybridSearchResult[]): {
  total:         number;
  high_similarity: number;  // reranked_score > 0.75
  same_segment:  number;
  avg_score:     number;
  top_segments:  Record<string, number>;
} {
  const sameSegCount = results.filter(r => r.same_segment).length;
  const highSim      = results.filter(r => r.reranked_score > 0.75).length;
  const avgScore     = results.reduce((s, r) => s + r.reranked_score, 0) / (results.length || 1);

  const segCounts: Record<string, number> = {};
  results.forEach(r => { segCounts[r.segment] = (segCounts[r.segment] || 0) + 1; });

  return {
    total:           results.length,
    high_similarity: highSim,
    same_segment:    sameSegCount,
    avg_score:       Math.round(avgScore * 10000) / 10000,
    top_segments:    segCounts
  };
}
