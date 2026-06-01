"""
ai_brain.py — NOLIX Phase 2: True Learning AI
RandomForest + Continuous Learning + Causal Uplift + Multi-Armed Bandit
"""

import os, json, logging, threading, time
from datetime import datetime
from typing import Optional

import numpy as np
import joblib
import schedule
import psycopg2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AI] %(levelname)s: %(message)s")
log = logging.getLogger("ai_brain")

MODEL_PATH  = "model.pkl"
DB_URL      = os.getenv("DATABASE_URL", "")

# ── Feature Engineering ───────────────────────────────────────────────────────
FEATURE_NAMES = [
    "time_on_page", "scroll_depth", "clicks", "hesitation_score",
    "engagement_score", "click_rate", "engagement_ratio", "scroll_velocity",
    "is_mobile", "is_night", "is_returning", "cart_score"
]

def extract_features(data: dict, context: dict = {}) -> np.ndarray:
    t   = max(float(data.get("time_on_page", 0)), 0.001)
    sd  = float(data.get("scroll_depth", 0))
    cl  = float(data.get("clicks", 0))
    hes = float(data.get("hesitation_score", 0))
    eng = float(data.get("engagement_score", 0))

    click_rate       = cl / t
    engagement_ratio = eng / t if t > 0 else 0
    scroll_velocity  = sd / t if t > 0 else 0

    cart = data.get("cart_status", "unknown")
    cart_score = {"checkout": 1.0, "added": 0.6, "viewed": 0.3, "unknown": 0.0}.get(cart, 0.0)

    hour = datetime.utcnow().hour
    is_night = 1.0 if hour >= 22 or hour <= 5 else 0.0

    device = str(context.get("device", data.get("device", ""))).lower()
    is_mobile = 1.0 if "mobile" in device else 0.0

    is_returning = float(context.get("returning_user", data.get("returning_user", False)))

    return np.array([
        min(t / 120, 1.0), min(sd / 100, 1.0), min(cl / 10, 1.0),
        hes, eng,
        min(click_rate * 10, 1.0), min(engagement_ratio, 1.0), min(scroll_velocity, 1.0),
        is_mobile, is_night, is_returning, cart_score
    ], dtype=np.float32)

# ── Model Manager ─────────────────────────────────────────────────────────────
class ModelManager:
    def __init__(self):
        self.model: Optional[RandomForestClassifier] = None
        self.version  = 0
        self.auc      = 0.5
        self.samples  = 0
        self.lock     = threading.Lock()
        self._load_or_init()

    def _load_or_init(self):
        if os.path.exists(MODEL_PATH):
            try:
                data = joblib.load(MODEL_PATH)
                self.model   = data["model"]
                self.version = data.get("version", 0)
                self.auc     = data.get("auc", 0.5)
                self.samples = data.get("samples", 0)
                log.info(f"✅ Model loaded v{self.version} AUC={self.auc:.3f} samples={self.samples}")
            except Exception as e:
                log.warning(f"Model load failed: {e}. Initializing fresh.")
                self._init_fresh()
        else:
            log.info("No saved model. Initializing fresh RandomForest.")
            self._init_fresh()

    def _init_fresh(self):
        self.model = RandomForestClassifier(
            n_estimators=100, max_depth=6,
            min_samples_leaf=3, class_weight="balanced",
            random_state=42, n_jobs=-1
        )
        self.version = 0
        self.auc = 0.5

    def save(self):
        try:
            joblib.dump({
                "model":   self.model,
                "version": self.version,
                "auc":     self.auc,
                "samples": self.samples,
            }, MODEL_PATH)
            log.info(f"💾 Model saved v{self.version} AUC={self.auc:.3f}")
        except Exception as e:
            log.error(f"Model save failed: {e}")

    def predict_proba(self, features: np.ndarray) -> float:
        with self.lock:
            if self.model is None or self.samples < 20:
                return -1.0  # not ready → use rule-based fallback
            try:
                prob = self.model.predict_proba(features.reshape(1, -1))[0][1]
                return float(prob)
            except Exception as e:
                log.warning(f"Predict failed: {e}")
                return -1.0

    def retrain(self):
        """Pull labeled data from DB and retrain."""
        if not DB_URL:
            log.warning("No DATABASE_URL — skipping retrain")
            return

        try:
            conn = psycopg2.connect(DB_URL)
            cur  = conn.cursor()

            # Pull labeled sessions: features + conversion outcome
            cur.execute("""
                SELECT
                    COALESCE(time_on_site, 0)::float,
                    COALESCE(scroll_depth_pct, 0)::float,
                    COALESCE(cta_hover_count, 0)::float,
                    COALESCE(hesitation_score, 0)::float,
                    COALESCE(intent_score, 0)::float / 100.0,
                    COALESCE(mouse_leave_count, 0)::float,
                    CASE WHEN device = 'mobile' THEN 1.0 ELSE 0.0 END,
                    COALESCE(return_visitor::int, 0)::float,
                    CASE cart_status
                        WHEN 'checkout' THEN 1.0
                        WHEN 'added'    THEN 0.6
                        WHEN 'viewed'   THEN 0.3
                        ELSE 0.0 END,
                    COALESCE(engagement_score, 0)::float,
                    COALESCE(scroll_depth_pct, 0)::float / GREATEST(time_on_site, 1),
                    CASE group_assignment WHEN 'control' THEN 0.0 ELSE 1.0 END,
                    converted::int
                FROM popup_sessions
                WHERE created_at > NOW() - INTERVAL '30 days'
                  AND intent_score IS NOT NULL
                LIMIT 5000
            """)
            rows = cur.fetchall()
            conn.close()
        except Exception as e:
            log.error(f"DB fetch failed: {e}")
            return

        if len(rows) < 30:
            log.info(f"Insufficient data for retrain: {len(rows)} rows (need 30+)")
            return

        data = np.array(rows, dtype=np.float32)
        X, y = data[:, :-1], data[:, -1]

        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

        model = RandomForestClassifier(
            n_estimators=150, max_depth=8,
            min_samples_leaf=3, class_weight="balanced",
            random_state=42, n_jobs=-1
        )
        model.fit(X_train, y_train)

        y_pred = model.predict_proba(X_val)[:, 1]
        auc    = roc_auc_score(y_val, y_pred) if len(np.unique(y_val)) > 1 else 0.5

        log.info(f"📊 Retrain: samples={len(X)} AUC={auc:.3f} (prev={self.auc:.3f})")

        # Only deploy if new model is better (or first time)
        if auc >= self.auc - 0.02 or self.samples < 30:
            with self.lock:
                self.model   = model
                self.version += 1
                self.auc     = auc
                self.samples = len(rows)
            self.save()
            log.info(f"✅ New model deployed v{self.version}")
        else:
            log.warning(f"⚠ New model AUC={auc:.3f} worse than current={self.auc:.3f}. Keeping old.")

mm = ModelManager()

# ── Reinforcement Learning Core (Q-Learning) ─────────────────────────────────
class ReinforcementLearningCore:
    def __init__(self):
        self.actions = ["discount_5", "discount_10", "discount_15", "urgency", "free_shipping", "bundle_offer", "cross_sell_upsell", "none"]
        self.epsilon = 0.10  # 10% Exploration
        self.fallback_q = {a: 0.0 for a in self.actions}
    
    def get_state_hash(self, data: dict, context: dict) -> str:
        """Part 7: State Definition"""
        hes = float(data.get("hesitation_score", 0))
        eng = float(data.get("engagement_score", 0))
        device = str(context.get("device", data.get("device", "desktop"))).lower()
        
        hes_level = "H" if hes > 0.6 else "M" if hes > 0.3 else "L"
        eng_level = "H" if eng > 0.6 else "M" if eng > 0.3 else "L"
        dev_level = "mob" if "mobile" in device else "desk"
        
        return f"{hes_level}_{eng_level}_{dev_level}"
        
    def get_q_values(self, state_hash: str) -> dict:
        """Fetch Q-values from DB or return fallback"""
        if not DB_URL: return self.fallback_q.copy()
        
        try:
            conn = psycopg2.connect(DB_URL)
            cur = conn.cursor()
            cur.execute("SELECT action, q_value FROM rl_q_table WHERE state_hash = %s", (state_hash,))
            rows = cur.fetchall()
            conn.close()
            
            if rows:
                q_vals = {r[0]: float(r[1]) for r in rows}
                for a in self.actions:
                    if a not in q_vals: q_vals[a] = 0.0
                return q_vals
        except Exception as e:
            log.error(f"Failed to fetch Q-values: {e}")
            
        return self.fallback_q.copy()
        
    def dynamic_threshold(self, q_values: dict) -> float:
        """Part 11: Dynamic Threshold. Calculate threshold based on highest Q-value"""
        max_q = max(q_values.values())
        if max_q > 5.0: return 0.6  # High expected reward -> stricter threshold to intervene
        if max_q < -5.0: return 0.3 # Low expected reward -> looser threshold
        return 0.45
        
    def choose_action(self, state_hash: str) -> str:
        """Part 6: Policy Engine (Epsilon-Greedy)"""
        import random
        if random.random() < self.epsilon:
            # Exploration
            action = random.choice(self.actions)
            log.info(f"🔍 RL Exploration: Chose {action} randomly")
            return action
            
        # Exploitation
        q_values = self.get_q_values(state_hash)
        best_action = max(q_values, key=q_values.get)
        log.info(f"🎯 RL Exploitation: Chose {best_action} with Q={q_values[best_action]:.2f}")
        return best_action

rl_core = ReinforcementLearningCore()

# ── Layer 1: Intent Detection Engine ──────────────────────────────────────────
def get_intent(prob: float, data: dict) -> tuple:
    if prob >= 0:
        base_score = prob * 100
    else:
        t = float(data.get("time_on_page", 0))
        sd = float(data.get("scroll_depth", 0))
        cl = float(data.get("clicks", 0))
        base_score = min(100, (t / 1.5) + (sd * 0.3) + (cl * 2))
        
    cart = data.get("cart_status", "unknown")
    if cart == "checkout": base_score += 20
    elif cart == "added": base_score += 10
    
    score = min(100, max(0, int(base_score)))
    level = "Hot" if score >= 70 else "Warm" if score >= 30 else "Cold"
    return score, level

# ── Layer 2: Friction & Objection Detection ──────────────────────────────────
def get_friction(data: dict) -> tuple:
    cart = data.get("cart_status", "unknown")
    exit_i = bool(data.get("exit_intent", False))
    hes = float(data.get("hesitation_score", 0))
    t = float(data.get("time_on_page", 0))
    
    severity = int(hes * 100)
    
    if exit_i and cart == "checkout":
        return "shipping_cost", max(severity, 80)
    if exit_i:
        return "price_sensitivity", max(severity, 70)
    if hes > 0.6 and t > 60 and cart == "unknown":
        return "comparison_behavior", severity
    if hes > 0.4 and cart == "added":
        return "indecision_loop", severity
        
    return "none", severity

# ── Layer 3: Predictive LTV Engine ───────────────────────────────────────────
def get_ltv(data: dict, context: dict) -> str:
    is_returning = bool(context.get("returning_user", data.get("returning_user", False)))
    past_sessions = int(context.get("total_sessions", 1))
    cart_val = float(context.get("cart_value", 0))
    if is_returning and (past_sessions > 5 or cart_val > 200): return "Premium"
    if is_returning or cart_val > 100: return "High"
    if data.get("cart_status") in ["added", "checkout"]: return "Medium"
    return "Low"

# ── Layer 4: Emotion State Engine ───────────────────────────────────────────
def get_emotion(data: dict) -> tuple:
    t = float(data.get("time_on_page", 0))
    hes = float(data.get("hesitation_score", 0))
    exit_i = bool(data.get("exit_intent", False))
    cart = data.get("cart_status", "unknown")
    
    intensity = int(hes * 100)
    if exit_i and t < 10: return "Anxious", intensity
    if exit_i and cart == "checkout": return "Hesitant", intensity
    if t > 60 and hes < 0.3: return "Curious", intensity
    if t > 90 and hes > 0.6: return "Comparing", intensity
    if cart == "checkout" and t < 30: return "Confident", intensity
    return "Hesitant", intensity

# ── Layer 5: Decision Timing Engine ─────────────────────────────────────────
def get_timing(data: dict) -> str:
    t = float(data.get("time_on_page", 0))
    exit_i = bool(data.get("exit_intent", False))
    if exit_i: return "Late"
    if t < 15: return "Early"
    if 15 <= t <= 45: return "Optimal"
    return "Do Nothing"

# ── Layer 6: Offer Elasticity Engine ─────────────────────────────────────────
def get_elasticity(friction_type: str, ltv: str) -> str:
    if friction_type in ["price_sensitivity", "shipping_cost"] and ltv in ["Low", "Medium"]:
        return "High"
    if ltv in ["Premium", "High"]:
        return "Low"
    return "Medium"

# ── Layer 7: Customer Memory Engine ──────────────────────────────────────────
def get_memory(context: dict) -> str:
    sessions = int(context.get("total_sessions", 1))
    if sessions == 1: return "New"
    if sessions <= 3: return "Returning"
    return "High Familiarity"

# ── Layer 8: Loss Aversion Engine ────────────────────────────────────────────
def get_loss_trigger(intent: str, hes: float, exit_i: bool) -> str:
    if intent == "Hot" and hes > 0.6 and exit_i: return "Strong"
    if intent in ["Hot", "Warm"] and hes > 0.4: return "Soft"
    return "None"

# ── Layer 9: Profit Protection Engine ────────────────────────────────────────
def get_profit_risk(ltv: str, elasticity: str) -> str:
    if ltv == "Premium" and elasticity == "Low": return "High" # Giving discount here is high profit risk
    if ltv in ["Low", "Medium"] and elasticity == "High": return "Low" # Fine to discount
    return "Medium"

# ── Layer 10: Cross-Session Identity Engine ──────────────────────────────────
def get_identity_confidence(context: dict) -> float:
    return 95.0 if context.get("returning_user") else 40.0

# ── Layer 11: Adaptive Funnel Engine ─────────────────────────────────────────
def get_funnel_path(friction: str, intent: str) -> str:
    if intent == "Hot": return "direct checkout"
    if friction == "trust_issue": return "social proof first"
    if friction == "comparison_behavior": return "bundle first"
    return "product education"

# ── Layer 12: Competitive Simulation Engine ──────────────────────────────────
def get_competition_risk(data: dict) -> str:
    hes = float(data.get("hesitation_score", 0))
    t = float(data.get("time_on_page", 0))
    if hes > 0.7 and t > 60: return "High"
    if hes > 0.4: return "Medium"
    return "Low"

# ── Master Controller: Final Decision Engine ─────────────────────────────────
def make_decision(prob: float, data: dict, context: dict) -> dict:
    # Execute all 12 Layers sequentially
    intent_score, intent_level = get_intent(prob, data)
    friction_type, friction_severity = get_friction(data)
    ltv_score = get_ltv(data, context)
    emotion_state, emotion_intensity = get_emotion(data)
    timing_decision = get_timing(data)
    elasticity_level = get_elasticity(friction_type, ltv_score)
    memory_profile = get_memory(context)
    loss_trigger = get_loss_trigger(intent_level, float(data.get("hesitation_score", 0)), bool(data.get("exit_intent", False)))
    profit_risk = get_profit_risk(ltv_score, elasticity_level)
    identity_conf = get_identity_confidence(context)
    funnel_path = get_funnel_path(friction_type, intent_level)
    comp_risk = get_competition_risk(data)

    action = "Do Nothing"
    reasoning = "Baseline observation."
    
    # AI Core RL Suggestion
    state_hash = rl_core.get_state_hash(data, context)
    raw_action = rl_core.choose_action(state_hash)
    if raw_action == "none": raw_action = "Do Nothing"
    
    exit_i = bool(data.get("exit_intent", False))
    hes = float(data.get("hesitation_score", 0))
    
    # ── Strict Decision Logic Constraints ──
    if intent_level == "Hot" and hes > 0.6 and exit_i:
        action = raw_action if raw_action != "Do Nothing" else "urgency"
        reasoning = "Hot intent + High hes + Exit risk -> Act immediately."
    
    elif ltv_score in ["High", "Premium"] and elasticity_level == "Low":
        if raw_action.startswith("discount"):
            action = "Offer cross-sell" if data.get("cart_status") in ["added", "checkout"] else "Show urgency"
            reasoning = "High LTV + Low elasticity -> NO DISCOUNT. Pivot to value-add."
        else:
            action = raw_action
            reasoning = "Protected profit margin for High LTV."
            
    elif friction_type == "price_sensitivity" and profit_risk != "High":
        action = "Offer bundle"
        reasoning = "High friction (price) -> Consider bundle before flat discount."
        
    elif memory_profile == "Returning" and hes > 0.5:
        action = "Show urgency" if loss_trigger == "Strong" else "Offer discount"
        reasoning = "Returning user + previous hesitation -> Strong intervention."
        
    elif comp_risk == "High":
        action = "Show social proof" if friction_type == "comparison_behavior" else "Offer discount"
        reasoning = "High competition risk -> Act earlier."
        
    elif profit_risk == "Low":
        action = raw_action if raw_action != "Do Nothing" else "Offer discount"
        reasoning = "Low profit risk -> Allow incentive."
    else:
        action = "Do Nothing"
        reasoning = "No critical threshold met. Avoid discount."

    # Normalize actions to the 7 strict output format actions
    valid_actions = ["Do Nothing", "Show urgency", "Offer discount", "Offer bundle", "Offer cross-sell", "Show social proof", "Redirect funnel"]
    # map standard old RL actions
    if action == "discount_5": action = "Offer discount"
    elif action == "discount_10": action = "Offer discount"
    elif action == "discount_15": action = "Offer discount"
    elif action == "free_shipping": action = "Offer bundle"
    elif action == "cross_sell_upsell": action = "Offer cross-sell"
    elif action == "urgency": action = "Show urgency"
    elif action not in valid_actions: action = "Do Nothing"
    
    # Expected Revenue Impact
    base_aov = float(context.get("aov", 50.0))
    expected_rev = 0.0
    if action == "Offer discount": expected_rev = base_aov * 0.9 * (prob + 0.2)
    elif action in ["Offer cross-sell", "Offer bundle"]: expected_rev = base_aov * 1.2 * prob
    elif action == "Show urgency": expected_rev = base_aov * (prob + 0.05)
    elif action == "Show social proof": expected_rev = base_aov * (prob + 0.1)
    else: expected_rev = base_aov * prob

    # 13 Strict Output Fields
    return {
        "intent_score": intent_score,
        "friction_type": friction_type,
        "ltv_tier": ltv_score,
        "emotion_state": emotion_state,
        "timing_decision": timing_decision,
        "elasticity_level": elasticity_level,
        "memory_profile": memory_profile,
        "loss_trigger": loss_trigger,
        "profit_risk": profit_risk,
        "competition_risk": comp_risk,
        "final_action": action,
        "expected_revenue_impact": round(expected_rev, 2),
        "reasoning": reasoning
    }

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(title="NOLIX AI Brain v3 — Phase 2", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class EventData(BaseModel):
    time_on_page:     Optional[float] = 0
    scroll_depth:     Optional[float] = 0
    clicks:           Optional[int]   = 0
    hesitation_score: Optional[float] = 0
    engagement_score: Optional[float] = 0
    exit_intent:      Optional[bool]  = False
    cart_status:      Optional[str]   = "unknown"
    model_score:      Optional[float] = 0
    device:           Optional[str]   = ""
    returning_user:   Optional[bool]  = False

class DecisionRequest(BaseModel):
    session_id: str
    visitor_id: Optional[str]       = None
    store:      Optional[str]       = "unknown"
    event:      Optional[str]       = "heartbeat"
    type:       Optional[str]       = None
    data:       Optional[EventData] = None
    timestamp:  Optional[int]       = None
    context:    Optional[dict]      = Field(default_factory=dict)

# ── POST /decide ──────────────────────────────────────────────────────────────
@app.post("/decide")
def decide(req: DecisionRequest):
    data    = req.data.model_dump() if req.data else {}
    context = req.context or {}
    t       = float(data.get("time_on_page", 0))
    exit_i  = bool(data.get("exit_intent", False))

    # Gate: too early
    if t < 5 and not exit_i:
        return {
            "intent_score": 0,
            "friction_type": "none",
            "ltv_tier": "Low",
            "emotion_state": "Curious",
            "timing_decision": "Early",
            "elasticity_level": "Medium",
            "memory_profile": "New",
            "loss_trigger": "None",
            "profit_risk": "Low",
            "competition_risk": "Low",
            "final_action": "Do Nothing",
            "expected_revenue_impact": 0.0,
            "reasoning": "too_early"
        }

    # Feature extraction + ML inference
    feats = extract_features(data, context)
    prob  = mm.predict_proba(feats)

    # Decision
    decision = make_decision(prob, data, context)
    decision["brain"]      = "python_v3"
    decision["prob"]       = round(prob, 3) if prob >= 0 else None
    decision["model_v"]    = mm.version
    decision["model_auc"]  = round(mm.auc, 3)

    log.info(f"[DECIDE] session={req.session_id[:8]} prob={prob:.3f} action={decision['action']}")
    return decision

# ── POST /feedback — causal learning feedback ─────────────────────────────────
@app.post("/feedback")
def feedback(body: dict):
    """
    Called when a session closes (conversion or exit).
    Updates causal stats and bandit rewards.
    """
    action    = body.get("action", "control")
    converted = bool(body.get("converted", False))
    reward    = 1.0 if converted else 0.0

    if action in causal_stats:
        causal_stats[action]["total"]     += 1
        causal_stats[action]["converted"] += int(converted)
    bandit.update(action, reward)

    uplift = get_uplift(action) if action != "control" else 0.0
    log.info(f"[FEEDBACK] action={action} converted={converted} uplift={uplift:.3f}")
    return {"ok": True, "uplift": round(uplift, 4)}

# ── GET /causal — uplift stats ────────────────────────────────────────────────
@app.get("/causal")
def causal():
    stats = {}
    ctrl = causal_stats["control"]
    ctrl_cvr = ctrl["converted"] / max(ctrl["total"], 1)
    for action, s in causal_stats.items():
        cvr    = s["converted"] / max(s["total"], 1)
        uplift = cvr - ctrl_cvr if action != "control" else 0.0
        stats[action] = {
            "total": s["total"], "converted": s["converted"],
            "cvr": round(cvr, 4), "uplift": round(uplift, 4),
            "profitable": is_action_profitable(action)
        }
    return {"stats": stats, "model_version": mm.version, "model_auc": mm.auc}

# ── GET /model — model info ───────────────────────────────────────────────────
@app.get("/model")
def model_info():
    feat_imp = {}
    if mm.model and hasattr(mm.model, "feature_importances_"):
        feat_imp = dict(zip(FEATURE_NAMES, [round(float(x), 4) for x in mm.model.feature_importances_]))
    return {
        "version":           mm.version,
        "auc":               mm.auc,
        "samples":           mm.samples,
        "ready":             mm.samples >= 20,
        "feature_importance": feat_imp,
    }

# ── GET /health ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "alive", "version": "3.0.0", "model_ready": mm.samples >= 20,
            "model_auc": mm.auc, "timestamp": datetime.utcnow().isoformat() + "Z"}

@app.get("/")
def root():
    return {"service": "NOLIX AI Brain", "version": "3.0.0",
            "endpoints": ["/decide", "/feedback", "/causal", "/model", "/health"]}

# ── Continuous Learning Scheduler ────────────────────────────────────────────
def start_scheduler():
    schedule.every(10).minutes.do(mm.retrain)
    log.info("⏰ Continuous learning: retrain every 10 minutes")
    def run():
        while True:
            schedule.run_pending()
            time.sleep(30)
    t = threading.Thread(target=run, daemon=True)
    t.start()

@app.on_event("startup")
def on_startup():
    log.info("🧠 NOLIX AI Brain v3 starting...")
    start_scheduler()
    # Initial retrain on startup (non-blocking)
    threading.Thread(target=mm.retrain, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_brain:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
