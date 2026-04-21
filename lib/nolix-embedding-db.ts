/**
 * NOLIX — Embedding DB v2 (FIX 2 — pgvector Native + Fallback)
 * lib/nolix-embedding-db.ts
 *
 * ARCHITECTURE:
 * - PRIMARY:  pgvector native cosine similarity (<=> operator)
 *             Uses vector_native column (vector(8) type)
 *             ANN via IVFFlat index = sub-millisecond on millions of rows
 *
 * - FALLBACK: In-process exact cosine similarity (TEXT-based)
 *             Used when pgvector not installed (local dev)
 *             Loads last 500 rows + computes similarity in JS
 *
 * Auto-detection: tries pgvector at boot, sets _pgvectorAvailable flag.
 * Zero-config: works in both modes transparently.
 */

import { query } from "./db";

const MAX_VECTORS   = 100;
let _pgvectorAvailable: boolean | null = null; // null = not tested yet

// ============================================================
// DETECT pgvector AVAILABILITY (once at first call)
// ============================================================
async function isPgVectorAvailable(): Promise<boolean> {
  if (_pgvectorAvailable !== null) return _pgvectorAvailable;
  try {
    await query("SELECT '[1,2,3]'::vector(3)");
    _pgvectorAvailable = true;
    console.log("🟢 EMBEDDING: pgvector available — using native ANN search");
  } catch {
    _pgvectorAvailable = false;
    console.warn("🟡 EMBEDDING: pgvector not available — using JS fallback cosine search");
  }
  return _pgvectorAvailable;
}

// ============================================================
// MATH UTILITIES
// ============================================================
function computeCentroid(vectors: number[][]): number[] | null {
  if (!vectors.length) return null;
  const len    = vectors[0].length;
  const result = new Array(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len; i++) { result[i] += v[i] || 0; }
  }
  return result.map(x => Math.round((x / vectors.length) * 10000) / 10000);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag < 0.0001 ? 0 : Math.round((dot / (mag + 0.0001)) * 10000) / 10000;
}

function vectorToString(v: number[]): string {
  return "[" + v.map(x => (isNaN(x) ? "0" : x.toString())).join(",") + "]";
}

// ============================================================
// EMBEDDING DB — Full Vector Store (pgvector + fallback)
// ============================================================
export const embeddingDB = {

  // Store / update visitor embedding + centroid + native vector
  async store(visitorId: string, store: string, vector: number[], sessionId?: string): Promise<number[] | null> {
    const usePgVector = await isPgVectorAvailable();
    let existingVectors: number[][] = [];

    try {
      const rows = await query<any>(
        `SELECT vectors FROM nolix_embeddings WHERE visitor_id = $1 LIMIT 1`,
        [visitorId]
      );
      if (rows.length && (rows[0] as any).vectors) {
        existingVectors = JSON.parse((rows[0] as any).vectors) as number[][];
      }
    } catch { /* fresh start */ }

    existingVectors.push(vector);
    if (existingVectors.length > MAX_VECTORS) { existingVectors.shift(); }

    const centroid      = computeCentroid(existingVectors);
    const session_count = existingVectors.length;
    const vectorStr     = centroid ? vectorToString(centroid) : null;

    try {
      if (usePgVector && vectorStr) {
        // pgvector mode: store both JSON (history) + native vector (centroid)
        await query(
          `INSERT INTO nolix_embeddings
           (visitor_id, store, vectors, centroid, vector_native, session_count, last_updated, vector_8d)
           VALUES ($1, $2, $3, $4, $5::vector, $6, NOW(), $5)
           ON CONFLICT (visitor_id) DO UPDATE SET
             store=EXCLUDED.store, vectors=EXCLUDED.vectors,
             centroid=EXCLUDED.centroid, vector_native=EXCLUDED.vector_native,
             session_count=EXCLUDED.session_count, last_updated=NOW(),
             vector_8d=EXCLUDED.vector_8d`,
          [visitorId, store, JSON.stringify(existingVectors),
           JSON.stringify(centroid), vectorStr, session_count]
        );
      } else {
        // Fallback: TEXT-based storage
        await query(
          `INSERT INTO nolix_embeddings
           (visitor_id, store, vectors, centroid, vector_8d, session_count, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (visitor_id) DO UPDATE SET
             store=EXCLUDED.store, vectors=EXCLUDED.vectors,
             centroid=EXCLUDED.centroid, vector_8d=EXCLUDED.vector_8d,
             session_count=EXCLUDED.session_count, last_updated=NOW()`,
          [visitorId, store, JSON.stringify(existingVectors),
           JSON.stringify(centroid), vectorStr, session_count]
        );
      }
    } catch(e) { console.warn("⚠ EMBEDDING DB: store failed:", e); }

    return centroid;
  },

  // Get centroid for a visitor
  async getCentroid(visitorId: string): Promise<number[] | null> {
    try {
      const rows = await query<any>(
        `SELECT centroid FROM nolix_embeddings WHERE visitor_id = $1 LIMIT 1`,
        [visitorId]
      );
      if (rows.length && (rows[0] as any).centroid) {
        return JSON.parse((rows[0] as any).centroid) as number[];
      }
    } catch { /* silent */ }
    return null;
  },

  // ============================================================
  // SEARCH SIMILAR — pgvector ANN or JS fallback
  // ============================================================
  async searchSimilar(
    vector: number[],
    store?:  string,
    topK   = 10
  ): Promise<Array<{ visitor_id: string; similarity: number }>> {
    const usePgVector = await isPgVectorAvailable();
    const vectorStr   = vectorToString(vector);

    if (usePgVector) {
      // ── MODE A: NATIVE pgvector ANN (IVFFlat index) ──────────────────────────
      // <=> is cosine distance (0=identical, 2=opposite)
      // similarity = 1 - distance
      try {
        const whereClause = store ? "WHERE store=$2 AND vector_native IS NOT NULL" : "WHERE vector_native IS NOT NULL";
        const params: unknown[] = store ? [vectorStr, store, topK] : [vectorStr, topK];
        const rows = await query<any>(`
          SELECT visitor_id,
                 ROUND((1 - (vector_native <=> $1::vector))::numeric, 4) AS similarity
          FROM nolix_embeddings
          ${whereClause}
          ORDER BY vector_native <=> $1::vector
          LIMIT $${store ? 3 : 2}
        `, params);

        return (rows as any[])
          .filter(r => parseFloat(r.similarity) > 0.60)
          .map(r => ({ visitor_id: r.visitor_id, similarity: parseFloat(r.similarity) }));
      } catch(e) {
        console.warn("⚠ EMBEDDING: pgvector query failed, falling back to JS:", e);
      }
    }

    // ── MODE B: JS FALLBACK (exact cosine, last 500 rows) ────────────────────
    // Used when pgvector not installed (local dev / migration period)
    try {
      const whereClause = store ? "WHERE store=$2" : "";
      const params: unknown[] = store ? [500, store] : [500];
      const rows = await query<any>(
        `SELECT visitor_id, centroid FROM nolix_embeddings
         ${whereClause} ORDER BY last_updated DESC LIMIT $1`,
        params
      );

      return (rows as any[])
        .map((r: any) => {
          let centroid: number[];
          try { centroid = JSON.parse(r.centroid); } catch { return null; }
          return { visitor_id: r.visitor_id, similarity: cosineSimilarity(vector, centroid) };
        })
        .filter((r): r is { visitor_id: string; similarity: number } =>
          r !== null && r.similarity > 0.60
        )
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch(e) {
      console.warn("⚠ EMBEDDING DB: searchSimilar fallback failed:", e);
      return [];
    }
  },

  // Cluster classification
  async classify(
    visitorId:     string,
    currentVector: number[]
  ): Promise<"high_intent_cluster" | "mid_intent_cluster" | "cold_cluster" | "unknown"> {
    const centroid = await this.getCentroid(visitorId);
    if (!centroid) return "unknown";
    const sim = cosineSimilarity(currentVector, centroid);
    if (sim > 0.85) return "high_intent_cluster";
    if (sim > 0.65) return "mid_intent_cluster";
    return "cold_cluster";
  },

  // Get full profile
  async getProfile(visitorId: string): Promise<any | null> {
    try {
      const rows = await query(
        `SELECT visitor_id, store, centroid, session_count, last_updated
         FROM nolix_embeddings WHERE visitor_id = $1 LIMIT 1`,
        [visitorId]
      );
      return rows.length ? rows[0] : null;
    } catch { return null; }
  },

  // Get pgvector status (for dashboard)
  async getStatus(): Promise<{ pgvector_active: boolean; indexed_rows: number; mode: string; index_type: string }> {
    const pgv = await isPgVectorAvailable();
    let indexedRows = 0;
    if (pgv) {
      const r = await query<any>("SELECT COUNT(*) as cnt FROM nolix_embeddings WHERE vector_native IS NOT NULL").catch(() => []);
      indexedRows = Number((r as any[])[0]?.cnt) || 0;
    }
    return {
      pgvector_active: pgv,
      indexed_rows:    indexedRows,
      mode:            pgv ? "pgvector_ann" : "js_exact_cosine",
      index_type:      pgv ? "ivfflat (vector_cosine_ops)" : "none"
    };
  }
};
