/**
 * NOLIX — Outcome Learning Engine (COMMAND 10)
 * lib/nolix-learning-engine.ts
 */

import { query } from "@/lib/db";

export interface OutcomeRecord {
  strategy_used: string;
  success: boolean;
  actual_revenue: number;
}

export function evaluatePerformance(data: OutcomeRecord[]) {
  if (data.length === 0) return 0;
  let total = data.length;
  let success = data.filter(d => d.success).length;
  return success / total;
}

export function analyzeStrategies(data: OutcomeRecord[]) {
  const map: Record<string, { success: number, total: number }> = {};
  for (const d of data) {
    const key = d.strategy_used || "base_rules";
    if (!map[key]) map[key] = { success: 0, total: 0 };
    map[key].total++;
    if (d.success) map[key].success++;
  }
  return map;
}

export function adjustStrategyWeights(stats: Record<string, { success: number, total: number }>) {
  const weights: Record<string, number> = {};
  for (const key in stats) {
    // Requires minimum sample of 10 to adjust weight reliably
    if (stats[key].total >= 10) {
      weights[key] = stats[key].success / stats[key].total;
    } else {
      weights[key] = 0.5; // Neutral start
    }
  }
  return weights;
}

export async function logOutcomeLearning(
  trace_id: string, visitor_id: string, decision_action: string, discount_pct: number,
  expected_revenue: number, actual_revenue: number, intent_level: string, 
  friction_type: string, strategy_used: string, experiment_variant: string
) {
  try {
    await query(
      `INSERT INTO nolix_outcome_learning 
        (trace_id, visitor_id, decision_action, discount_pct, expected_revenue, actual_revenue, success, intent_level, friction_type, strategy_used, experiment_variant)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [trace_id, visitor_id, decision_action, discount_pct, expected_revenue, actual_revenue, actual_revenue > 0, intent_level, friction_type, strategy_used, experiment_variant]
    );
  } catch (err) {
    console.error("[Learning Engine] Failed to log outcome", err);
  }
}
