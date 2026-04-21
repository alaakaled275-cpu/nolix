import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveAttribution } from "@/lib/nolix-attribution-engine";
import { logOutcomeLearning } from "@/lib/nolix-learning-engine";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { visitor_id, trace_id, revenue, converted } = await req.json();

    if (!visitor_id || converted === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Attempt to map back to an experiment assignment for this visitor
    const assignments = await query(
      `SELECT experiment_id, variant_id FROM nolix_experiment_assignments WHERE visitor_id = $1`,
      [visitor_id]
    ) as any[];

    // ── COMMAND X PART 2: TRUE ATTRIBUTION ─────────────────────────────
    const attributions = await resolveAttribution(visitor_id);
    
    if (assignments.length) {
      for (const a of assignments) {
        if (attributions.length > 0) {
           for (const attr of attributions) {
              const sharedRev = (revenue || 0) * attr.weight;
              await query(
                `INSERT INTO nolix_experiment_results (id, experiment_id, variant_id, visitor_id, decision_trace_id, converted, revenue)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [crypto.randomUUID(), a.experiment_id, a.variant_id, visitor_id, attr.trace_id, converted, sharedRev]
              );
              // STEP 4 - Save shared revenue to outcome table
              await query(
                `UPDATE nolix_decision_outcomes SET revenue_share = revenue_share + $1 WHERE trace_id = $2`,
                [sharedRev, attr.trace_id]
              );
              // COMMAND 09 STEP 5 - Pricing Engine Feedback
              await query(
                `UPDATE nolix_pricing_decisions SET actual_revenue = actual_revenue + $1, roi_ratio = (actual_revenue + $1) / expected_revenue 
                 WHERE trace_id = $2 AND expected_revenue > 0`,
                [sharedRev, attr.trace_id]
              );
              // COMMAND 10 PART 2 - Outcome Learning System Capture
              logOutcomeLearning(attr.trace_id, visitor_id, "conversion", 0, 0, sharedRev, "UNKNOWN", "UNKNOWN", "experiment", a.variant_id).catch(() => {});
           }
        } else {
           // Fallback if no attribution found (direct hit)
           await query(
             `INSERT INTO nolix_experiment_results (id, experiment_id, variant_id, visitor_id, decision_trace_id, converted, revenue)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
             [crypto.randomUUID(), a.experiment_id, a.variant_id, visitor_id, trace_id, converted, revenue || 0]
           );
        }
      }
    } else {
      // Not in an experiment but still converted: ensure Pricing and Outcome Learning are fed via attributions.
      if (attributions.length > 0) {
         for (const attr of attributions) {
            const sharedRev = (revenue || 0) * attr.weight;
            await query(
              `UPDATE nolix_decision_outcomes SET revenue_share = revenue_share + $1 WHERE trace_id = $2`,
              [sharedRev, attr.trace_id]
            );
            await query(
              `UPDATE nolix_pricing_decisions SET actual_revenue = actual_revenue + $1, roi_ratio = (actual_revenue + $1) / expected_revenue 
               WHERE trace_id = $2 AND expected_revenue > 0`,
              [sharedRev, attr.trace_id]
            );
            logOutcomeLearning(attr.trace_id, visitor_id, "conversion", 0, 0, sharedRev, "UNKNOWN", "UNKNOWN", "rules", "none").catch(() => {});
         }
      }
    }

    // Trigger auto-optimisation in background
    setTimeout(async () => {
      try {
        const { optimizeActiveExperiments } = await import("@/lib/nolix-experiment-analytics");
        await optimizeActiveExperiments();
      } catch (e) {
        console.error("Failed to run optimization loop", e);
      }
    }, 100);

    return NextResponse.json({ success: true, experiments_tracked: assignments.length });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to track conversion", message: err.message }, { status: 500 });
  }
}
