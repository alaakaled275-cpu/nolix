/**
 * NOLIX — Feature Store (STEP 10 LAYER 3)
 * lib/nolix-feature-store.ts
 *
 * Centralized, versioned feature extraction and storage.
 * Solves: features scattered in memory → features in DB with versioning.
 * Used by: ML Engine (training), Embedding Engine (vectors), Decision API.
 */

import { query } from "./db";

// ============================================================
// FEATURE VECTOR TYPE
// 8 dimensions — normalized [0, 1]
// ============================================================
export interface FeatureVector {
  scroll:        number;  // scroll depth / 100
  clicks:        number;  // clamped click count / 5
  dwell:         number;  // time on page / 120
  hesitation:    number;  // hesitation score [0-1]
  engagement:    number;  // engagement score [0-1]
  recency:       number;  // 1 - days_since_last_visit / 30
  visit_loyalty: number;  // visit_count / 10
  trust:         number;  // 0 if abuse_severity >= 2, else 1
}

// ============================================================
// FEATURE EXTRACTION
// Raw event payload → normalized FeatureVector
// ============================================================
export function extractFeatures(event: Record<string, any>): FeatureVector {
  const tracking  = event.tracking || event.payload?.tracking || {};
  const visitor   = event.visitor  || event.payload?.visitor  || {};
  const now       = Date.now();
  const lastVisit = visitor.last_visit || now;
  const daysSince = Math.min((now - lastVisit) / (1000 * 60 * 60 * 24), 30);

  function clamp(v: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, isNaN(v) ? 0 : v));
  }

  return {
    scroll:        clamp((tracking.scroll_depth       || 0) / 100),
    clicks:        clamp((tracking.clicks?.length      || 0) / 5),
    dwell:         clamp((tracking.time_on_page        || 0) / 120),
    hesitation:    clamp(tracking.hesitation_score     || 0),
    engagement:    clamp(tracking.engagement_score     || 0),
    recency:       clamp(1 - daysSince / 30),
    visit_loyalty: clamp((visitor.visit_count          || 0) / 10),
    trust:         (visitor.coupon_abuse_severity || 0) >= 2 ? 0 : 1
  };
}

// Convert FeatureVector to array (for ML model consumption)
export function featureToArray(f: FeatureVector): number[] {
  return [f.scroll, f.clicks, f.dwell, f.hesitation, f.engagement, f.recency, f.visit_loyalty, f.trust];
}

// ============================================================
// FEATURE STORE — DB Layer
// ============================================================
export const featureStore = {
  // Upsert latest feature vector for a visitor
  async upsert(visitorId: string, store: string, features: FeatureVector, sessionId?: string): Promise<void> {
    try {
      await query(
        `INSERT INTO nolix_feature_store
         (visitor_id, store, session_id, scroll, clicks, dwell, hesitation, engagement, recency, visit_loyalty, trust, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, NOW())
         ON CONFLICT (visitor_id) DO UPDATE SET
           store         = EXCLUDED.store,
           session_id    = EXCLUDED.session_id,
           scroll        = EXCLUDED.scroll,
           clicks        = EXCLUDED.clicks,
           dwell         = EXCLUDED.dwell,
           hesitation    = EXCLUDED.hesitation,
           engagement    = EXCLUDED.engagement,
           recency       = EXCLUDED.recency,
           visit_loyalty = EXCLUDED.visit_loyalty,
           trust         = EXCLUDED.trust,
           version       = nolix_feature_store.version + 1,
           updated_at    = NOW()`,
        [visitorId, store, sessionId || null,
         features.scroll, features.clicks, features.dwell,
         features.hesitation, features.engagement, features.recency,
         features.visit_loyalty, features.trust]
      );
    } catch(e) {
      console.warn("⚠ FEATURE STORE: upsert failed:", e);
    }
  },

  // Load features for a visitor
  async get(visitorId: string): Promise<FeatureVector | null> {
    try {
      const rows = await query<FeatureVector>(
        `SELECT scroll, clicks, dwell, hesitation, engagement, recency, visit_loyalty, trust
         FROM nolix_feature_store WHERE visitor_id = $1 LIMIT 1`,
        [visitorId]
      );
      return rows.length ? rows[0] : null;
    } catch(e) {
      return null;
    }
  },

  // Get features for batch training (last N events with truth labels)
  async getBatchTrainingData(limit = 500): Promise<Array<{ features: number[]; label: number }>> {
    try {
      const rows = await query<any>(
        `SELECT fs.scroll, fs.clicks, fs.dwell, fs.hesitation, fs.engagement,
                fs.recency, fs.visit_loyalty, fs.trust,
                COALESCE(nc.truth_label, 0) as label
         FROM nolix_feature_store fs
         LEFT JOIN nolix_conversions nc ON nc.visitor_id = fs.visitor_id
         WHERE fs.updated_at > NOW() - INTERVAL '24 hours'
         ORDER BY fs.updated_at DESC
         LIMIT $1`,
        [limit]
      );
      return rows.map((r: any) => ({
        features: [
          Number(r.scroll), Number(r.clicks), Number(r.dwell),
          Number(r.hesitation), Number(r.engagement), Number(r.recency),
          Number(r.visit_loyalty), Number(r.trust)
        ],
        label: Number(r.label)
      }));
    } catch(e) {
      console.warn("⚠ FEATURE STORE: batch load failed:", e);
      return [];
    }
  }
};
