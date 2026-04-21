/**
 * NOLIX — Pricing Engine (COMMAND 09)
 * lib/nolix-pricing-engine.ts
 */

import { query } from "@/lib/db";

export interface PricingInput {
  base_price: number;
  conversion_prob: number;
  sensitivity: number;
}

export interface PricingResult {
  discount: number;
  expected_revenue: number;
  discounted_price: number;
  prob: number;
}

export function computeOptimalDiscount(input: PricingInput): PricingResult {
  const { base_price, conversion_prob, sensitivity } = input;

  let best: PricingResult = {
    discount: 0,
    expected_revenue: base_price * conversion_prob,
    discounted_price: base_price,
    prob: conversion_prob
  };

  const options = [0, 5, 10, 15]; // Actionable discount brackets

  for (const d of options) {
    const discounted_price = base_price * (1 - d / 100);
    // As sensitivity is higher, the uplift in probability from discount is higher
    let prob = conversion_prob + (d / 100) * sensitivity;
    prob = Math.min(prob, 0.95); // cap at 95% certainty
    
    // Safety check: if standard rules push probability negative, floor it
    prob = Math.max(prob, 0.01);

    const expected = discounted_price * prob;

    if (expected > best.expected_revenue) {
      best = { discount: d, expected_revenue: expected, discounted_price, prob };
    }
  }

  return best;
}

export async function logPricingDecision(
  trace_id: string, visitor_id: string, base_price: number, discount_pct: number, 
  final_price: number, conversion_probability: number, expected_uplift: number, 
  expected_revenue: number, strategy_source: string
) {
  try {
    await query(
      `INSERT INTO nolix_pricing_decisions 
        (trace_id, visitor_id, base_price, discount_pct, final_price, conversion_probability, expected_uplift, expected_revenue, strategy_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [trace_id, visitor_id, base_price, discount_pct, final_price, conversion_probability, expected_uplift, expected_revenue, strategy_source]
    );
  } catch (err) {
    console.error("[Pricing Engine] Failed to log decision", err);
  }
}
