/**
 * NOLIX — Identity & Personalization Engine (COMMAND 08 / COMMAND X)
 * lib/nolix-identity-engine.ts
 */

import { query } from "@/lib/db";
import { BrainDecision } from "./nolix-hybrid-brain";

export async function getUserIdentity(visitor_id: string): Promise<any> {
  const res = await query(`SELECT * FROM nolix_user_identity WHERE visitor_id = $1`, [visitor_id]) as any[];
  if (!res || res.length === 0) return null;
  return res[0];
}

export function buildIdentity(signals: any) {
  const views = Number(signals.visit_count) || 1;
  const hesi = Number(signals.hesitations) || 0;
  
  const price_sensitivity = views > 0 ? (hesi / views) : 0;
  let strategy = "balanced";

  if (price_sensitivity > 0.6) {
    strategy = "aggressive_discount";
  } else if ((signals.intent === "HIGH" || signals.score > 0.7) && price_sensitivity < 0.2) {
    strategy = "no_discount";
  } else if (views > 5) {
    strategy = "trust_building";
  }

  return { price_sensitivity, strategy };
}

export async function updateIdentity(visitor_id: string, signals: any, decision: BrainDecision) {
  const existing = await getUserIdentity(visitor_id);
  const newId = buildIdentity(signals);

  let newVisitCount = 1;
  if (existing) {
     newVisitCount = (existing.visit_count || 0) + 1;
  }

  await query(
    `INSERT INTO nolix_user_identity (visitor_id, price_sensitivity, visit_count, strategy, updated_at) 
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (visitor_id) DO UPDATE SET 
      price_sensitivity = EXCLUDED.price_sensitivity,
      visit_count = EXCLUDED.visit_count,
      strategy = EXCLUDED.strategy,
      updated_at = NOW()`,
    [visitor_id, newId.price_sensitivity, newVisitCount, newId.strategy]
  );
}

export function applyStrategy(decision: any, strategy: string) {
  let strategy_applied = false;

  switch (strategy) {
    case "aggressive_discount":
      decision.discount_pct = Math.min(decision.discount_pct + 5, 15);
      strategy_applied = true;
      break;

    case "no_discount":
      decision.discount_pct = 0;
      decision.recommended_popup = "info_only";
      strategy_applied = true;
      break;

    case "trust_building":
      decision.recommended_popup = "social_proof";
      strategy_applied = true;
      break;
  }

  return { decision, strategy_applied, strategy };
}
