/**
 * app/api/admin/rls-migrate/route.ts
 * NOLIX — RLS Migration API
 *
 * ONE-TIME MIGRATION ENDPOINT:
 *  POST /api/admin/rls-migrate
 *
 * What it does:
 *  1. Runs applyRLSPolicies() → enables RLS on all protected tables
 *  2. Runs backfillNullStoreDomains() → fills legacy NULL store_domain rows
 *  3. Returns a detailed report of what was done
 *
 * SECURITY: Protected by INTERNAL_API_SECRET.
 * Run once after deployment. Safe to re-run (idempotent).
 *
 * curl -X POST https://your-domain.com/api/admin/rls-migrate \
 *   -H "Authorization: Bearer $INTERNAL_API_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRLSPolicies, backfillNullStoreDomains, applyUsersRLSPolicy } from "@/lib/nolix-rls";
import { applyRateLimit } from "@/lib/nolix-rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── [0] RATE LIMIT (5 req/min max — admin only) ─────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitBlock = await applyRateLimit(ip, "/api/admin/rls-migrate");
  if (rateLimitBlock) return rateLimitBlock;

  // ── [1] AUTH — INTERNAL_API_SECRET required ──────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token      = authHeader.replace("Bearer ", "").trim();
  const secret     = process.env.INTERNAL_API_SECRET ?? "dev_secret_change_me";

  if (!token || token !== secret) {
    return NextResponse.json(
      { error: "Unauthorized — INTERNAL_API_SECRET required" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  try {
    console.log("[RLS Migration] Starting full RLS migration...");

    // ── [2] Apply RLS Policies to all protected tables ───────────────────
    console.log("[RLS Migration] Step 1: Applying RLS policies...");
    const rlsResult = await applyRLSPolicies();

    // ── [3] Backfill NULL store_domain values ────────────────────────────
    console.log("[RLS Migration] Step 2: Backfilling NULL store_domain values...");
    const backfillResult = await backfillNullStoreDomains();

    const durationMs = Date.now() - startedAt;

    const report = {
      success: true,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),

      rls: {
        applied_tables: rlsResult.applied,
        skipped_tables: rlsResult.skipped,
        errors:         rlsResult.errors,
        summary: rlsResult.errors.length === 0
          ? `✅ RLS applied to ${rlsResult.applied.length} tables`
          : `⚠ RLS applied with ${rlsResult.errors.length} errors`,
      },

      backfill: {
        total_null_rows:   backfillResult.total,
        matched_via_logs:  backfillResult.backfilled,
        assigned_to_legacy: backfillResult.fallback,
        summary: `${backfillResult.total} rows processed. ${backfillResult.backfilled} matched from logs, ${backfillResult.fallback} assigned to 'legacy_unknown'.`,
      },

      next_steps: [
        "RLS is now active. All queries on protected tables require app.current_tenant to be set.",
        "Use queryForTenant() from lib/nolix-rls.ts for all store-scoped queries.",
        "Admin/cron queries should use queryAsService() to bypass RLS safely.",
        "Legacy rows tagged 'legacy_unknown' are isolated — no tenant can read them without explicit admin query.",
      ],
    };

    console.log("[RLS Migration] COMPLETE:", JSON.stringify(report, null, 2));
    return NextResponse.json(report);

  } catch (err: any) {
    console.error("[RLS Migration] FAILED:", err);
    return NextResponse.json(
      {
        success:     false,
        error:       err.message,
        duration_ms: Date.now() - startedAt,
        timestamp:   new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
