/**
 * NOLIX — Truth & Attribution Engine (STEP 10 LAYER 6)
 * lib/nolix-truth-engine.ts
 *
 * THE LAW: Only purchase_confirmed = 1.0
 * All other signals are WEAK and SUPPLEMENTARY.
 *
 * Responsibilities:
 * - Register truth events (purchases, checkouts) from webhooks
 * - Return correct label for any event type
 * - Queue training only for events that have truth weight
 * - Prevent duplicate truth registration
 */

import { query }          from "./db";
import { retryInsert }    from "./nolix-queue";
import { trainOnline }    from "./nolix-ml-engine";
import { featureStore }   from "./nolix-feature-store";

// ============================================================
// TRUTH HIERARCHY (immutable)
// This is the contract between events and learning signal.
// ============================================================
export const TRUTH_LABELS: Record<string, number> = {
  impression:          0.0,   // passive view — zero signal
  scroll_depth_25:     0.05,
  scroll_depth_50:     0.10,
  scroll_depth_75:     0.15,
  exit_intent:         0.0,   // negative signal (leaving)
  popup_shown:         0.0,   // we showed — means nothing
  popup_dismissed:     0.0,   // explicit rejection — train negatively
  click:               0.15,
  cta_click:           0.20,  // weak — they clicked, NOT purchased
  checkout_started:    0.60,  // strong signal — but not truth
  purchase_confirmed:  1.0    // THE ONLY GROUND TRUTH
};

export function getTruthLabel(eventType: string): number {
  return typeof TRUTH_LABELS[eventType] !== "undefined"
    ? TRUTH_LABELS[eventType]
    : 0;
}

// ============================================================
// TRUTH ENGINE — Registration + Attribution
// ============================================================
export const truthEngine = {

  // Register a truth event (purchase / checkout)
  // Called from webhook handler after HMAC verification
  async register(data: {
    visitor_id: string;
    event_type: string;
    store?:     string;
    order_id?:  string;
    value?:     string | number;
    meta?:      Record<string, unknown>;
  }): Promise<void> {
    const label = getTruthLabel(data.event_type);

    // Only process events that have non-zero truth signal
    if (label === 0 && data.event_type !== "popup_dismissed") {
      console.log("⏭ TRUTH ENGINE: Zero-signal event skipped:", data.event_type);
      return;
    }

    console.log("✅ TRUTH ENGINE: Registering:", data.event_type, "label:", label, "visitor:", data.visitor_id);

    // Persist truth event
    await retryInsert(
      `INSERT INTO nolix_truth_events
       (visitor_id, event_type, truth_label, order_id, store, value, meta, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (visitor_id, event_type, order_id) DO NOTHING`,
      [
        data.visitor_id, data.event_type, label,
        data.order_id || null, data.store || "unknown",
        String(data.value || "0"),
        JSON.stringify(data.meta || {})
      ],
      3, 500
    );

    // Load visitor features from DB for training
    const features = await featureStore.get(data.visitor_id);
    if (features) {
      const { featureToArray } = await import("./nolix-feature-store");
      const featureArr = featureToArray(features);
      // Train only if label is meaningful
      trainOnline(featureArr, label);
      console.log("🔁 TRUTH ENGINE: Online training triggered. label:", label);
    } else {
      console.warn("⚠ TRUTH ENGINE: No features found for visitor:", data.visitor_id, "— training skipped.");
    }

    // For confirmed purchases: update purchase signals (for client polling)
    if (data.event_type === "purchase_confirmed" && data.order_id) {
      await retryInsert(
        `INSERT INTO nolix_purchase_signals
         (visitor_id, order_id, truth_label, trained, confirmed_at)
         VALUES ($1, $2, 1.0, false, NOW())
         ON CONFLICT (visitor_id) DO UPDATE SET
           order_id     = EXCLUDED.order_id,
           truth_label  = EXCLUDED.truth_label,
           trained      = false,
           confirmed_at = NOW()`,
        [data.visitor_id, data.order_id],
        3, 300
      );
    }
  },

  // Attribution: which coupon/visitor gets credit for an order?
  // STEP 11 PART 9 — Attribution Window: only within 7 days of coupon issue
  async resolveVisitor(couponCode: string | null, shopifyCustomerId?: string | number): Promise<string | null> {
    // Try coupon first (most precise attribution)
    if (couponCode) {
      try {
        const rows = await query<{ visitor_id: string; issued_at: string }>(
          `SELECT visitor_id, issued_at FROM nolix_coupon_registry
           WHERE coupon_code = $1
             AND issued_at >= NOW() - INTERVAL '7 days'
           LIMIT 1`,
          [couponCode]
        );
        if (rows.length) {
          const r = rows[0] as any;
          console.log("🎯 TRUTH: Visitor resolved via coupon (7d window):", couponCode, "→", r.visitor_id);
          return r.visitor_id;
        }
        // Coupon found but outside attribution window
        const expired = await query<{ visitor_id: string }>(
          `SELECT visitor_id FROM nolix_coupon_registry WHERE coupon_code = $1 LIMIT 1`,
          [couponCode]
        );
        if (expired.length) {
          console.warn("⚠ TRUTH: Coupon outside 7-day attribution window:", couponCode, "— credit denied.");
        }
      } catch(e) { /* fallthrough */ }
    }

    // Fallback: Shopify customer ID mapping (weaker signal, no window)
    if (shopifyCustomerId) {
      return `shopify_${shopifyCustomerId}`;
    }

    return null;
  },

  // Get truth history for a visitor (for audit/debugging)
  async getHistory(visitorId: string): Promise<any[]> {
    try {
      return await query(
        `SELECT event_type, truth_label, order_id, registered_at
         FROM nolix_truth_events
         WHERE visitor_id = $1
         ORDER BY registered_at DESC LIMIT 20`,
        [visitorId]
      );
    } catch(e) { return []; }
  }
};
