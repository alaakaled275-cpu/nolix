/**
 * NOLIX — Unified Signal Schema (Pre-Step 16 PART 1)
 * lib/nolix-signal-schema.ts
 *
 * THE SINGLE SOURCE OF TRUTH for all signals flowing through NOLIX.
 * Every API, every command, every ML inference uses THIS schema.
 * No inconsistencies. No dual field names. No bypass.
 */

export const SIGNAL_SCHEMA_VERSION = "v1" as const;

// ── Core Signal Type ──────────────────────────────────────────────────────────
export type NolixSignalV1 = {
  // Identity (required)
  visitor_id:        string;
  session_id:        string;
  store_domain:      string;

  // Behavioral signals (all required, defaults enforced by normalizer)
  time_on_page:      number;   // seconds (0-3600)
  page_views:        number;   // integer (0-200)
  scroll_depth:      number;   // 0.0-1.0 (fraction of page)
  clicks:            number;   // integer (0-500)
  product_views:     number;   // integer (0-100)
  checkout_started:  boolean;  // hard intent signal

  // Meta
  timestamp:         number;   // Unix ms
  schema_version:    typeof SIGNAL_SCHEMA_VERSION;
};

// ── Extended Signal (enriched after processing) ───────────────────────────────
export type NolixSignalEnriched = NolixSignalV1 & {
  // Computed during processing
  feature_vector:    number[];       // 8D ML vector
  segment:           string;         // K-Means cluster label
  similarity_boost:  number;         // 0–0.15 from ANN search
  ml_probability:    number;         // P(convert) from hybrid engine
  fraud_score:       number;         // 0–1 bot/abuse probability
  intent_score:      number;         // final composite score
  enriched_at:       number;         // timestamp when enriched
};

// ── Command Result Envelope ───────────────────────────────────────────────────
export interface CommandResult<T = unknown> {
  version:    typeof SIGNAL_SCHEMA_VERSION;
  command:    string;
  ok:         boolean;
  result:     T;
  error?:     string;
  latency_ms: number;
  trace_id:   string;
}

// ── Allowed fields per command (for PART 7 unknown field rejection) ───────────
export const COMMAND_ALLOWED_FIELDS: Record<string, string[]> = {
  CMD_01_CLASSIFY_VISITOR: [
    "visitor_id", "session_id", "store_domain",
    "time_on_page", "page_views", "scroll_depth",
    "clicks", "product_views", "checkout_started", "timestamp"
  ],
  CMD_02_SCORE_INTENT: [
    "visitor_id", "session_id", "store_domain",
    "time_on_page", "page_views", "scroll_depth",
    "clicks", "product_views", "checkout_started",
    "coupon_abuse_severity", "visit_count", "timestamp"
  ],
  CMD_03_DECIDE_ACTION: [
    "visitor_id", "session_id", "store_domain",
    "time_on_page", "page_views", "scroll_depth",
    "clicks", "product_views", "checkout_started",
    "coupon_abuse_severity", "visit_count", "timestamp"
  ],
  CMD_04_EXPLAIN_DECISION: [
    "visitor_id", "trace_id", "decision_id"
  ],
  CMD_05_UPDATE_LABEL: [
    "visitor_id", "session_id", "store_domain",
    "label", "order_id", "revenue", "timestamp"
  ]
};

// ── Signal field aliases (for backward compatibility in normalizer) ────────────
export const FIELD_ALIASES: Record<keyof NolixSignalV1, string[]> = {
  visitor_id:        ["vid", "user_id", "uid"],
  session_id:        ["sid", "session"],
  store_domain:      ["store", "domain", "shop"],
  time_on_page:      ["time_on_site", "time_spent", "duration_s", "duration"],
  page_views:        ["pages_viewed", "num_pages", "views"],
  scroll_depth:      ["scroll", "scroll_pct", "scroll_percent"],
  clicks:            ["click_count", "num_clicks", "total_clicks"],
  product_views:     ["product_view_count", "pdp_views", "items_viewed"],
  checkout_started:  ["cart_status", "in_checkout", "started_checkout"],
  timestamp:         ["ts", "created_at", "event_time"],
  schema_version:    []
};
