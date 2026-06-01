/**
 * NOLIX — Learning Loop API
 * app/api/learning/loop/route.ts
 *
 * Handles: Real-time learning feedback + batch training triggers
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processConversionFeedback,
  processWastedDiscountFeedback,
  getLearningStats,
  shouldRetrain,
  getAdaptiveLearningRates
} from "@/lib/nolix-learning-loop";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, store, revenue, event_type } = body;

    if (!session_id || !store) {
      return NextResponse.json(
        { error: "session_id and store required" },
        { status: 400 }
      );
    }

    let feedback = null;

    if (event_type === "conversion") {
      feedback = await processConversionFeedback(session_id, store, revenue || 0);
    } else if (event_type === "wasted_discount") {
      feedback = await processWastedDiscountFeedback(session_id, store);
    }

    return NextResponse.json({
      success: true,
      feedback
    });
  } catch (error: any) {
    console.error("❌ LEARNING LOOP ERROR:", error.message);
    return NextResponse.json(
      { error: "Learning feedback failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const store = searchParams.get("store");
  const action = searchParams.get("action");

  if (!store) {
    return NextResponse.json(
      { error: "store parameter required" },
      { status: 400 }
    );
  }

  try {
    if (action === "stats") {
      const stats = await getLearningStats(store);
      return NextResponse.json(stats);
    }

    if (action === "retrain") {
      const retrain = await shouldRetrain(store);
      return NextResponse.json(retrain);
    }

    if (action === "rates") {
      const rates = await getAdaptiveLearningRates(store);
      return NextResponse.json(rates);
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("❌ LEARNING API ERROR:", error.message);
    return NextResponse.json(
      { error: "Learning API failed" },
      { status: 500 }
    );
  }
}