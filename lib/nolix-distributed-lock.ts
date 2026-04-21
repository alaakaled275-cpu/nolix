/**
 * NOLIX — Distributed Lock (STEP 14 PART 3)
 * lib/nolix-distributed-lock.ts
 *
 * Solves the race condition:
 *   Instance A sets ai_enabled=false
 *   Instance B reads stale memory → still serving decisions
 *
 * Solution: PostgreSQL Advisory Locks
 *   - Mutex across ALL instances sharing the same DB
 *   - Lock ID is deterministic per flag key
 *   - Automatic release on connection close
 *   - No deadlock possible (timeout-based)
 */

import { query } from "./db";

// ── Lock IDs (deterministic, never conflict with app queries) ────────────────
const LOCK_IDS: Record<string, number> = {
  "ai_enabled":        1001,
  "training_enabled":  1002,
  "embedding_enabled": 1003,
  "health_update":     1004,
  "circuit_breaker":   1005,
  "backlog_drain":     1006,
  "batch_train":       1007
};

function lockId(name: string): number {
  return LOCK_IDS[name] ?? Math.abs(name.split("").reduce((a, c) => a ^ c.charCodeAt(0), 0)) + 2000;
}

// ── TRY LOCK (non-blocking — returns false if already locked) ────────────────
export async function tryLock(name: string): Promise<boolean> {
  try {
    const id = lockId(name);
    const r = await query<any>("SELECT pg_try_advisory_lock($1) AS locked", [id]);
    return (r as any[])[0]?.locked === true;
  } catch(e) {
    console.warn("⚠ LOCK: tryLock failed for", name, e);
    return true; // fail-open: don't block operation on DB error
  }
}

// ── RELEASE LOCK ─────────────────────────────────────────────────────────────
export async function releaseLock(name: string): Promise<void> {
  try {
    await query("SELECT pg_advisory_unlock($1)", [lockId(name)]);
  } catch(e) { console.warn("⚠ LOCK: releaseLock failed for", name, e); }
}

// ── ACQUIRE + HOLD + RELEASE (with timeout) ──────────────────────────────────
// Uses pg_try_advisory_lock (non-blocking) by default.
// For blocking wait: use pg_advisory_lock (blocks until lock available).
// We use try-variant to prevent request stacking in serverless.
export async function withLock<T>(
  name:       string,
  fn:         () => Promise<T>,
  timeoutMs:  number = 5000
): Promise<T> {
  const id = lockId(name);
  let acquired = false;

  try {
    // SET lock_timeout (only applies to this session's next statement)
    await query(`SET LOCAL lock_timeout = '${timeoutMs}ms'`).catch(() => {});

    // pg_try_advisory_lock: non-blocking (returns false if already locked)
    // Alternative: pg_advisory_lock (blocking — waits up to lock_timeout)
    const r = await query<any>("SELECT pg_try_advisory_lock($1) AS locked", [id]);
    acquired = (r as any[])[0]?.locked === true;

    if (!acquired) {
      console.warn(`⚠ LOCK: [${name}] already locked by another instance. Skipping.`);
      throw new Error(`LOCK_SKIP:${name}`);
    }

    return await fn();
  } catch(e: any) {
    if (e.message?.startsWith("LOCK_SKIP:")) throw e;
    console.error(`❌ LOCK: [${name}] operation failed:`, e.message);
    throw e;
  } finally {
    if (acquired) {
      await query("SELECT pg_advisory_unlock($1)", [id]).catch(() => {});
    }
  }
}

// ── setFlag WITH DISTRIBUTED LOCK (replaces bare setFlag for critical flags) ──
export async function setFlagAtomic(
  key:       "ai_enabled" | "training_enabled" | "embedding_enabled",
  value:     boolean,
  updatedBy: string
): Promise<boolean> {
  const lockName = key;

  try {
    return await withLock(lockName, async () => {
      // DB write within lock — atomic across all instances
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

      console.log(`🔒 ATOMIC FLAG SET: ${key}=${value} by ${updatedBy}`);
      return true;
    }, 3000);
  } catch(e: any) {
    if (e.message?.startsWith("LOCK_SKIP:")) {
      console.warn(`⚠ setFlagAtomic [${key}]: skipped (lock contention)`);
      return false;
    }
    console.error(`❌ setFlagAtomic [${key}] failed:`, e.message);
    return false;
  }
}

// ── LOCK STATUS (for diagnostics) ────────────────────────────────────────────
export async function getLockStatus(): Promise<Array<{
  name: string; lock_id: number; is_locked: boolean;
}>> {
  try {
    const locked = await query<any>(
      "SELECT objid FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()"
    );
    const lockedIds = new Set((locked as any[]).map(r => Number(r.objid)));

    return Object.entries(LOCK_IDS).map(([name, id]) => ({
      name, lock_id: id, is_locked: lockedIds.has(id)
    }));
  } catch { return []; }
}
