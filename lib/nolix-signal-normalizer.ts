/**
 * NOLIX — Signal Normalizer (Pre-Step 16 PART 1)
 * lib/nolix-signal-normalizer.ts
 *
 * Converts ANY raw input (from Shopify webhook, browser event,
 * API call, or legacy format) into NolixSignalV1.
 *
 * Rules:
 *   1. Resolves field aliases (time_on_site → time_on_page)
 *   2. Applies type coercion (string → number)
 *   3. Clamps values to valid ranges
 *   4. Fills defaults for optional fields
 *   5. NEVER throws — returns best-effort normalized signal
 */

import { NolixSignalV1, FIELD_ALIASES, SIGNAL_SCHEMA_VERSION } from "./nolix-signal-schema";

// ── Resolve a field with aliases ──────────────────────────────────────────────
function resolveField<T>(
  raw:      Record<string, any>,
  primary:  keyof NolixSignalV1,
  fallback: T
): T {
  // Try primary key first
  if (raw[primary] !== undefined && raw[primary] !== null) {
    return raw[primary] as T;
  }
  // Try aliases
  const aliases = FIELD_ALIASES[primary] || [];
  for (const alias of aliases) {
    if (raw[alias] !== undefined && raw[alias] !== null) {
      return raw[alias] as T;
    }
  }
  return fallback;
}

// ── Safe coercions ────────────────────────────────────────────────────────────
function safeNum(val: any, def: number, min: number, max: number): number {
  const n = Number(val);
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function safeBool(val: any, def: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes" || lower === "checkout") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  if (typeof val === "number") return val !== 0;
  return def;
}

function safeStr(val: any, def: string, maxLen: number = 256): string {
  if (val === null || val === undefined) return def;
  return String(val).trim().substring(0, maxLen) || def;
}

// ── MAIN NORMALIZER ───────────────────────────────────────────────────────────
export function normalizeSignal(raw: Record<string, any>): NolixSignalV1 {
  return {
    // Identity
    visitor_id:   safeStr(resolveField(raw, "visitor_id",  ""), "",   128),
    session_id:   safeStr(resolveField(raw, "session_id",  ""), "",   128),
    store_domain: safeStr(resolveField(raw, "store_domain",""), "",   128),

    // Behavioral (with range clamping)
    time_on_page:     safeNum(resolveField(raw, "time_on_page",  0),     0, 0,    3600),
    page_views:       safeNum(resolveField(raw, "page_views",    0),     0, 0,    200),
    scroll_depth:     safeNum(resolveField(raw, "scroll_depth",  0),     0, 0.0,  1.0),
    clicks:           safeNum(resolveField(raw, "clicks",        0),     0, 0,    500),
    product_views:    safeNum(resolveField(raw, "product_views", 0),     0, 0,    100),
    checkout_started: safeBool(resolveField(raw, "checkout_started", false), false),

    // Meta
    timestamp:      safeNum(resolveField(raw, "timestamp", Date.now()), Date.now(), 0, Infinity),
    schema_version: SIGNAL_SCHEMA_VERSION
  };
}

// ── Batch normalizer ──────────────────────────────────────────────────────────
export function normalizeSignalBatch(raws: Record<string, any>[]): NolixSignalV1[] {
  return raws.map(r => normalizeSignal(r));
}

// ── Convert NolixSignalV1 → 8D feature vector (ONLINE/OFFLINE PARITY) ─────────
// Canonical mapping — SAME as featureMapToVector in nolix-feature-store-v2.ts
export function signalToFeatureVector(signal: NolixSignalV1): number[] {
  return [
    Math.min(1.0, signal.time_on_page  / 120),   // [0] time normalized to 2 min
    Math.min(1.0, signal.page_views    / 10),     // [1] pages normalized to 10
    Math.min(1.0, signal.scroll_depth),           // [2] already 0-1
    signal.checkout_started ? 1.0 : Math.min(1.0, signal.product_views / 5) * 0.3, // [3] cart intent
    Math.min(1.0, signal.clicks        / 20),     // [4] clicks as hesitation proxy
    0,                                            // [5] return_visitor (needs session history)
    0,                                            // [6] exit_intent (needs browser signals)
    Math.min(1.0, signal.clicks        / 10)      // [7] CTA hover proxy
  ];
}

// ── Diff old vs new signal (for debugging) ────────────────────────────────────
export function diffSignals(a: Partial<NolixSignalV1>, b: Partial<NolixSignalV1>): Record<string, { before: any; after: any }> {
  const diff: Record<string, { before: any; after: any }> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a as any)[k] !== (b as any)[k]) {
      diff[k] = { before: (a as any)[k], after: (b as any)[k] };
    }
  }
  return diff;
}
