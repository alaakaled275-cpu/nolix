/**
 * NOLIX — Strategy Controller (COMMAND 10)
 * lib/nolix-strategy-controller.ts
 */

import { query } from "@/lib/db";
import { evaluatePerformance, analyzeStrategies, adjustStrategyWeights, OutcomeRecord } from "./nolix-learning-engine";
import { redis } from "./redis";

export async function runLearningCycle() {
  console.log("[Learning Cycle] Starting Outcome Learning Cycle...");

  try {
    const rawData = await query(`
      SELECT strategy_used, success, actual_revenue 
      FROM nolix_outcome_learning 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `) as OutcomeRecord[];

    const mlPerformance = evaluatePerformance(rawData.filter(d => d.strategy_used === "ml"));
    const map = analyzeStrategies(rawData);
    const weights = adjustStrategyWeights(map);

    // Save global weights in Redis for quick access by Hybrid Brain
    await redis.set("nolix:learning:strategy_weights", JSON.stringify(weights));
    await redis.set("nolix:learning:ml_success_rate", mlPerformance.toString());

    // Evaluate Pricing Success
    const pricingData = await query(`
      SELECT roi_ratio 
      FROM nolix_pricing_decisions 
      WHERE created_at >= NOW() - INTERVAL '24 hours' AND actual_revenue > 0
    `) as any[];

    if (pricingData.length > 50) {
      const avgRoi = pricingData.reduce((acc, row) => acc + Number(row.roi_ratio), 0) / pricingData.length;
      await redis.set("nolix:learning:pricing_efficiency", avgRoi.toString());
    }

    console.log("[Learning Cycle] Completed.", { mlPerformance, weights });
  } catch (err) {
    console.error("[Learning Cycle] Failed:", err);
  }
}
