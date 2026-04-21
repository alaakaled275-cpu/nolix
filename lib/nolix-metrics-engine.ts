/**
 * NOLIX — Decision Metrics Engine (COMMAND 03 - Step 6)
 * lib/nolix-metrics-engine.ts
 */

import { query } from "@/lib/db";

export interface DecisionMetricsInput {
  trace_id: string;
  start_time: number;
  ml_boost?: number;
  rules_fired: string[];
  expected_uplift: number;
  cost: number;
  probability?: number | null;
}

export function computeDecisionMetrics(input: DecisionMetricsInput) {
  const latency_ms = Date.now() - input.start_time;
  const ml_contribution = input.ml_boost || 0;
  const rule_hits = input.rules_fired.length;
  const economic_ratio = input.cost > 0 ? (input.expected_uplift / input.cost) : (input.expected_uplift > 0 ? 99 : 0);
  
  return {
    latency_ms,
    ml_contribution,
    rule_hits,
    economic_ratio: Math.round(economic_ratio * 100) / 100,
    success_probability: input.probability || null
  };
}

export async function storeDecisionMetrics(metrics: ReturnType<typeof computeDecisionMetrics> & { trace_id: string }) {
  try {
    await query(
      `INSERT INTO nolix_decision_metrics 
         (id, trace_id, latency_ms, ml_contribution, rule_hits, economic_ratio)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        metrics.trace_id,
        metrics.latency_ms,
        metrics.ml_contribution,
        metrics.rule_hits,
        metrics.economic_ratio
      ]
    );
  } catch (error) {
    console.error("[DecisionMetrics] Failed to store metrics", metrics.trace_id, error);
  }
}
