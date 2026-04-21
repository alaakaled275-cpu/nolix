/**
 * NOLIX — License Verify API (STEP 12 PART 1)
 * GET /api/license/verify
 * POST /api/admin/license (create/manage)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyLicense, createLicense, guardRoute } from "@/lib/nolix-license";
import { applyAPIGuard } from "@/lib/nolix-api-guard";
import { startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

// GET — Verify license for master.js boot
export async function GET(req: NextRequest) {
  const guard = await applyAPIGuard(req, undefined, { skipSignature: true });
  if (!guard.passed) return guard.response;

  const licenseKey = req.headers.get("x-nolix-key") || "";
  const domain     = req.headers.get("x-domain")    ||
    req.nextUrl.searchParams.get("domain")           || "";

  if (!licenseKey || !domain) {
    return NextResponse.json({
      valid:  false,
      reason: "missing_key_or_domain",
      code:   "BAD_REQUEST"
    }, { status: 400 });
  }

  const result = await verifyLicense(licenseKey, domain);

  if (!result.valid) {
    // Log blocked attempt
    console.warn("🚫 LICENSE DENIED:", { domain, reason: result.reason });
    return NextResponse.json({
      valid:  false,
      reason: result.reason,
      code:   "LICENSE_DENIED"
    }, { status: 403 });
  }

  return NextResponse.json({
    valid:       true,
    shop_domain: result.license?.shop_domain,
    plan:        result.license?.plan,
    expires_at:  result.license?.expires_at || null
  });
}
