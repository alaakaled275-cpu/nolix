/**
 * NOLIX — Causal Metrics API
 * app/api/causal/metrics/route.ts
 *
 * RETURNS: Real conversion intelligence
 */

import { NextRequest, NextResponse } from "next/server";
import { getCausalMetrics } from "@/lib/nolix-causal-engine";
import { extractTenantDomain } from "@/lib/nolix-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let store = request.nextUrl.searchParams.get("store") || request.nextUrl.searchParams.get("tenant");
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);

  if (!store) {
    store = extractTenantDomain(request);
  }

  if (!store) {
    return NextResponse.json(
      { error: "store parameter required" },
      { status: 400 }
    );
  }

  try {
    const metrics = await getCausalMetrics(store, days);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("❌ CAUSAL METRICS ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to get causal metrics" },
      { status: 500 }
    );
  }
}