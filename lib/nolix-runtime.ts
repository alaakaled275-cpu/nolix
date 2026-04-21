/**
 * NOLIX — Runtime Control System (STEP 12 PART 7)
 * lib/nolix-runtime.ts
 *
 * System-wide feature flags. Any component can be disabled instantly
 * without redeployment or code changes.
 *
 * Flags are: loaded from DB on boot, cached in-memory, updatable via API.
 *
 * Default flags:
 *   ai_enabled        — if false, no popups shown anywhere
 *   training_enabled  — if false, no online/batch training runs
 *   embedding_enabled — if false, no vector updates/searches
 *   ab_test_enabled   — if false, all visitors treated as ML group
 *   coupons_enabled   — if false, coupon generation blocked
 *   webhooks_enabled  — if false, Shopify webhooks silently ignored
 */

import { query } from "./db";

// ============================================================
// FLAG TYPES
// ============================================================
export interface RuntimeFlags {
  ai_enabled:         boolean;
  training_enabled:   boolean;
  embedding_enabled:  boolean;
  ab_test_enabled:    boolean;
  coupons_enabled:    boolean;
  webhooks_enabled:   boolean;
  maintenance_mode:   boolean;  // if true: all APIs return 503
  updated_by:         string;
  updated_at:         number;
}

// In-memory flags (populated from DB, default to all-on)
let _flags: RuntimeFlags = {
  ai_enabled:         true,
  training_enabled:   true,
  embedding_enabled:  true,
  ab_test_enabled:    true,
  coupons_enabled:    true,
  webhooks_enabled:   true,
  maintenance_mode:   false,
  updated_by:         "system_default",
  updated_at:         Date.now()
};

let _loaded = false;

// ============================================================
// LOAD FLAGS FROM DB
// ============================================================
export async function loadRuntimeFlags(): Promise<RuntimeFlags> {
  if (_loaded) return { ..._flags };
  try {
    const rows = await query<any>(
      `SELECT key, value FROM nolix_runtime_flags ORDER BY key`
    );
    for (const row of rows as any[]) {
      const k = row.key as keyof RuntimeFlags;
      if (k in _flags) {
        if (typeof (_flags as any)[k] === "boolean") {
          (_flags as any)[k] = row.value === "true" || row.value === true;
        } else {
          (_flags as any)[k] = row.value;
        }
      }
    }
    _loaded = true;
    console.log("⚙ RUNTIME FLAGS loaded from DB:", JSON.stringify(_flags));
  } catch(e) { console.warn("⚠ RUNTIME: Could not load flags. Using defaults.", e); }
  return { ..._flags };
}

// ============================================================
// GET FLAGS (sync, returns cached)
// ============================================================
export function getFlags(): RuntimeFlags {
  return { ..._flags };
}

// Convenience accessors (zero-overhead for callers)
export const flags = {
  get aiEnabled():        boolean { return _flags.ai_enabled; },
  get trainingEnabled():  boolean { return _flags.training_enabled; },
  get embeddingEnabled(): boolean { return _flags.embedding_enabled; },
  get abTestEnabled():    boolean { return _flags.ab_test_enabled; },
  get couponsEnabled():   boolean { return _flags.coupons_enabled; },
  get webhooksEnabled():  boolean { return _flags.webhooks_enabled; },
  get maintenanceMode():  boolean { return _flags.maintenance_mode; }
};

// ============================================================
// UPDATE A FLAG (runtime — takes effect immediately)
// ============================================================
export async function setFlag(
  key:       keyof RuntimeFlags,
  value:     boolean,
  updatedBy: string = "admin"
): Promise<boolean> {
  if (!(key in _flags)) { console.error("⚠ RUNTIME: Unknown flag:", key); return false; }

  // Apply in-memory immediately (zero latency)
  (_flags as any)[key]  = value;
  _flags.updated_by     = updatedBy;
  _flags.updated_at     = Date.now();

  // Log the action
  console.log(`⚙ RUNTIME FLAG SET: ${key}=${value} by ${updatedBy}`);

  // Persist to DB
  try {
    await query(
      `INSERT INTO nolix_runtime_flags (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value=$2, updated_by=$3, updated_at=NOW()`,
      [key, String(value), updatedBy]
    );

    // Audit log
    await query(
      `INSERT INTO nolix_runtime_audit
       (flag_key, old_value, new_value, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [key, !value, value, updatedBy]
    ).catch(() => {});

  } catch(e) { console.warn("⚠ RUNTIME: DB persist failed:", e); }

  return true;
}

// ============================================================
// BULK UPDATE FLAGS (for admin panel)
// ============================================================
export async function setFlags(
  updates:   Partial<Record<keyof RuntimeFlags, boolean>>,
  updatedBy: string = "admin"
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(updates)) {
    results[k] = await setFlag(k as keyof RuntimeFlags, v as boolean, updatedBy);
  }
  return results;
}

// ============================================================
// MAINTENANCE MODE GUARD (for API routes)
// ============================================================
export function maintenanceGuard(): Response | null {
  if (_flags.maintenance_mode) {
    return Response.json({
      error:   "NOLIX system is in maintenance mode",
      code:    "MAINTENANCE_MODE",
      message: "AI features are temporarily unavailable. Check back soon."
    }, { status: 503 });
  }
  return null;
}

// ============================================================
// RESET ALL FLAGS TO DEFAULTS
// ============================================================
export async function resetFlags(updatedBy: string = "admin"): Promise<void> {
  const defaults: Partial<RuntimeFlags> = {
    ai_enabled: true, training_enabled: true, embedding_enabled: true,
    ab_test_enabled: true, coupons_enabled: true, webhooks_enabled: true,
    maintenance_mode: false
  };
  await setFlags(defaults as any, updatedBy);
  console.log("⚙ RUNTIME FLAGS: Reset to defaults by", updatedBy);
}

// ============================================================
// GET SINGLE FLAG LIVE FROM DB (STEP 13 PART 4)
// Always reads from DB — no cache — for distributed safety.
// Use in canTrain(), canEmbed() etc. before any destructive operation.
// ============================================================
export async function getRuntimeFlag(key: keyof RuntimeFlags): Promise<boolean> {
  try {
    const rows = await query<any>(
      "SELECT value FROM nolix_runtime_flags WHERE key=$1 LIMIT 1",
      [key]
    );
    const row = (rows as any[])[0];
    if (!row) return true; // default: enabled (fail-open for unknown flags)
    const val = row.value;
    return val === true || val === "true";
  } catch {
    // DB error → return in-memory value (fail-open)
    return (_flags as any)[key] ?? true;
  }
}

// ============================================================
// FORCE RELOAD FROM DB (for distributed instances)
// Bypasses _loaded cache — call before each decision in health-critical paths
// ============================================================
export async function forceLoadRuntimeFlags(): Promise<RuntimeFlags> {
  _loaded = false;
  return loadRuntimeFlags();
}
