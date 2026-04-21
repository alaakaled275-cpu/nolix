/**
 * NOLIX — Experiment Analytics (COMMAND 07 - Step 5, 6, 7, 10)
 * lib/nolix-experiment-analytics.ts
 */

import { query } from "@/lib/db";

// Basic Z-Score calculation for significance (approx 1.96 for 95% confidence)
function calculateZScore(convA: number, nA: number, convB: number, nB: number): number {
  if (nA === 0 || nB === 0) return 0;
  const pA = convA / nA;
  const pB = convB / nB;
  const pPool = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pPool * (1 - pPool) * ((1 / nA) + (1 / nB)));
  if (se === 0) return 0;
  return (pA - pB) / se;
}

export async function measureExperiment(experiment_id: string) {
  // Fetch assignments counts
  const assignRows = await query(`
    SELECT variant_id, COUNT(*) as assigned_count 
    FROM nolix_experiment_assignments 
    WHERE experiment_id = $1 GROUP BY variant_id
  `, [experiment_id]) as any[];

  // Fetch results
  const resultRows = await query(`
    SELECT variant_id, COUNT(*) as outcomes, SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions, SUM(revenue) as total_revenue
    FROM nolix_experiment_results
    WHERE experiment_id = $1 GROUP BY variant_id
  `, [experiment_id]) as any[];

  /** Step 5: Metrics Construction */
  const metrics: any = {};
  for (const row of assignRows) {
     metrics[row.variant_id] = { assigned: Number(row.assigned_count), outcomes: 0, conversions: 0, revenue: 0, conv_rate: 0, rev_per_user: 0 };
  }
  for (const res of resultRows) {
     if (!metrics[res.variant_id]) continue;
     metrics[res.variant_id].outcomes = Number(res.outcomes);
     metrics[res.variant_id].conversions = Number(res.conversions);
     metrics[res.variant_id].revenue = Number(res.total_revenue);
     if (metrics[res.variant_id].assigned > 0) {
       metrics[res.variant_id].conv_rate = metrics[res.variant_id].conversions / metrics[res.variant_id].assigned;
       metrics[res.variant_id].rev_per_user = metrics[res.variant_id].revenue / metrics[res.variant_id].assigned;
     }
  }

  return metrics;
}

/** Step 7: Auto Optimization Loop & Step 10: Safety Layer */
export async function optimizeActiveExperiments() {
  const activeExps = await query(`SELECT id FROM nolix_experiments WHERE status = 'active'`) as any[];
  
  for (const exp of activeExps) {
    const expId = exp.id;
    const metrics = await measureExperiment(expId);
    
    const variantKeys = Object.keys(metrics);
    if (variantKeys.length < 2) continue;

    // Safety Layer (Step 10): Ensure minimum sample size of 50 per variant to avoid noise
    const allHaveSamples = variantKeys.every(k => metrics[k].assigned >= 50);
    if (!allHaveSamples) continue;

    // Assuming first variant is conceptually "control" or lowest priority ID
    const controlVariantId = variantKeys.find(v => v.includes("control")) || variantKeys[0];
    const controlVars = metrics[controlVariantId];

    for (const vid of variantKeys) {
      if (vid === controlVariantId) continue;
      const testVars = metrics[vid];

      const zScore = calculateZScore(testVars.conversions, testVars.assigned, controlVars.conversions, controlVars.assigned);
      const isSignificant = zScore > 1.96; // 95% threshold for winning
      const isLossSignificant = zScore < -1.96; // 95% threshold for failing
      const uplift = testVars.conv_rate - controlVars.conv_rate;

      // Auto Winner Detection (Step 6)
      if (isSignificant && uplift > (controlVars.conv_rate * 0.10)) { // Beat by at least 10% relative
         console.log(`[Testing Engine] Auto-Win! Variant ${vid} beat ${controlVariantId} on exp. ${expId}. Z-Score: ${zScore.toFixed(2)}`);
         await markWinner(expId, vid);
      }

      // Stop experiment if loss detected (Safety Layer Step 10)
      if (isLossSignificant) {
         console.warn(`[Testing Engine] Loss Detected! Variant ${vid} is hurting conversion. Z-Score: ${zScore.toFixed(2)}. Pausing.`);
         await pauseVariant(vid);
      }
    }
  }
}

export async function markWinner(experiment_id: string, variant_id: string) {
   // Shut down the experiment and promote the winner config to the hybrid engine rules (abstracted for now)
   await query(`UPDATE nolix_experiments SET status = 'completed', end_date = NOW() WHERE id = $1`, [experiment_id]);
   console.log(`Experiment ${experiment_id} locked. Winner: ${variant_id} promoted.`);
}

export async function pauseVariant(variant_id: string) {
   await query(`UPDATE nolix_experiment_variants SET traffic_allocation = 0 WHERE id = $1`, [variant_id]);
}
