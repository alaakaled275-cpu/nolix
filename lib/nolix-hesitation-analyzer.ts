/**
 * NOLIX — Multi-Dimensional Hesitation Analyzer
 * lib/nolix-hesitation-analyzer.ts
 *
 * REPLACES binary hesitation (0-1) with multi-dimensional scoring.
 * Dimensions:
 * 1. Time Hesitation (idle + active time)
 * 2. Action Hesitation (mouse movement, scroll)
 * 3. Intent Hesitation (pages viewed, search, comparisons)
 * 4. Price Sensitivity (coupon seeking, cart abandonment)
 * 5. Exit Risk (exit intent, tab switching)
 */

import { redis } from "./redis";
import { query } from "@/lib/db";

// ============================================================
// MULTI-DIMENSIONAL HESITATION SCORE
// ============================================================
export interface HesitationProfile {
  // Overall scores (0-1)
  overall_score: number;         // Final hesitation score
  
  // Dimension scores
  time_score: number;            // Time-based hesitation
  action_score: number;          // Movement/engagement hesitation
  intent_score: number;          // Intent signals hesitation
  price_score: number;           // Price sensitivity
  exit_score: number;            // Exit risk score
  
  // Behavioral signals
  signals: HesitationSignal[];
  
  // Confidence in assessment
  confidence: number;
  
  // Recommended action
  recommended_action: InterventionRecommendation;
}

export interface HesitationSignal {
  type: string;
  value: number;
  weight: number;
  timestamp: number;
}

export interface InterventionRecommendation {
  action: "show_popup" | "offer_discount" | "show_message" | "observe" | "retarget";
  discount_pct: number;
  popup_type: string;
  message: string;
  priority: number;
  urgency: "immediate" | "soon" | "wait";
}

// ============================================================
// BEHAVIORAL SIGNAL COLLECTION
// ============================================================

export async function analyzeHesitation(
  session_id: string,
  features: {
    idle_time_seconds: number;
    active_time_seconds: number;
    mouse_moves: number;
    mouse_stops: number;
    scroll_depth: number;
    scroll_ups: number;
    scroll_downs: number;
    pages_viewed: number;
    product_views: number;
    search_attempts: number;
    cart_adds: number;
    cart_removes: number;
    coupon_attempts: number;
    back_navigation: number;
    tab_switches: number;
    exit_intent: boolean;
    time_on_site: number;
  }
): Promise<HesitationProfile> {
  const signals: HesitationSignal[] = [];
  let signalCount = 0;

  // === DIMENSION 1: TIME HESITATION ===
  // High idle time + low active time = hesitation
  const idleRatio = features.idle_time_seconds / (features.time_on_site + 1);
  const activeRatio = features.active_time_seconds / (features.time_on_site + 1);
  
  const timeScore = Math.min(1, 
    (idleRatio * 0.6) + 
    ((1 - activeRatio) * 0.4)
  );
  
  signals.push({
    type: "time_hesitation",
    value: idleRatio,
    weight: 0.25,
    timestamp: Date.now()
  });
  signalCount++;

  // === DIMENSION 2: ACTION HESITATION ===
  // Few mouse moves, many stops = hesitation
  const mouseStopRatio = features.mouse_stops / (features.mouse_moves + 1);
  const scrollRatio = (features.scroll_ups + features.scroll_downs) / (features.active_time_seconds / 30 + 1);
  
  const actionScore = Math.min(1,
    (mouseStopRatio * 0.5) +
    ((1 - scrollRatio) * 0.5)
  );
  
  signals.push({
    type: "action_hesitation",
    value: mouseStopRatio,
    weight: 0.20,
    timestamp: Date.now()
  });
  signalCount++;

  // === DIMENSION 3: INTENT HESITATION ===
  // Many product views but no purchase = considering
  const productViewRatio = features.product_views / (features.pages_viewed + 1);
  const searchRatio = features.search_attempts / (features.pages_viewed + 1);
  const backNavRatio = features.back_navigation / (features.pages_viewed + 1);
  
  const intentScore = Math.min(1,
    (productViewRatio * 0.5) +
    (searchRatio * 0.3) +
    (backNavRatio * 0.2)
  );
  
  signals.push({
    type: "intent_hesitation",
    value: productViewRatio,
    weight: 0.20,
    timestamp: Date.now()
  });
  signalCount++;

  // === DIMENSION 4: PRICE SENSITIVITY ===
  // Cart adds + removes + coupon attempts = price sensitivity
  const cartAbandonmentRatio = features.cart_removes / (features.cart_adds + 1);
  const couponSeeking = features.coupon_attempts > 0 ? 1 : 0;
  
  const priceScore = Math.min(1,
    (cartAbandonmentRatio * 0.6) +
    (couponSeeking * 0.4)
  );
  
  signals.push({
    type: "price_sensitivity",
    value: priceScore,
    weight: 0.20,
    timestamp: Date.now()
  });
  signalCount++;

  // === DIMENSION 5: EXIT RISK ===
  // Exit intent + tab switches = high exit risk
  const exitIntentSignal = features.exit_intent ? 1 : 0;
  const tabSwitchRate = features.tab_switches / (features.active_time_seconds / 60 + 1);
  
  const exitScore = Math.min(1,
    (exitIntentSignal * 0.7) +
    (tabSwitchRate * 0.3)
  );
  
  signals.push({
    type: "exit_risk",
    value: exitScore,
    weight: 0.15,
    timestamp: Date.now()
  });
  signalCount++;

  // === WEIGHTED OVERALL SCORE ===
  const weights = [0.25, 0.20, 0.20, 0.20, 0.15];
  const scores = [timeScore, actionScore, intentScore, priceScore, exitScore];
  
  let overallScore = 0;
  for (let i = 0; i < scores.length; i++) {
    overallScore += scores[i] * weights[i];
  }

  // Confidence based on amount of data
  const confidence = Math.min(1, signalCount / 5);

  // === RECOMMENDATION ENGINE ===
  const recommendation = generateRecommendation(
    overallScore,
    timeScore,
    actionScore,
    intentScore,
    priceScore,
    exitScore
  );

  // Store for later analysis
  if (redis) {
    const profileData = JSON.stringify({
      overall_score: overallScore,
      time_score: timeScore,
      action_score: actionScore,
      intent_score: intentScore,
      price_score: priceScore,
      exit_score: exitScore,
      recommendation,
      timestamp: Date.now()
    });
    await redis.setex(`hesitation_profile:${session_id}`, 24 * 3600, profileData);
  }

  return {
    overall_score: overallScore,
    time_score: timeScore,
    action_score: actionScore,
    intent_score: intentScore,
    price_score: priceScore,
    exit_score: exitScore,
    signals,
    confidence,
    recommended_action: recommendation
  };
}

// ============================================================
// RECOMMENDATION ENGINE
// ============================================================

function generateRecommendation(
  overall: number,
  time: number,
  action: number,
  intent: number,
  price: number,
  exit: number
): InterventionRecommendation {
  // === EXIT RISK IS CRITICAL ===
  if (exit > 0.7) {
    return {
      action: "show_popup",
      discount_pct: 10,
      popup_type: "exit_intent",
      message: "🚫 الانتظار يكلفك المال! احصل على خصم 10% الآن",
      priority: 1,
      urgency: "immediate"
    };
  }

  // === PRICE SENSITIVITY + HIGH INTENT ===
  if (price > 0.6 && intent > 0.5) {
    return {
      action: "offer_discount",
      discount_pct: 5,
      popup_type: "price_objection",
      message: "💰 خصم خاص لك - اشترِ اليوم!",
      priority: 2,
      urgency: "soon"
    };
  }

  // === TIME HESITATION + LOW ACTION ===
  if (time > 0.6 && action > 0.5) {
    return {
      action: "show_message",
      discount_pct: 0,
      popup_type: "engagement",
      message: "❓ هل تحتاج مساعدة في اختيار المنتج؟",
      priority: 3,
      urgency: "soon"
    };
  }

  // === MODERATE HESITATION ===
  if (overall > 0.5) {
    return {
      action: "show_popup",
      discount_pct: 5,
      popup_type: "gentle_nudge",
      message: "🎁 عرض خاص لك!",
      priority: 4,
      urgency: "wait"
    };
  }

  // === LOW HESITATION - NO INTERVENTION NEEDED ===
  return {
    action: "observe",
    discount_pct: 0,
    popup_type: "none",
    message: "",
    priority: 0,
    urgency: "wait"
  };
}

// ============================================================
// AGGREGATE HESITATION ANALYSIS
// ============================================================

export async function getStoreHesitationStats(
  store: string,
  hours: number = 24
): Promise<{
  avg_hesitation: number;
  high_risk_count: number;
  intervention_count: number;
  conversion_by_risk: Record<string, number>;
}> {
  const cutoff = Date.now() - hours * 3600 * 1000;

  // Query aggregate hesitation scores
  const sql = `
    SELECT
      AVG(hesitation_score) as avg_score,
      COUNT(CASE WHEN hesitation_score > 0.7 THEN 1 END) as high_risk,
      COUNT(CASE WHEN intervention_type != 'nothing' THEN 1 END) as interventions,
      SUM(CASE WHEN hesitation_score > 0.7 AND converted THEN 1 ELSE 0 END) as high_risk_conv,
      SUM(CASE WHEN hesitation_score <= 0.7 AND converted THEN 1 ELSE 0 END) as low_risk_conv
    FROM nolix_sessions
    WHERE store = $1 AND created_at > $2
  `;

  try {
    const result = await query<any>(sql, [store, cutoff]);
    const row = result[0];

    return {
      avg_hesitation: parseFloat(row.avg_score || '0'),
      high_risk_count: parseInt(row.high_risk || '0'),
      intervention_count: parseInt(row.interventions || '0'),
      conversion_by_risk: {
        high_risk: parseInt(row.high_risk_conv || '0'),
        low_risk: parseInt(row.low_risk_conv || '0')
      }
    };
  } catch (e) {
    return {
      avg_hesitation: 0,
      high_risk_count: 0,
      intervention_count: 0,
      conversion_by_risk: { high_risk: 0, low_risk: 0 }
    };
  }
}

// ============================================================
// REAL-TIME HESITATION UPDATES
// ============================================================

/**
 * Update hesitation score in real-time as user behaviors are tracked
 */
export async function updateRealTimeHesitation(
  session_id: string,
  newSignals: {
    type: string;
    value: number;
  }[]
): Promise<number | null> {
  const key = `hesitation_profile:${session_id}`;
  
  if (!redis) return null;
  
  const existing = await redis.get(key);
  if (!existing) return null;
  
  const profile = JSON.parse(existing);
  
  // Update with new signals (simple weighted average)
  for (const signal of newSignals) {
    const existingSignal = profile.signals?.find((s: any) => s.type === signal.type);
    if (existingSignal) {
      // Decay old signal, add new
      existingSignal.value = existingSignal.value * 0.7 + signal.value * 0.3;
    } else {
      profile.signals.push({
        type: signal.type,
        value: signal.value,
        weight: 0.1,
        timestamp: Date.now()
      });
    }
  }
  
  // Recalculate overall (simplified)
  const timeScore = profile.time_score || 0;
  const actionScore = profile.action_score || 0;
  const intentScore = profile.intent_score || 0;
  const priceScore = profile.price_score || 0;
  const exitScore = profile.exit_score || 0;
  
  profile.overall_score = 
    (timeScore * 0.25) +
    (actionScore * 0.20) +
    (intentScore * 0.20) +
    (priceScore * 0.20) +
    (exitScore * 0.15);
  
  await redis.setex(key, 24 * 3600, JSON.stringify(profile));
  
  return profile.overall_score;
}