/**
 * NOLIX — Alert Engine (COMMAND 04 - Step 7)
 * lib/nolix-alert-engine.ts
 */

export interface DecisionMetricsAnomaly {
  latency?: number;
  economic_ratio?: number;
  ml_contribution?: number;
}

export type AnomalyType = "HIGH_LATENCY" | "NEGATIVE_ROI" | "ML_OVERRELIANCE" | "NORMAL";

export function detectAnomaly(metrics: DecisionMetricsAnomaly): AnomalyType {
  if (metrics.latency && metrics.latency > 2000) return "HIGH_LATENCY";
  if (metrics.economic_ratio && metrics.economic_ratio < 1) return "NEGATIVE_ROI";
  if (metrics.ml_contribution && metrics.ml_contribution > 0.2) return "ML_OVERRELIANCE";
  return "NORMAL";
}
