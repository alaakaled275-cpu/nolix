/**
 * NOLIX — Hesitation Analysis API
 * app/api/hesitation/analyze/route.ts
 *
 * Returns: Multi-dimensional hesitation analysis + recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeHesitation, getStoreHesitationStats } from "@/lib/nolix-hesitation-analyzer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, features } = body;

    if (!session_id || !features) {
      return NextResponse.json(
        { error: "session_id and features required" },
        { status: 400 }
      );
    }

    const profile = await analyzeHesitation(session_id, features);

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("❌ HESITATION ANALYSIS ERROR:", error.message);
    return NextResponse.json(
      { error: "Hesitation analysis failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const store = searchParams.get("store");
  const hours = parseInt(searchParams.get("hours") || "24", 10);

  if (!store) {
    return NextResponse.json(
      { error: "store parameter required" },
      { status: 400 }
    );
  }

  try {
    const stats = await getStoreHesitationStats(store, hours);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("❌ HESITATION STATS ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to get hesitation stats" },
      { status: 500 }
    );
  }
}