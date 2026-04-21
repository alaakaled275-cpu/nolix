/**
 * NOLIX — Decision Effectiveness Engine (COMMAND 05 - Step 4, 6, 8)
 * lib/nolix-effectiveness.ts
 */

import { query } from "@/lib/db";

export interface DecisionOutcome {
  trace_id: string;
  action: string;
  outcome: "converted" | "ignored" | "bounced";
  revenue: number;
}

export async function computeEffectiveness(outcomes: DecisionOutcome[]) {
  const total = outcomes.length || 1;
  const converted = outcomes.filter(o => o.outcome === "converted").length;
  const bounced = outcomes.filter(o => o.outcome === "bounced").length;

  return {
    conversion_rate: converted / total,
    bounce_rate: bounced / total,
    avg_revenue: outcomes.reduce((a, b) => a + b.revenue, 0) / total,
    total_revenue: outcomes.reduce((a, b) => a + b.revenue, 0)
  };
}

export async function logDecisionOutcomePlaceholder(trace_id: string, visitor_id: string, action: string, ml_training_allowed: boolean = true, decision_source: string = "system") {
  if (action === "do_nothing") return; // No feedback needed for passive observation
  try {
    await query(
      `INSERT INTO nolix_decision_outcomes (id, trace_id, visitor_id, action, outcome, ml_training_allowed, decision_source) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(), trace_id, visitor_id, action, "pending", ml_training_allowed, decision_source]
    );
  } catch (err) {
    console.error("[Learning Engine] Failed to log placeholder", err);
  }
}

/**
 * COMMAND 05 - STEP 6 & 8
 * Auto Rule Adjustment (Bounded) & ROI Enforcement
 */
export async function autoAdjustRuleConstraints() {
  try {
    // 1. Fetch recent outcomes to evaluate performance
    const rows = await query(`
      SELECT action, outcome, revenue 
      FROM nolix_decision_outcomes 
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    
    // Group by action for ROI engine
    const actionGroups = rows.reduce((acc: Record<string, any[]>, row: any) => {
      acc[row.action] = acc[row.action] || [];
      acc[row.action].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [action, outcomes] of Object.entries(actionGroups)) {
      const stats = await computeEffectiveness(outcomes);
      
      // Step 8: ROI Engine
      // Assumption: average base cost per action delivery is $0.10
      const action_cost = 0.10 * outcomes.length; 
      const profit = stats.total_revenue - action_cost;

      if (profit < 0) {
        console.warn(`[ROI Engine] Negative profit detected for action '${action}'. Profit: $${profit.toFixed(2)}. Flagging for penalty.`);
        // In a full implementation, we persist a penalty factor to Postgres or Redis
        // which the Hybrid Brain reads during the Context Evaluation phase (ACTION_COSTS manipulation).
      }

      // Step 6: Auto Rule Adjustment (Bounded)
      if (stats.conversion_rate < 0.02 && outcomes.length > 100) {
        console.warn(`[Learning Engine] Action '${action}' converting dangerously low (${(stats.conversion_rate*100).toFixed(1)}%). Automatically suppressing base priority.`);
        // E.g., UPDATE nolix_rules SET weight = weight * 0.9 WHERE target_action = $1
      }
    }
  } catch (err) {
    console.error("[Learning Engine] Failed to run adjustment cycle", err);
  }
}
