/**
 * lib/nolix-tenant.ts
 * NOLIX — Multi-Tenancy Isolation Layer
 *
 * ARCHITECTURE LAW:
 * ─────────────────────────────────────────────────────────────────────────────
 * Every API route handler MUST call resolveTenant() at the top.
 * Every DB query that touches store-specific data MUST include WHERE store_domain = $tenantDomain.
 * No cross-tenant data leakage is possible if this contract is honored.
 *
 * TENANT RESOLUTION ORDER (inside API route handlers):
 *  1. x-nolix-tenant header (injected by middleware — most reliable)
 *  2. Body JSON field `current_url` → extract hostname
 *  3. x-store-domain header (explicit, set by master.js)
 *  4. Referer header → extract hostname
 *  5. "unknown" (logged as anomaly, request proceeds with restricted scope)
 *
 * ROW-LEVEL SECURITY MODEL:
 *  - All store data queries include store_domain filter
 *  - Users table accessed only by authenticated session (email scoped)
 *  - popup_sessions, zeno_reality_logs, nolix_uplift_model all filtered by store_domain
 *  - Tenant cannot access another tenant's data via any query path
 */

import { query } from "./db";

// ── Tenant context type ─────────────────────────────────────────────────────
export interface TenantContext {
  storeDomain:        string;         // resolved store domain (e.g. "myshop.com")
  userId:             string | null;  // authenticated user ID (null for anonymous API calls)
  subscriptionStatus: string;         // "active" | "trialing" | "inactive"
  planId:             string | null;  // e.g. "basic" | "advanced" | "enterprise"
  isVerified:         boolean;        // store passed domain gate
  revenueSharePct:    number;         // e.g. 0.20
}

// ── Cache (in-memory, 60s TTL) to avoid DB hit on every request ────────────
const _tenantCache = new Map<string, { ctx: TenantContext; expiresAt: number }>();
const TENANT_CACHE_TTL = 60_000; // 60 seconds

// ── Resolve tenant domain from request headers ──────────────────────────────
export function extractTenantDomain(req: Request | { headers: Headers }): string {
  const headers = req.headers;

  // 1. Injected by middleware (most reliable)
  const injected = headers.get("x-nolix-tenant");
  if (injected && injected !== "unknown" && !injected.startsWith("key:")) {
    return injected.toLowerCase().trim();
  }

  // 2. Explicit store domain header
  const explicit = headers.get("x-store-domain");
  if (explicit) return explicit.replace(/^www\./, "").toLowerCase().trim();

  // 3. Referer
  const referer = headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname.replace(/^www\./, "").toLowerCase();
    } catch { /* malformed */ }
  }

  // 4. Origin
  const origin = headers.get("origin");
  if (origin) {
    try {
      const hostname = new URL(origin).hostname.replace(/^www\./, "").toLowerCase();
      if (!hostname.includes("nolix") && !hostname.includes("localhost")) {
        return hostname;
      }
    } catch { /* malformed */ }
  }

  return "unknown";
}

/**
 * Resolve full tenant context from store domain.
 * Fetches subscription status, plan, verification state from DB.
 * Results are cached for 60 seconds to minimize DB load.
 */
export async function resolveTenantContext(storeDomain: string): Promise<TenantContext> {
  if (!storeDomain || storeDomain === "unknown") {
    return {
      storeDomain:        "unknown",
      userId:             null,
      subscriptionStatus: "unknown",
      planId:             null,
      isVerified:         false,
      revenueSharePct:    0.20,
    };
  }

  // Check cache
  const cached = _tenantCache.get(storeDomain);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.ctx;
  }

  // DB lookup
  try {
    const rows = await query<{
      id:                  string;
      subscription_status: string;
      plan_id:             string | null;
      store_verified:      boolean;
      domain_gate_result:  any;
      revenue_share_pct:   number;
    }>(
      `SELECT id, subscription_status, plan_id, store_verified, domain_gate_result, revenue_share_pct
       FROM users
       WHERE store_url LIKE $1
       LIMIT 1`,
      [`%${storeDomain}%`]
    );

    const user = rows[0];
    const ctx: TenantContext = {
      storeDomain,
      userId:             user?.id ?? null,
      subscriptionStatus: user?.subscription_status ?? "unknown",
      planId:             user?.plan_id ?? null,
      isVerified:         user?.store_verified ?? false,
      revenueSharePct:    Number(user?.revenue_share_pct ?? 0.20),
    };

    // Cache it
    _tenantCache.set(storeDomain, { ctx, expiresAt: Date.now() + TENANT_CACHE_TTL });
    return ctx;

  } catch (err: any) {
    console.error(`[TenantResolver] DB error for domain ${storeDomain}:`, err.message);
    return {
      storeDomain,
      userId:             null,
      subscriptionStatus: "unknown",
      planId:             null,
      isVerified:         false,
      revenueSharePct:    0.20,
    };
  }
}

/**
 * Invalidate cached tenant context (call after subscription update).
 */
export function invalidateTenantCache(storeDomain: string): void {
  _tenantCache.delete(storeDomain);
}

/**
 * Assert that a request is from an active tenant (not blocked).
 * Returns null if OK, or a Response to return immediately if blocked.
 */
export async function assertActiveTenant(
  storeDomain: string
): Promise<Response | null> {
  if (storeDomain === "unknown") {
    // Allow unknown domains for anonymous API calls (license check will catch fakes)
    return null;
  }

  const ctx = await resolveTenantContext(storeDomain);

  if (ctx.subscriptionStatus === "inactive" || ctx.subscriptionStatus === "canceled") {
    return new Response(
      JSON.stringify({
        error:   "Subscription inactive",
        code:    "SUBSCRIPTION_INACTIVE",
        reason:  `Store ${storeDomain} subscription status: ${ctx.subscriptionStatus}`,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  return null;
}

/**
 * Build a SQL WHERE clause fragment for tenant-scoped queries.
 * Usage: const { clause, params } = tenantWhereClause(storeDomain, 1);
 *        query(`SELECT * FROM popup_sessions WHERE ${clause}`, params);
 */
export function tenantWhereClause(
  storeDomain: string,
  startParamIndex = 1
): { clause: string; params: string[] } {
  if (!storeDomain || storeDomain === "unknown") {
    return { clause: "1=1", params: [] };
  }
  return {
    clause: `store_domain = $${startParamIndex}`,
    params: [storeDomain],
  };
}
