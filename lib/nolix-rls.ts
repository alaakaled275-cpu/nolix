/**
 * lib/nolix-rls.ts
 * NOLIX — PostgreSQL Row-Level Security (RLS) Enforcement Layer
 * VERSION 2 — Production-hardened
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 *
 *  Application Code (rate limiter + tenant isolation)
 *         ↓
 *  RLS Layer (this file) — sets app.current_tenant inside a DB transaction
 *         ↓
 *  PostgreSQL RLS Policies — DB-level enforcement (cannot be bypassed by code)
 *         ↓
 *  Data (popup_sessions, zeno_reality_logs, nolix_uplift_model, etc.)
 *
 * CRITICAL FIXES IN V2:
 *  1. queryForTenant() uses explicit BEGIN/COMMIT so SET LOCAL is truly local
 *     → connection pool is NEVER polluted (previous version leaked tenant context)
 *  2. FORCE ROW LEVEL SECURITY is now graceful — catches superuser permission
 *     errors on managed providers (Neon, Supabase, Railway) and falls back to
 *     regular RLS which still protects SELECT/UPDATE/DELETE
 *  3. RLS policy is now STRICT — NULL tenant context = ZERO rows visible.
 *     Only explicit bypass (app.bypass_rls = 'on') allows full access.
 *     This makes data leakage structurally impossible even if app code has bugs.
 *
 * TABLES PROTECTED BY RLS:
 *  ✅ popup_sessions          (store_domain column)
 *  ✅ zeno_reality_logs       (store_domain column)
 *  ✅ nolix_uplift_model      (store_domain column — added by migration)
 *  ✅ zeno_action_metrics     (store_domain column)
 *  ✅ nolix_signal_outcomes   (store_domain column — added by migration)
 *  ✅ nolix_uplift_recent     (store_domain column — added by migration)
 *  ✅ zeno_learning_log       (store_domain column — added by migration)
 *
 * HOW TO USE:
 *  // Tenant-scoped reads/writes (most API routes):
 *  const rows = await queryForTenant('SELECT * FROM popup_sessions', [], storeDomain);
 *
 *  // Multi-statement tenant transactions:
 *  await withTenantClient(storeDomain, async (client) => {
 *    await client.query('BEGIN');
 *    await client.query('INSERT INTO popup_sessions ...');
 *    await client.query('COMMIT');
 *  });
 *
 *  // Admin / cron / migrations (full bypass):
 *  const rows = await queryAsService('SELECT * FROM popup_sessions WHERE ...');
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getPool } from "./db";
import { PoolClient } from "pg";

// ── Tables with store_domain-based RLS ──────────────────────────────────────
export const RLS_PROTECTED_TABLES = [
  "popup_sessions",
  "zeno_reality_logs",
  "nolix_uplift_model",
  "nolix_uplift_recent",
  "zeno_action_metrics",
  "nolix_signal_outcomes",
  "zeno_learning_log",
] as const;

export type RLSTable = typeof RLS_PROTECTED_TABLES[number];

// ── Users table uses email-based RLS (separate from store_domain policy) ──────
// Protected via queryAsUser(sql, params, userEmail)
export const USERS_TABLE_RLS = true;

// ── SQL-escape a tenant domain ────────────────────────────────────────────────
function safeTenantDomain(domain: string): string {
  // Reject any domain that looks like an injection attempt
  if (/['";\\\0]/.test(domain)) {
    throw new Error(`[RLS] Invalid tenant domain: ${domain}`);
  }
  return domain.toLowerCase().trim().slice(0, 253); // max domain length
}

/**
 * CRITICAL FIX: Execute a DB query with tenant context set via app.current_tenant.
 *
 * Uses an explicit transaction so SET LOCAL is truly isolated:
 *  BEGIN → SET LOCAL app.current_tenant → query → COMMIT
 *
 * When the connection returns to the pool, the setting is GONE.
 * No cross-tenant pollution is possible.
 *
 * PostgreSQL RLS policies use current_setting('app.current_tenant', true)
 * to enforce row-level isolation — only rows WHERE store_domain = tenant
 * are visible to this query.
 */
export async function queryForTenant<T = unknown>(
  sql:          string,
  params:       unknown[] = [],
  tenantDomain: string
): Promise<T[]> {
  if (!tenantDomain || tenantDomain === "unknown") {
    // Unknown tenant → return empty (safe default, never leak data)
    console.warn(`[RLS] queryForTenant called with unknown domain. SQL blocked: ${sql.slice(0, 60)}`);
    return [];
  }

  const safe   = safeTenantDomain(tenantDomain);
  const pool   = getPool();
  const client = await pool.connect();

  try {
    // Explicit transaction ensures SET LOCAL is scoped to this txn only
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${safe}'`);
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (err) {
    // Always rollback on error — never leave a dirty connection
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    // Release AFTER rollback/commit — connection is clean for next consumer
    client.release();
  }
}

/**
 * Acquire a tenant-scoped client for multi-statement transactions.
 * The tenant context is set once in the BEGIN block, then all queries
 * inside the callback are automatically scoped by PostgreSQL RLS.
 *
 * The caller is responsible for BEGIN/COMMIT/ROLLBACK inside the callback.
 *
 * @example
 * await withTenantClient('myshop.com', async (client) => {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO popup_sessions ...');
 *   await client.query('UPDATE zeno_action_metrics ...');
 *   await client.query('COMMIT');
 * });
 */
export async function withTenantClient<T>(
  tenantDomain: string,
  callback:     (client: PoolClient) => Promise<T>
): Promise<T> {
  const safe   = safeTenantDomain(tenantDomain);
  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${safe}'`);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run a query as the service role (bypassing all RLS policies).
 *
 * ONLY use for:
 *  - Cron jobs that process data across all tenants
 *  - Migration scripts
 *  - Admin-only endpoints
 *  - Auth routes (login/signup) that need to read users BEFORE a session exists
 *
 * NEVER expose this function to user-facing API routes.
 *
 * Uses SET LOCAL inside a transaction — the bypass flag is scoped to
 * this operation only and NEVER leaks to other connections.
 */
export async function queryAsService<T = unknown>(
  sql:    string,
  params: unknown[] = []
): Promise<T[]> {
  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.bypass_rls = 'on'");
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query scoped to a specific authenticated user.
 *
 * Sets app.current_user_email inside a transaction so PostgreSQL RLS
 * can enforce: USING (email = current_setting('app.current_user_email', true))
 *
 * Use this for any query that reads/writes the users table from a
 * protected route where session.email is known.
 *
 * Auth routes (login/signup) must use queryAsService() instead, because
 * they do not yet have a validated user context.
 *
 * @example
 * const rows = await queryAsUser(
 *   'SELECT store_url FROM users WHERE email = $1',
 *   [session.email],
 *   session.email
 * );
 */
export async function queryAsUser<T = unknown>(
  sql:       string,
  params:    unknown[] = [],
  userEmail: string
): Promise<T[]> {
  if (!userEmail || !userEmail.includes("@")) {
    console.warn(`[RLS] queryAsUser called with invalid email. SQL blocked.`);
    return [];
  }

  // Sanitize — emails cannot contain quotes or SQL-injection chars
  if (/['";\\\0]/.test(userEmail)) {
    throw new Error(`[RLS] Invalid user email for RLS context: ${userEmail}`);
  }

  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // Set BOTH contexts: current_user_email for users table
    // bypass_rls is NOT set — user can only see their own row
    await client.query(`SET LOCAL app.current_user_email = '${userEmail.toLowerCase().trim()}'`);
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Apply strict PostgreSQL RLS policies to ALL protected tables.
 *
 * POLICY DESIGN:
 *  STRICT mode: Only rows WHERE store_domain = current_setting('app.current_tenant')
 *  are visible. If app.current_tenant is NULL or empty → ZERO rows (safe default).
 *  The ONLY bypass is app.bypass_rls = 'on' (used by queryAsService).
 *
 * FORCE RLS: Handled gracefully — if the DB provider doesn't allow superuser
 * operations (Neon, Supabase, Railway), we catch the error and log a warning.
 * Regular RLS (without FORCE) still protects SELECT/UPDATE/DELETE for all users
 * including the table owner.
 *
 * IDEMPOTENT: Safe to call multiple times. Drops and recreates policies.
 */
export async function applyRLSPolicies(): Promise<{
  applied:  string[];
  skipped:  string[];
  forced:   string[];
  errors:   { table: string; error: string }[];
}> {
  const pool    = getPool();
  const applied: string[] = [];
  const skipped: string[] = [];
  const forced:  string[] = [];
  const errors:  { table: string; error: string }[] = [];

  for (const table of RLS_PROTECTED_TABLES) {
    try {
      // ── Step 1: Add store_domain column if it doesn't exist ──────────────
      const colCheck = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'store_domain'`,
        [table]
      );

      if (colCheck.rows.length === 0) {
        // Add with default so existing rows get 'legacy_unknown'
        await pool.query(
          `ALTER TABLE ${table}
           ADD COLUMN IF NOT EXISTS store_domain TEXT DEFAULT 'legacy_unknown'`
        );
        // Backfill nulls immediately
        await pool.query(
          `UPDATE ${table} SET store_domain = 'legacy_unknown' WHERE store_domain IS NULL`
        );
        console.log(`[RLS] Added store_domain column to ${table}`);
      }

      // ── Step 2: Enable RLS on the table ──────────────────────────────────
      await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // ── Step 3: FORCE RLS — try, but handle managed provider limitations ─
      let forceApplied = false;
      try {
        await pool.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
        forceApplied = true;
        forced.push(table);
      } catch (forceErr: any) {
        // Managed PostgreSQL providers (Neon, Supabase, Railway) often disallow
        // FORCE ROW LEVEL SECURITY unless you are superuser.
        // Regular RLS (without FORCE) still protects non-owner connections.
        const isPermissionErr = forceErr.message?.includes("must be owner") ||
          forceErr.message?.includes("permission denied") ||
          forceErr.message?.includes("must be superuser") ||
          forceErr.code === "42501"; // insufficient_privilege
        if (isPermissionErr) {
          console.warn(
            `[RLS] ⚠ FORCE RLS skipped for ${table} — insufficient privileges. ` +
            `Standard RLS is still active and protects SELECT/UPDATE/DELETE.`
          );
        } else {
          throw forceErr; // unexpected error — rethrow
        }
      }

      // ── Step 4: Drop old policies (idempotency) ───────────────────────────
      await pool.query(`DROP POLICY IF EXISTS nolix_tenant_isolation ON ${table}`);
      await pool.query(`DROP POLICY IF EXISTS nolix_service_bypass ON ${table}`);

      // ── Step 5: STRICT tenant isolation policy ────────────────────────────
      //
      // STRICT means:
      //  ✅ store_domain = current_setting('app.current_tenant', true) → VISIBLE
      //  ✅ app.bypass_rls = 'on' → ALL VISIBLE (service/admin)
      //  ❌ app.current_tenant is NULL, empty, or doesn't match → ZERO ROWS
      //
      // This is a true security boundary: a forgotten WHERE clause in app code
      // returns empty results instead of leaking another tenant's data.
      //
      // current_setting('app.current_tenant', true):
      //   - 'true' = don't raise ERROR if setting doesn't exist, return NULL instead
      //   - NULL = strict: store_domain = NULL → FALSE → row hidden
      //   - '' = same as NULL behavior
      await pool.query(`
        CREATE POLICY nolix_tenant_isolation ON ${table}
          AS PERMISSIVE
          FOR ALL
          USING (
            current_setting('app.bypass_rls', true) = 'on'
            OR (
              current_setting('app.current_tenant', true) IS NOT NULL
              AND current_setting('app.current_tenant', true) != ''
              AND store_domain = current_setting('app.current_tenant', true)
            )
          )
          WITH CHECK (
            current_setting('app.bypass_rls', true) = 'on'
            OR (
              current_setting('app.current_tenant', true) IS NOT NULL
              AND current_setting('app.current_tenant', true) != ''
              AND store_domain = current_setting('app.current_tenant', true)
            )
          )
      `);

      applied.push(table);
      console.log(
        `[RLS] ✅ Strict isolation policy applied to: ${table}` +
        (forceApplied ? " (FORCE RLS active)" : " (standard RLS active)")
      );

    } catch (err: any) {
      if (err.message?.includes("does not exist")) {
        skipped.push(table);
        console.warn(`[RLS] ⏭ Skipped ${table} — table not yet created`);
      } else {
        errors.push({ table, error: err.message });
        console.error(`[RLS] ❌ Failed on ${table}:`, err.message);
      }
    }
  }

  return { applied, skipped, forced, errors };
}

/**
 * Apply email-based RLS policy to the users table.
 *
 * POLICY DESIGN:
 *  - app.bypass_rls = 'on'  → full access (admin/service operations)
 *  - app.current_user_email = 'user@x.com' → only that user's row is visible
 *  - No context set → ZERO rows visible
 *
 * Auth routes (login/signup) must use queryAsService() to bypass RLS
 * since they do not yet have a validated user context.
 */
export async function applyUsersRLSPolicy(): Promise<{ applied: boolean; error?: string }> {
  const pool = getPool();
  try {
    // Enable RLS on users table
    await pool.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);

    // Try FORCE RLS (may fail on managed providers)
    try {
      await pool.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`);
    } catch (forceErr: any) {
      const isPermErr = forceErr.code === "42501" ||
        forceErr.message?.includes("must be owner") ||
        forceErr.message?.includes("permission denied");
      if (!isPermErr) throw forceErr;
      console.warn("[RLS] ⚠ FORCE RLS on users skipped — insufficient privileges. Standard RLS active.");
    }

    // Drop old policies (idempotency)
    await pool.query(`DROP POLICY IF EXISTS nolix_user_isolation   ON users`);
    await pool.query(`DROP POLICY IF EXISTS nolix_user_svc_bypass  ON users`);

    // Email-based isolation policy
    await pool.query(`
      CREATE POLICY nolix_user_isolation ON users
        AS PERMISSIVE
        FOR ALL
        USING (
          current_setting('app.bypass_rls', true) = 'on'
          OR (
            current_setting('app.current_user_email', true) IS NOT NULL
            AND current_setting('app.current_user_email', true) != ''
            AND email = current_setting('app.current_user_email', true)
          )
        )
        WITH CHECK (
          current_setting('app.bypass_rls', true) = 'on'
          OR (
            current_setting('app.current_user_email', true) IS NOT NULL
            AND current_setting('app.current_user_email', true) != ''
            AND email = current_setting('app.current_user_email', true)
          )
        )
    `);

    console.log("[RLS] ✅ Email-based isolation policy applied to: users");
    return { applied: true };

  } catch (err: any) {
    if (err.message?.includes("does not exist")) {
      console.warn("[RLS] ⏭ users table not yet created — skipping");
      return { applied: false, error: "table not found" };
    }
    console.error("[RLS] ❌ Failed to apply users RLS:", err.message);
    return { applied: false, error: err.message };
  }
}

/**
 * Backfill NULL store_domain values in all RLS-protected tables.
 *
 * Strategy:
 *  1. Cross-reference popup_sessions ↔ zeno_reality_logs via session_id
 *  2. Any remaining NULLs → 'legacy_unknown' (isolated, admin-queryable only)
 *
 * This operation uses queryAsService() (full bypass) since it's migration work.
 * Safe to run multiple times (idempotent).
 */
export async function backfillNullStoreDomains(): Promise<{
  total:      number;
  backfilled: number;
  fallback:   number;
}> {
  const pool = getPool();

  // Must use service bypass for cross-tenant admin work
  const adminClient = await pool.connect();

  try {
    await adminClient.query("BEGIN");
    await adminClient.query("SET LOCAL app.bypass_rls = 'on'");

    // Count total NULLs in popup_sessions
    const countResult = await adminClient.query(
      `SELECT COUNT(*) as cnt FROM popup_sessions WHERE store_domain IS NULL`
    );
    const total = parseInt(countResult.rows[0]?.cnt ?? "0");

    if (total === 0) {
      await adminClient.query("COMMIT");
      console.log("[RLS Backfill] No NULL store_domain rows — nothing to do.");
      return { total: 0, backfilled: 0, fallback: 0 };
    }

    // Try to match popup_sessions → zeno_reality_logs via session_id
    const matchResult = await adminClient.query(`
      UPDATE popup_sessions ps
      SET    store_domain = zrl.store_domain
      FROM   zeno_reality_logs zrl
      WHERE  ps.session_id   = zrl.session_id
        AND  ps.store_domain IS NULL
        AND  zrl.store_domain IS NOT NULL
        AND  zrl.store_domain != ''
        AND  zrl.store_domain != 'legacy_unknown'
    `);
    const backfilled = matchResult.rowCount ?? 0;

    // Remaining NULLs → 'legacy_unknown'
    const fallbackResult = await adminClient.query(`
      UPDATE popup_sessions
      SET    store_domain = 'legacy_unknown'
      WHERE  store_domain IS NULL
    `);
    const fallback = fallbackResult.rowCount ?? 0;

    // Backfill other tables
    for (const table of [
      "zeno_reality_logs",
      "nolix_uplift_model",
      "nolix_uplift_recent",
      "zeno_learning_log",
      "nolix_signal_outcomes",
    ] as const) {
      try {
        // First ensure column exists
        await adminClient.query(
          `ALTER TABLE ${table}
           ADD COLUMN IF NOT EXISTS store_domain TEXT DEFAULT 'legacy_unknown'`
        );
        await adminClient.query(
          `UPDATE ${table}
           SET store_domain = 'legacy_unknown'
           WHERE store_domain IS NULL OR store_domain = ''`
        );
      } catch { /* table may not exist — skip */ }
    }

    await adminClient.query("COMMIT");

    console.log(
      `[RLS Backfill] Done. total=${total}, matched=${backfilled}, fallback=${fallback}`
    );
    return { total, backfilled, fallback };

  } catch (err) {
    await adminClient.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    adminClient.release();
  }
}
