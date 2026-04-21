/**
 * NOLIX — License Management Admin API (STEP 12 PART 1)
 * POST /api/admin/license   — create new license
 * GET  /api/admin/license   — list all licenses
 * PUT  /api/admin/license   — activate/deactivate
 */

import { NextRequest, NextResponse } from "next/server";
import { createLicense, invalidateLicenseCache } from "@/lib/nolix-license";
import { query } from "@/lib/db";

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-nolix-sync-secret") === process.env.NOLIX_SYNC_SECRET;
}

// POST — Create new license for a shop
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shop_domain, plan, expires_at, extra_domains } = await req.json().catch(() => ({}));
  if (!shop_domain) {
    return NextResponse.json({ error: "shop_domain required" }, { status: 400 });
  }

  const expiry = expires_at ? new Date(expires_at) : undefined;
  const lic    = await createLicense(shop_domain, plan || "starter", expiry);

  // Add extra allowed domains if provided
  if (extra_domains && Array.isArray(extra_domains) && extra_domains.length > 0) {
    await query(
      `UPDATE nolix_licenses
       SET allowed_domains = array_cat(allowed_domains, $1::TEXT[])
       WHERE shop_domain = $2`,
      [extra_domains, shop_domain]
    );
  }

  return NextResponse.json({ created: true, license: lic });
}

// GET — List all licenses
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<any>(
    `SELECT id, shop_domain, license_key, plan, is_active,
            allowed_domains, expires_at, request_count, last_seen_at, created_at
     FROM nolix_licenses ORDER BY created_at DESC`
  );

  const violations = await query<any>(
    `SELECT license_key, blocked_domain, COUNT(*) as attempts
     FROM nolix_license_violations
     WHERE attempted_at > NOW() - INTERVAL '7 days'
     GROUP BY license_key, blocked_domain
     ORDER BY attempts DESC LIMIT 20`
  ).catch(() => []);

  return NextResponse.json({ licenses: rows, violations });
}

// PUT — Toggle license active status
export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { license_key, is_active } = await req.json().catch(() => ({}));
  if (!license_key || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "license_key and is_active required" }, { status: 400 });
  }

  await query(
    `UPDATE nolix_licenses SET is_active=$1, updated_at=NOW() WHERE license_key=$2`,
    [is_active, license_key]
  );
  invalidateLicenseCache(license_key);

  return NextResponse.json({
    updated:     true,
    license_key,
    is_active,
    note:        "Cache cleared. Effect is immediate."
  });
}
