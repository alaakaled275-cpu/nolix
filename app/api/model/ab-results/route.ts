/**
 * NOLIX — A/B Results API (STEP 11 PART 1)
 * GET /api/model/ab-results
 *
 * Returns: ML vs Control conversion rate, revenue lift, statistical significance.
 * This is THE PROOF that the AI generates money.
 */

import { NextRequest, NextResponse } from "next/server";
import { getABResults } from "@/lib/nolix-ab-engine";
import { startQueueWorker } from "@/lib/nolix-queue";

startQueueWorker();

export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store") || undefined;
  try {
    const results = await getABResults(store);
    return NextResponse.json({
      ...results,
      interpretation: results.significant
        ? results.lift > 0
          ? `✅ ML group converts ${(results.lift * 100).toFixed(1)}% better than control. AI is working.`
          : `⚠ Control group outperforms ML by ${(Math.abs(results.lift) * 100).toFixed(1)}%. Review model.`
        : "⏳ Not enough data for statistical significance (need 100+ sessions per group).",
      generated_at: new Date().toISOString()
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
