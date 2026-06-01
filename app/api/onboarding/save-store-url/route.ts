/**
 * app/api/onboarding/save-store-url/route.ts
 * NOLIX — Save Store URL (Mandatory Onboarding Step)
 *
 * Called from the onboarding page when user enters their store URL.
 * Saves to users.store_url in the DB.
 * This is what makes the dashboard show real data and enables tenant isolation.
 *
 * SECURITY:
 *  - Requires authenticated session (nolix_session cookie)
 *  - Validates URL format strictly (must be a real domain)
 *  - Rate limited: 20 req/min
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";
import { invalidateTenantCache } from "@/lib/nolix-tenant";

export const dynamic = "force-dynamic";

// ── Domain validation ────────────────────────────────────────────────────────
function validateStoreDomain(raw: string): { domain: string; error?: string } {
  if (!raw?.trim()) return { domain: "", error: "store_url is required" };

  const normalized = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;

  let hostname: string;
  try {
    hostname = new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { domain: "", error: "Invalid URL format" };
  }

  if (!hostname.includes("."))              return { domain: "", error: "Must be a valid domain" };
  if (hostname === "localhost")             return { domain: "", error: "localhost is not allowed" };
  if (hostname.endsWith(".nolix.ai"))       return { domain: "", error: "Enter your store URL, not Nolix" };
  if (hostname.length > 253)               return { domain: "", error: "Domain too long" };
  // Must look like a real domain (at least one dot, valid chars)
  if (!/^[a-z0-9]([a-z0-9\-\.]+)$/.test(hostname)) {
    return { domain: "", error: "Invalid domain characters" };
  }

  return { domain: hostname };
}

export async function POST(req: NextRequest) {
  // ── [0] RATE LIMIT ───────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitBlock = await applyRateLimit(ip, "/api/onboarding");
  if (rateLimitBlock) return rateLimitBlock;

  // ── [1] AUTH ─────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── [2] PARSE BODY ────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = body?.store_url ?? "";
  const { domain, error } = validateStoreDomain(rawUrl);

  if (error) {
    return NextResponse.json({ error }, { status: 422 });
  }

  // ── [3] SAVE TO DB ────────────────────────────────────────────────────────
  try {
    const normalized = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;

    await query(
      `UPDATE users
       SET store_url = $1
       WHERE email = $2`,
      [normalized, session.email]
    );

    // Invalidate tenant cache so the new domain is picked up immediately
    invalidateTenantCache(domain);

    console.log(`[Onboarding] store_url saved: ${domain} for ${session.email}`);

    return NextResponse.json({
      success:      true,
      store_domain: domain,
      store_url:    normalized,
      message:      "Store URL saved. Tenant isolation is now active for your store.",
    });

  } catch (err: any) {
    console.error("[Onboarding] Failed to save store_url:", err.message);
    return NextResponse.json(
      { error: "Failed to save store URL", details: err.message },
      { status: 500 }
    );
  }
}
