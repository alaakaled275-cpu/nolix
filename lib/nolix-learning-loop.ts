/**
 * NOLIX — Closed-Loop Learning System
 * lib/nolix-learning-loop.ts
 *
 * THE missing piece: System learns from success/failure.
 * Tracks: Interventions → Outcomes → Model Updates
 */

import { redis } from "./redis";
import { query } from "./db";
import { calculateCausalScore, recordInterventionOutcome, getSyntheticControl } from "./nolix-causal-engine";

// ============================================================
// LEARNING EVENT TYPES
// ============================================================
export type LearningEventType =
  | "intervention_shown"
  | "discount_applied"
  | "popup_dismissed"
  | "popup_clicked"
  | "conversion"
  | "abandonment"
  | "wasted_discount";

// Learning event structure
export interface LearningEvent {
  event_type: LearningEventType;
  session_id: string;
  store: string;
  visitor_id: string;

  // Intervention details
  intervention_type?: "popup" | "discount" | "message" | "nothing";
  discount_pct?: number;
  popup_type?: string;

  // Outcome
  converted?: boolean;
  revenue?: number;

  // Timing
  timestamp: number;
  time_to_conversion?: number; // seconds from intervention to conversion
  time_to_dismiss?: number;  // seconds from popup shown to dismiss
}

// Learning feedback for model
export interface ModelFeedback {
  session_id: string;
  intervention_type: string;
  discount_pct: number;
  hesitation_score: number;
  engagement_score: number;
  outcome: "converted" | "dismissed" | "ignored";
  reward: number; // +1 for conversion, -1 for wasted discount
  causal_credit: number; // how much intervention contributed
}

// ============================================================
// EVENT COLLECTION
// ============================================================

/**
 * Record a learning event
 */
export async function recordLearningEvent(event: LearningEvent): Promise<void> {
  if (!redis) return;

  const key = `learning_event:${event.session_id}:${event.timestamp}`;
  const data = JSON.stringify(event);

  // Store for 30 days
  await redis.setex(key, 30 * 24 * 3600, data);

  // Also add to streaming queue for real-time processing
  await redis.lpush(`learning_queue:${event.store}`, key);
  await redis.ltrim(`learning_queue:${event.store}`, 0, 9999); // Keep last 10k
}

// ============================================================
// REAL-TIME FEEDBACK PROCESSING
// ============================================================

/**
 * Process conversion event - THIS IS THE KEY LOOP CLOSER
 */
export async function processConversionFeedback(
  session_id: string,
  store: string,
  revenue: number
): Promise<ModelFeedback | null> {
  // Get original intervention
  const interventionKey = `intervention:${session_id}`;

  let intervention: any = null;
  if (redis) {
    const data = await redis.get(interventionKey);
    if (data) intervention = JSON.parse(data);
  }

  if (!intervention) {
    // Try database
    try {
      const result = await query(`
        SELECT intervention_type, discount_pct, hesitation_score, engagement_score
        FROM nolix_sessions
        WHERE session_id = $1
      `, [session_id]);

      if (result.length > 0) {
        intervention = result[0];
      }
    } catch (e) { /* ignore */ }
  }

  if (!intervention) return null;

  // Calculate reward based on outcome
  let reward = 0;
  let outcome: "converted" | "dismissed" | "ignored" = "ignored";
  let causalCredit = 0;

  if (revenue > 0) {
    outcome = "converted";
    reward = 1;

    // High causal credit if hesitation was high AND got discount
    if (intervention.discount_pct > 0 && intervention.hesitation_score > 0.5) {
      causalCredit = 1;
    } else if (intervention.discount_pct > 0) {
      causalCredit = 0.7;
    } else {
      causalCredit = 0.3;
    }
  }

  const feedback: ModelFeedback = {
    session_id,
    intervention_type: intervention.intervention_type || "nothing",
    discount_pct: intervention.discount_pct || 0,
    hesitation_score: intervention.hesitation_score || 0,
    engagement_score: intervention.engagement_score || 0,
    outcome,
    reward,
    causal_credit: causalCredit
  };

  // Store feedback for batch training
  if (redis) {
    await redis.lpush(`model_feedback:${store}`, JSON.stringify(feedback));
    await redis.ltrim(`model_feedback:${store}`, 0, 9999);
  }

  // Record outcome for causal analysis
  await recordInterventionOutcome(
    session_id,
    intervention.intervention_type || "nothing",
    intervention.discount_pct || 0,
    true,
    revenue
  );

  return feedback;
}

/**
 * Process abandonment/wasted discount
 */
export async function processWastedDiscountFeedback(
  session_id: string,
  store: string
): Promise<ModelFeedback | null> {
  const interventionKey = `intervention:${session_id}`;

  let intervention: any = null;
  if (redis) {
    const data = await redis.get(interventionKey);
    if (data) intervention = JSON.parse(data);
  }

  if (!intervention || intervention.discount_pct === 0) return null;

  // Wasted discount = negative reward
  const feedback: ModelFeedback = {
    session_id,
    intervention_type: intervention.intervention_type || "nothing",
    discount_pct: intervention.discount_pct || 0,
    hesitation_score: intervention.hesitation_score || 0,
    engagement_score: intervention.engagement_score || 0,
    outcome: "ignored",
    reward: -1, // Negative reward!
    causal_credit: 0.1 // Small credit - they would have left anyway
  };

  if (redis) {
    await redis.lpush(`model_feedback:${store}`, JSON.stringify(feedback));
  }

  return feedback;
}

// ============================================================
// BATCH LEARNING AGGREGATION
// ============================================================

/**
 * Get feedback batch for model training
 */
export async function getFeedbackBatch(
  store: string,
  batch_size: number = 1000
): Promise<ModelFeedback[]> {
  if (!redis) return [];

  const key = `model_feedback:${store}`;
  const feedbacks = await redis.lrange(key, 0, batch_size - 1);

  return feedbacks.map(f => {
    try {
      return JSON.parse(f);
    } catch {
      return null;
    }
  }).filter(Boolean) as ModelFeedback[];
}

/**
 * Calculate reward signal for training
 * Using: reward = causal_credit * (converted ? +1 : -1)
 */
export function calculateRewardSignal(
  intervention_type: string,
  discount_pct: number,
  hesitation_score: number,
  converted: boolean,
  revenue: number
): number {
  // Base reward
  let signal = converted ? 1 : 0;

  // Discount penalty if no conversion (wasted)
  if (!converted && discount_pct > 0) {
    signal = -0.5; // Penalty for wasting discount
  }

  // Hesitation adjustment
  // High hesitation + conversion = high reward (intervention worked)
  // High hesitation + no conversion = low penalty (would have left anyway)
  if (hesitation_score > 0.7 && converted) {
    signal *= 1.5;
  } else if (hesitation_score > 0.7 && !converted) {
    signal *= 0.2; // Reduce penalty
  }

  // Discount size adjustment
  // Small discount + conversion = high efficiency
  if (converted && discount_pct <= 5) {
    signal *= 1.3;
  } else if (converted && discount_pct >= 15) {
    signal *= 0.7; // Reduce reward for large discounts
  }

  return signal;
}

// ============================================================
// LEARNING STATS
// ============================================================

export interface LearningStats {
  total_feedbacks: number;
  conversions: number;
  wasted_discounts: number;
  avg_reward: number;
  positive_rate: number;
  negative_rate: number;
  efficiency_score: number; // conversions / discounts given
}

/**
 * Get learning statistics for a store
 */
export async function getLearningStats(store: string): Promise<LearningStats> {
  const key = `model_feedback:${store}`;
  if (!redis) {
    return {
      total_feedbacks: 0,
      conversions: 0,
      wasted_discounts: 0,
      avg_reward: 0,
      positive_rate: 0,
      negative_rate: 0,
      efficiency_score: 0
    };
  }

  const feedbacks = await redis.lrange(key, 0, -1);
  let total = 0;
  let conversions = 0;
  let wasted = 0;
  let rewardSum = 0;

  for (const f of feedbacks) {
    try {
      const fb = JSON.parse(f);
      total++;
      rewardSum += fb.reward || 0;
      if (fb.outcome === "converted") {
        conversions++;
      } else if (fb.reward < 0) {
        wasted++;
      }
    } catch { /* skip */ }
  }

  const avgReward = total > 0 ? rewardSum / total : 0;
  const posRate = total > 0 ? conversions / total : 0;
  const negRate = total > 0 ? wasted / total : 0;
  const efficiency = wasted > 0 ? conversions / wasted : 0;

  return {
    total_feedbacks: total,
    conversions,
    wasted_discounts: wasted,
    avg_reward: avgReward,
    positive_rate: posRate,
    negative_rate: negRate,
    efficiency_score: efficiency
  };
}

// ============================================================
// ADAPTIVE LEARNING RATES
// ============================================================

/**
 * Adjust learning parameters based on performance
 */
export async function getAdaptiveLearningRates(
  store: string
): Promise<{ lr: number; lambda: number }> {
  const stats = await getLearningStats(store);

  // If doing well, reduce learning rate (fine-tuning)
  // If doing poorly, increase learning rate (exploration)
  let lr = 0.01;
  let lambda = 0.001;

  if (stats.efficiency_score > 2) {
    lr = 0.005; // Fine-tune
    lambda = 0.002; // More regularization
  } else if (stats.efficiency_score < 0.5) {
    lr = 0.02; // Explore more
    lambda = 0.0005; // Less regularization
  }

  return { lr, lambda };
}

// ============================================================
// AUTO-LEARNING TRIGGER
// ============================================================

/**
 * Check if we should trigger model retraining
 */
export async function shouldRetrain(store: string): Promise<{
  should_train: boolean;
  reason: string;
  confidence: number;
}> {
  const stats = await getLearningStats(store);

  // Need minimum samples
  if (stats.total_feedbacks < 100) {
    return {
      should_train: false,
      reason: "insufficient_data",
      confidence: 0
    };
  }

  // Check if model is drifting
  if (stats.positive_rate < 0.1) {
    return {
      should_train: true,
      reason: "poor_conversion_rate",
      confidence: 0.9
    };
  }

  // Check if too many wasted discounts
  if (stats.negative_rate > 0.5) {
    return {
      should_train: true,
      reason: "high_waste_rate",
      confidence: 0.85
    };
  }

  // Good performance - occasional retraining for improvement
  if (stats.total_feedbacks > 1000 && stats.positive_rate > 0.3) {
    return {
      should_train: true,
      reason: "routine_update",
      confidence: 0.6
    };
  }

  return {
    should_train: false,
    reason: "stable",
    confidence: 0.5
  };
}