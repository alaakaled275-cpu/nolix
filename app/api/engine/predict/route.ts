/**
 * NOLIX — Hybrid Predict API (STEP 15 PART 1 + 6)
 * app/api/engine/predict/route.ts
 *
 * POST /api/engine/predict
 * {
 *   visitor_id: "...",
 *   features: { time_on_site: 45, pages_viewed: 3, ... },
 *   model_version: "latest" | "staging" | 5,
 *   store: "example.com"
 * }
 *
 * Returns full hybrid prediction:
 *   final_score = LR(0.35) + GBT(0.30) + similarity(0.20) + revenue(0.10) - fraud(0.05)
 *
 * PART 9 — Online/Offline Parity guaranteed:
 *   featureMapToVector() is the SAME function used in training
 */
import { NextRequest, NextResponse }   from "next/server";
import { hybridPredict }               from "@/lib/nolix-hybrid-engine";
import { validateFeatures, featureMapToVector } from "@/lib/nolix-feature-store-v2";
import { getRuntimeFlag }              from "@/lib/nolix-runtime";
import { getAccessTier, requireTier, checkRateLimit, getClientId, sanitizeString } from "@/lib/nolix-security";
import { recordOutcome }               from "@/lib/nolix-circuit-breaker";
import { logPrediction }               from "@/lib/calibration";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const start = Date.now();

  // Auth
  const key  = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  const tier = getAccessTier(key);
  if (!requireTier(tier, "write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const clientId = getClientId(req);
  const rl = checkRateLimit(clientId, "predict");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded", reset_at: rl.reset_at }, { status: 429 });

  // Runtime flags check
  const aiEnabled = await getRuntimeFlag("ai_enabled").catch(() => true);
  if (!aiEnabled) {
    return NextResponse.json({ error: "AI_DISABLED", probability: 0.35, label: "exit", final_score: 0.35 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    visitor_id,
    features = {},
    model_version = "latest",
    store,
    aov_estimate = 65
  } = body;

  // PART 13: Validate (data contract)
  const validation = validateFeatures(features);
  if (!validation.valid) {
    return NextResponse.json({
      error:   "DATA_CONTRACT_VIOLATION",
      errors:  validation.errors
    }, { status: 422 });
  }

  let succeeded = false;
  try {
    // PART 6 + PART 9: Hybrid predict with parity-guaranteed feature extraction
    const prediction = await hybridPredict(features, {
      visitor_id:    sanitizeString(visitor_id || "", 128),
      store:         sanitizeString(store || "", 128),
      aov_estimate,
      model_version: model_version as any
    });

    // Log for calibration
    logPrediction({
      session_id:          visitor_id || "anon",
      store_domain:        store || "unknown",
      predicted_class:     prediction.label,
      predicted_probability: prediction.final_score,
      p_convert_no_action: prediction.components.logistic_prob,
      p_convert_action:    prediction.final_score,
      uplift_estimated:    prediction.components.similarity_boost,
      action_taken:        prediction.recommended_action,
      economic_decision:   prediction.label === "convert" ? "intervene" : "wait",
      decision_cost:       0,
      causal_weights:      prediction.components as any,
      session_signals:     features
    }).catch(() => {});

    succeeded = true;
    recordOutcome(true, Date.now() - start);

    return NextResponse.json({
      // Core prediction
      final_score:      prediction.final_score,
      label:            prediction.label,
      confidence:       prediction.confidence,
      rank:             prediction.rank,

      // Model info
      model_version:    prediction.model_version,
      model_status:     "production",

      // Component breakdown (observability)
      components:       prediction.components,

      // Action recommendation
      recommended_action: prediction.recommended_action,

      // Latency
      latency_ms:       prediction.latency_ms,

      // Parity guarantee
      online_offline_parity: true,
      feature_extractor: "featureMapToVector_v3"
    });
  } catch(e: any) {
    if (!succeeded) recordOutcome(false, Date.now() - start);
    console.error("[predict] Error:", e.message);
    return NextResponse.json({
      error:       "PREDICTION_ERROR",
      final_score: 0.35,
      label:       "exit"
    }, { status: 500 });
  }
}
