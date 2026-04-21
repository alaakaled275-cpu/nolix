/**
 * NOLIX — Client Feedback Hook API (COMMAND 05 - Step 3)
 * app/api/zeno/feedback/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { computeEffectiveness, autoAdjustRuleConstraints } from "@/lib/nolix-effectiveness";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trace_id, visitor_id, action, outcome, revenue, latency_to_outcome } = body;

    if (!trace_id || !outcome) {
      return NextResponse.json({ error: "trace_id and outcome are required" }, { status: 400 });
    }

    // Insert the outcome
    await query(
      `INSERT INTO nolix_decision_outcomes 
         (id, trace_id, visitor_id, action, outcome, revenue, latency_to_outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        crypto.randomUUID(),
        trace_id,
        visitor_id || "unknown",
        action || "unknown",
        outcome, // 'converted' | 'ignored' | 'bounced'
        revenue || 0,
        latency_to_outcome || null
      ]
    );

    // If it's a conversion or bounce, asynchronously trigger the auto-adjustment layer
    if (outcome === "converted" || outcome === "bounced") {
      // Non-blocking trigger of the effectiveness engine
      setTimeout(() => {
        autoAdjustRuleConstraints().catch(e => console.error("Auto adjust failed:", e));
      }, 100);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Feedback ingestion failed:", e.message);
    return NextResponse.json({ error: "FEEDBACK_ERROR", detail: e.message }, { status: 500 });
  }
}
