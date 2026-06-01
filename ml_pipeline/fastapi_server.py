from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import json
from config import get_db_connection

app = FastAPI(title="ZenoAI Inference Engine")

class PredictionRequest(BaseModel):
    store_domain: str
    sessionDurationMs: int
    pagesViewed: int
    scrollDepth: int
    device: str
    source: str
    intentScore: int
    triggerEvent: str 
    cartValue: float
    botScore: int            # Layer 5 (Bot Filter)
    discountHistoryCount: int # Layer 6 (Cannibalization)
    holdoutSize: int         # Layer 3 (Holdout Validity)

@app.post("/predict")
def predict_uplift(req: PredictionRequest):
    """
    ZenoAI Revenue Truth Layer (RTL) - Autonomous Revenue Operating System
    """
    try:
        # ─── RTL METRICS INIT ───
        causal_confidence = 100
        attribution_confidence = 100
        data_validity = 100
        leakage_check = "PASS"
        holdout_validity = "PASS"
        safe_mode = False
        reasoning = []

        # ─── LAYER 5: BOT & DATA QUALITY FILTER ───
        if req.botScore > 80 or req.sessionDurationMs < 500:
            data_validity = 0
            reasoning.append("Bot detected or impossible behavior.")

        # ─── LAYER 1: DATA LEAKAGE PREVENTION ───
        # In a real pipeline, we check timestamps. Here, we enforce logic:
        if req.triggerEvent not in ['mouse_exit', 'cart_open', 'multiple_views', 'pause', 'scroll']:
            leakage_check = "FAIL"
            data_validity = min(data_validity, 50)
            reasoning.append("Leakage risk: Event is not a pre-intervention signal.")

        # ─── LAYER 3: HOLDOUT VALIDITY CONTROL ───
        if req.holdoutSize < 500:
            holdout_validity = "LOW_CONFIDENCE"
            causal_confidence -= 30
            reasoning.append("Holdout sample too small (<500).")

        # ─── RTL ENFORCEMENT: SAFE MODE CHECK ───
        if causal_confidence < 70 or data_validity < 70 or leakage_check == "FAIL":
            safe_mode = True
            return {
                "success": True,
                "recommended_action": "Do Nothing",
                "expected_conversion_lift": 0.0,
                "profit_impact_prediction": 0.0,
                "reasoning": "RTL SAFE MODE ACTIVATED: " + " | ".join(reasoning),
                "causal_confidence": causal_confidence,
                "data_validity": data_validity,
                "leakage_check": leakage_check,
                "holdout_validity": holdout_validity,
                "baseline_prob": 0.01
            }

        conn = get_db_connection()
        cur = conn.cursor()
        
        # ─── INTENT COMPRESSION ENGINE ───
        intent_level = "Low"
        if req.intentScore > 75 or req.triggerEvent == 'cart_open':
            intent_level = "High"
        elif req.intentScore > 40 or req.pagesViewed >= 3:
            intent_level = "Medium"

        # ─── DECISION TIMING ENGINE ───
        valid_timing = req.triggerEvent in ['mouse_exit', 'cart_open', 'multiple_views', 'pause']
        if not valid_timing:
            return {
                "success": True,
                "recommended_action": "Do Nothing",
                "expected_conversion_lift": 0.0,
                "profit_impact_prediction": 0.0,
                "reasoning": "Timing Engine: Not an optimal intervention moment.",
                "causal_confidence": causal_confidence,
                "data_validity": data_validity,
                "leakage_check": leakage_check,
                "holdout_validity": holdout_validity,
                "baseline_prob": 0.01
            }

        # ─── LAYER 4: OVERFITTING PROTECTION (Bayesian Shrinkage) ───
        cur.execute("""
            SELECT feature_weights, intercept, sample_size 
            FROM bic_baseline_model 
            WHERE store_domain = %s 
            ORDER BY trained_at DESC LIMIT 1
        """, (req.store_domain,))
        model_data = cur.fetchone()
        
        w_duration, w_pages, w_intent = 0.0001, 0.05, 0.01
        intercept = -3.5
        model_sample_size = 0
        
        if model_data:
            weights = model_data['feature_weights']
            intercept = float(model_data['intercept'])
            model_sample_size = model_data.get('sample_size', 0)
            w_duration = float(weights.get('duration', w_duration))
            w_pages = float(weights.get('pages', w_pages))
            w_intent = float(weights.get('intent', w_intent))

        # Overfitting Rule: If < 1000 conversions, apply heuristic fallback
        if model_sample_size < 1000:
            causal_confidence -= 10
            # Bayesian shrinkage toward global baseline (-3.5)
            intercept = (intercept * model_sample_size + (-3.5) * 1000) / (model_sample_size + 1000)

        durationSecs = req.sessionDurationMs / 1000
        z = intercept + (w_duration * durationSecs) + (w_pages * req.pagesViewed) + (w_intent * req.intentScore)
        if req.device == 'desktop': z += 0.2
        if req.source == 'ads': z -= 0.1
        
        import math
        baseline_prob = 1 / (1 + math.exp(-z))
        
        uplift_score = baseline_prob * 0.5
        if intent_level == "High": uplift_score = baseline_prob * 1.5
        elif intent_level == "Medium": uplift_score = baseline_prob * 1.0

        # ─── LAYER 6: DISCOUNT CANNIBALIZATION CONTROL ───
        if req.discountHistoryCount > 0:
            uplift_score *= (0.5 ** req.discountHistoryCount) # Exponential penalty
            reasoning.append(f"Cannibalization protection: Uplift penalized due to {req.discountHistoryCount} past discounts.")

        # ─── OFFER PRECISION ENGINE ───
        recommended_action = "Do Nothing"
        discount_cost = 0.0
        
        if intent_level == "High":
            recommended_action = "trust_urgency"
            reasoning.append("High intent: No discount. Added trust signals.")
        elif intent_level == "Medium":
            recommended_action = "bundle_offer"
            reasoning.append("Medium intent: Offering bundle.")
            discount_cost = req.cartValue * 0.10
        elif intent_level == "Low" and req.triggerEvent == 'mouse_exit':
            if uplift_score > 0.02 and req.discountHistoryCount == 0: 
                recommended_action = "small_incentive"
                reasoning.append("Low intent exit: Marginal soft incentive allowed.")
                discount_cost = req.cartValue * 0.05
            else:
                reasoning.append("Low intent exit: Denied incentive (profit risk or cannibalization).")

        # ─── PROFIT PROTECTION ENGINE ───
        profit_impact_prediction = 0.0
        if recommended_action != "Do Nothing":
            expected_incremental_revenue = uplift_score * req.cartValue
            profit_impact_prediction = expected_incremental_revenue - discount_cost
            if profit_impact_prediction < 0:
                recommended_action = "Do Nothing"
                reasoning.append("Aborted: Net profit impact is negative.")
                profit_impact_prediction = 0.0

        return {
            "success": True,
            "recommended_action": recommended_action,
            "expected_conversion_lift": round(uplift_score * 100, 2),
            "profit_impact_prediction": round(profit_impact_prediction, 2),
            "reasoning": " | ".join(reasoning),
            "causal_confidence": causal_confidence,
            "attribution_confidence": attribution_confidence,
            "data_validity": data_validity,
            "leakage_check": leakage_check,
            "holdout_validity": holdout_validity,
            "baseline_prob": round(baseline_prob, 4)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
