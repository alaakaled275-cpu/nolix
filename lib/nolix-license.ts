/**
 * NOLIX — License Verification Service (STEP 12 PART 1)
 * lib/nolix-license.ts
 *
 * License Key System: every shop must have a valid license.
 * If license is invalid/expired/domain-blocked → ALL APIs return 403.
 * This prevents script theft (copy-paste from network tab).
 *
 * License validation is cached in-memory per domain for 60s
 * to avoid hammering DB on every event.
 */

import { query } from "./db";
import crypto    from "crypto";

// ============================================================
// TYPES
// ============================================================
export interface License {
  id:              number;
  shop_domain:     string;
  license_key:     string;
  is_active:       boolean;
  allowed_domains: string[];
  plan:            string;       // "starter" | "pro" | "enterprise"
  expires_at:      Date | null;
  created_at:      Date;
}

interface LicenseCacheEntry {
  valid:     boolean;
  license:   License | null;
  reason:    string;
  cached_at: number;
}

// In-memory cache: domain → result (TTL 60s)
const _cache = new Map<string, LicenseCacheEntry>();
const CACHE_TTL_MS = 60_000;

// ============================================================
// GENERATE LICENSE KEY
// Format: NOLIX-{shopHash4}-{timestamp_b36}-{random8}
// ============================================================
export function generateLicenseKey(shopDomain: string): string {
  const shopHash = crypto.createHash("sha256")
    .update(shopDomain).digest("hex").substring(0, 4).toUpperCase();
  const ts       = Date.now().toString(36).toUpperCase();
  const rand     = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `NOLIX-${shopHash}-${ts}-${rand}`;
}

// ============================================================
// VERIFY LICENSE (with cache)
// ============================================================
export async function verifyLicense(
  licenseKey: string,
  requestDomain: string
): Promise<{ valid: boolean; license: License | null; reason: string }> {
  const cacheKey = `${licenseKey}:${requestDomain}`;
  const cached   = _cache.get(cacheKey);

  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
    return { valid: cached.valid, license: cached.license, reason: cached.reason };
  }

  let result: { valid: boolean; license: License | null; reason: string };

  try {
    const rows = await query<License>(
      `SELECT * FROM nolix_licenses WHERE license_key = $1 LIMIT 1`,
      [licenseKey]
    );

    if (!rows.length) {
      result = { valid: false, license: null, reason: "license_not_found" };
    } else {
      const lic = rows[0] as License;

      if (!lic.is_active) {
        result = { valid: false, license: lic, reason: "license_inactive" };
      } else if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
        result = { valid: false, license: lic, reason: "license_expired" };
      } else if (
        lic.allowed_domains &&
        lic.allowed_domains.length > 0 &&
        !lic.allowed_domains.includes(requestDomain) &&
        !lic.allowed_domains.includes("*")
      ) {
        // Log unauthorized domain attempt
        await query(
          `INSERT INTO nolix_license_violations
           (license_key, blocked_domain, attempted_at)
           VALUES ($1, $2, NOW())`,
          [licenseKey, requestDomain]
        ).catch(() => {});
        result = { valid: false, license: lic, reason: `domain_blocked:${requestDomain}` };
      } else {
        result = { valid: true, license: lic, reason: "ok" };
        // Update last_seen_at
        await query(
          `UPDATE nolix_licenses SET last_seen_at=NOW(), request_count=request_count+1
           WHERE license_key=$1`, [licenseKey]
        ).catch(() => {});
      }
    }
  } catch(e: any) {
    // DB failure: fail-open in dev, fail-closed in production
    const failOpen = process.env.NODE_ENV !== "production";
    result = {
      valid:   failOpen,
      license: null,
      reason:  failOpen ? "db_error_dev_passthrough" : "db_error_access_denied"
    };
    console.error("⚠ LICENSE: DB error:", e.message);
  }

  _cache.set(cacheKey, { ...result, cached_at: Date.now() });
  return result;
}

// Clear cache for a domain (after license update)
export function invalidateLicenseCache(licenseKey: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(licenseKey)) _cache.delete(key);
  }
}

// ============================================================
// CREATE LICENSE (admin only)
// ============================================================
export async function createLicense(
  shopDomain:  string,
  plan:        string = "starter",
  expiresAt?:  Date
): Promise<License> {
  const key = generateLicenseKey(shopDomain);
  const rows = await query<License>(
    `INSERT INTO nolix_licenses
     (shop_domain, license_key, plan, is_active, allowed_domains, expires_at, created_at)
     VALUES ($1, $2, $3, true, ARRAY[$4], $5, NOW())
     ON CONFLICT (shop_domain) DO UPDATE SET
       license_key=$2, plan=$3, is_active=true,
       allowed_domains=ARRAY[$4], expires_at=$5, updated_at=NOW()
     RETURNING *`,
    [shopDomain, key, plan, shopDomain, expiresAt || null]
  );
  console.log("🔑 LICENSE CREATED:", { shopDomain, key, plan });
  return rows[0] as License;
}

// ============================================================
// LICENSE GUARD MIDDLEWARE (for use in API routes)
// Usage: const ok = await guardRoute(req); if (!ok.valid) return ok.response;
// ============================================================
export async function guardRoute(req: Request): Promise<{ valid: boolean; response?: Response }> {
  const licenseKey = req.headers.get("x-nolix-key")   || "";
  const domain     = req.headers.get("x-domain")       ||
                     req.headers.get("origin")?.replace(/^https?:\/\//, "").split("/")[0] || "";

  if (!licenseKey) {
    // No license key = allow in dev, block in prod (for non-licensed stores)
    if (process.env.NODE_ENV !== "production") return { valid: true };
    return {
      valid:    false,
      response: Response.json({ error: "Missing license key", code: "NO_KEY" }, { status: 403 })
    };
  }

  const result = await verifyLicense(licenseKey, domain);
  if (!result.valid) {
    return {
      valid:    false,
      response: Response.json({
        error:  "License invalid",
        reason: result.reason,
        code:   "LICENSE_DENIED"
      }, { status: 403 })
    };
  }

  return { valid: true };
}
