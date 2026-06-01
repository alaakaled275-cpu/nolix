/**
 * NOLIX — Enhanced Decision Engine API
 * app/api/engine/decide-v3/route.ts
 *
 * Combines:
 * 1. Multi-dimensional hesitation analysis
 * 2. Causal inference
 * 3. Learning loop feedback
 * 4. A/B testing
 */

import { NextRequest, NextResponse } from "next/server";
import { makeDecision } from "@/lib/nolix-decision-engine";
import { analyzeHesitation } from "@/lib/nolix-hesitation-analyzer";
import { extractTenantDomain, resolveTenantContext } from "@/lib/nolix-tenant";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      session_id,
      visitor_id,
      features,
      hesitation_features,
      store
    } = body;

    const tenant = store || extractTenantDomain(request);

    if (!tenant || tenant === "unknown") {
      return NextResponse.json(
        { error: "Store domain required" },
        { status: 400 }
      );
    }

    // === STEP 1: Multi-dimensional hesitation analysis ===
    let hesitationProfile = null;
    if (hesitation_features) {
      hesitationProfile = await analyzeHesitation(session_id, hesitation_features);
    }

    // === STEP 2: Make decision (ML + rules) ===
    let decision = null;
    if (features && features.length === 8) {
      decision = await makeDecision({
        visitor_id: visitor_id || session_id,
        features,
        coupon_abuse_severity: 0,
        visit_count: 1,
        current_vector: features,
        store: tenant
      });
    }

    // === STEP 3: Override with hesitation-based recommendation ===
    let finalDecision = {
      action: "observe",
      discount_pct: 0,
      popup_type: "none",
      message: "",
      reason: "no_intervention_needed",
      confidence: 0
    };

    if (hesitationProfile) {
      const rec = hesitationProfile.recommended_action;
      
      // Use hesitation recommendation if higher priority
      if (rec.priority > 0) {
        finalDecision = {
          action: rec.action,
          discount_pct: rec.discount_pct,
          popup_type: rec.popup_type,
          message: rec.message,
          reason: `hesitation_${rec.action}`,
          confidence: hesitationProfile.confidence
        };
      }
    }

    // Override with ML decision if higher confidence
    if (decision && decision.confidence > finalDecision.confidence && decision.action !== "observe") {
      finalDecision = {
        action: decision.action,
        discount_pct: decision.discount_pct,
        popup_type: decision.discount_tier,
        message: decision.reason,
        reason: `ml_${decision.reason}`,
        confidence: decision.confidence
      };
    }

    // === STEP 4: Store intervention plan ===
    if (redis && finalDecision.action !== "observe") {
      const interventionPlan = JSON.stringify({
        session_id,
        store: tenant,
        action: finalDecision.action,
        discount_pct: finalDecision.discount_pct,
        timestamp: Date.now()
      });
      await redis.setex(`intervention:${session_id}`, 24 * 3600, interventionPlan);
    }

    // === STEP 5: Return combined decision ===
    return NextResponse.json({
      // Decision
      action: finalDecision.action,
      discount_pct: finalDecision.discount_pct,
      popup_type: finalDecision.popup_type,
      message: finalDecision.message,
      reason: finalDecision.reason,
      confidence: finalDecision.confidence,

      // Analysis (for transparency)
      hesitation: hesitationProfile ? {
        overall_score: hesitationProfile.overall_score,
        time_score: hesitationProfile.time_score,
        action_score: hesitationProfile.action_score,
        intent_score: hesitationProfile.intent_score,
        price_score: hesitationProfile.price_score,
        exit_score: hesitationProfile.exit_score
      } : null,

      // ML (if available)
      ml: decision ? {
        final_score: decision.final_score,
        ml_score: decision.ml_score,
        similarity_boost: decision.similarity_boost,
        fraud_penalty: decision.fraud_penalty,
        ab_group: decision.ab_group
      } : null
    });
  } catch (error: any) {
    console.error("❌ ENHANCED DECIDE ERROR:", error.message);
    return NextResponse.json(
      { 
        action: "observe",
        error: "Decision engine unavailable" 
      },
      { status: 500 }
    );
  }
}