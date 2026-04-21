/**
 * NOLIX — Experiment Engine (COMMAND 07 - Core Logic)
 * lib/nolix-experiment-engine.ts
 */

import crypto from "crypto";
import { query } from "@/lib/db";

export interface VariantConfig {
  action?: string;
  discount_pct?: number;
  popup_override?: string;
}

export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  name: string;
  config: VariantConfig;
  traffic_allocation: number;
}

/**
 * Consistent hashing for sticky assignment
 */
function hashVisitor(visitor_id: string, experiment_id: string): number {
  const hash = crypto.createHash("md5").update(`${visitor_id}_${experiment_id}`).digest("hex");
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}

export async function getActiveExperiments(): Promise<{ id: string; name: string }[]> {
  return await query(`SELECT id, name FROM nolix_experiments WHERE status = 'active'`) as any[];
}

export async function assignVariant(visitor_id: string, experiment_id: string): Promise<ExperimentVariant | null> {
  const expStatus = await query(`SELECT status FROM nolix_experiments WHERE id = $1`, [experiment_id]) as any[];
  if (!expStatus.length || expStatus[0].status !== "active") return null;

  // Check existing assignment
  const existing = await query(
    `SELECT v.* FROM nolix_experiment_assignments a 
     JOIN nolix_experiment_variants v ON a.variant_id = v.id 
     WHERE a.visitor_id = $1 AND a.experiment_id = $2`,
    [visitor_id, experiment_id]
  ) as any[];
  if (existing.length) return existing[0] as ExperimentVariant;

  // Fetch variants
  const variants: ExperimentVariant[] = await query(
    `SELECT * FROM nolix_experiment_variants WHERE experiment_id = $1 ORDER BY id`,
    [experiment_id]
  ) as any[];
  if (!variants.length) return null;

  const h = hashVisitor(visitor_id, experiment_id);

  let cumulative = 0;
  let assignedVariant = variants[0];
  for (const v of variants) {
    cumulative += v.traffic_allocation;
    if (h <= cumulative) {
      assignedVariant = v;
      break;
    }
  }

  // Persist assignment lock
  await query(
    `INSERT INTO nolix_experiment_assignments (visitor_id, experiment_id, variant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [visitor_id, experiment_id, assignedVariant.id]
  ).catch(console.error);

  return assignedVariant;
}

export function applyVariantOverrides(decision: any, config: VariantConfig) {
  if (config.action) decision.action = config.action;
  
  if (config.discount_pct !== undefined) {
    // STEP 10: SAFETY LAYER - MAX DISCOUNT CAP
    decision.discount_pct = Math.min(config.discount_pct, 15);
  }
  
  if (config.popup_override) decision.recommended_popup = config.popup_override;
  return decision;
}
