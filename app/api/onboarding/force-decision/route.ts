import { NextRequest, NextResponse } from "next/server";
import { runHybridBrain } from "@/lib/nolix-hybrid-brain";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { markStepCompleted } from "@/lib/nolix-onboarding-engine";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { session_id, workspace_id } = await req.json();

    // 1. Simulate High-Intent Signal
    const fakeTraceId = crypto.randomUUID();
    const fakeVisitorId = "sim_" + crypto.randomUUID().slice(0, 8);
    const simulatedSignal: any = {
      visitor_id: fakeVisitorId,
      store_domain: workspace_id || "demo-store.com",
      cart_value: 120.50,
      page_url: "https://demo.com/checkout",
      referrer: "auto-simulator",
      // Force high intent metrics
      scroll_depth: 85,
      time_on_page: 45,
      rage_clicks: 2, // Force price friction trigger
      mouse_velocity: 15
    };

    // 2. Run the actual brain
    const brainOutput = await runHybridBrain({
      signal: simulatedSignal,
      trigger: "exit_intent",
      segment: "high_intent",
      aov_estimate: 120.50,
      visit_count: 5
    });

    // 3. Complete the onboarding step automatically
    if (session_id) {
       await markStepCompleted(session_id, null, "first_decision");
    }

    // 4. Transform output for First Value Experience (Correction 2)
    return NextResponse.json({
      success: true,
      trace_id: fakeTraceId,
      decision: {
        action: brainOutput.action,
        final_score: brainOutput.final_score,
        popup_type: brainOutput.recommended_popup
      },
      explanation: "User shows high intent with price friction (simulated rage clicks)",
      impact: `Expected +${(brainOutput.expected_uplift * 100).toFixed(1)}% conversion uplift`,
      confidence: brainOutput.ml_boost > 0.1 ? "ML assisted (strong signal)" : "Rule-based foundation"
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Force decision failed", message: err.message }, { status: 500 });
  }
}
