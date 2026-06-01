"""
rl_worker.py — Continuous Reinforcement Learning Worker
Executes Parts 3, 4, 5, 8, 9, 10, 12, 13 of the True Self-Learning AI System.
"""

import os, time, json, logging
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [RL WORKER] %(message)s")
log = logging.getLogger("rl_worker")

DB_URL = os.getenv("DATABASE_URL", "postgres://support:nolix_admin_123@127.0.0.1:5432/support")
ALPHA = 0.1  # Learning rate

def get_db():
    return psycopg2.connect(DB_URL)

def evaluate(decision, outcome):
    """Part 3 - Self Evaluation"""
    action = decision["action"]
    converted = outcome["converted"]
    
    if action.startswith("discount") and converted:
        return 1
    if action.startswith("discount") and not converted:
        return -1
    if action == "none" and converted:
        return 1
    return 0

def compute_reward(decision, outcome):
    """Part 4 - Reward System"""
    action = decision["action"]
    revenue = outcome["revenue"] or 0.0
    
    # Calculate discount cost roughly
    discount_cost = 0.0
    if action == "discount_5": discount_cost = revenue * 0.05
    elif action == "discount_10": discount_cost = revenue * 0.10
    elif action == "discount_15": discount_cost = revenue * 0.15
        
    reward = revenue - discount_cost
    
    # Part 9 - Error Correction (penalize waste)
    if action.startswith("discount") and not outcome["converted"]:
        reward -= 10.0  # Fixed penalty for wasting a discount
        
    return reward

def update_Q(conn, state_hash, action, reward):
    """Part 5 - Reinforcement Learning Core (Q-Table Update)"""
    cur = conn.cursor()
    # Fetch current Q-value
    cur.execute("SELECT q_value, visits FROM rl_q_table WHERE state_hash = %s AND action = %s", (state_hash, action))
    row = cur.fetchone()
    
    if row:
        current_q, visits = row
        # Q[s][a] = Q[s][a] + alpha * (reward - Q[s][a])
        new_q = current_q + ALPHA * (reward - current_q)
        cur.execute("""
            UPDATE rl_q_table 
            SET q_value = %s, visits = visits + 1, updated_at = NOW() 
            WHERE state_hash = %s AND action = %s
        """, (new_q, state_hash, action))
    else:
        new_q = reward
        cur.execute("""
            INSERT INTO rl_q_table (state_hash, action, q_value, visits) 
            VALUES (%s, %s, %s, 1)
        """, (state_hash, action, new_q))
        
    conn.commit()
    cur.close()

def run_worker_loop():
    """Part 8 - Continuous Learning Loop"""
    log.info("🚀 RL Worker Started. Monitoring for unprocessed decisions/outcomes.")
    
    while True:
        try:
            conn = get_db()
            cur = conn.cursor()
            
            # Fetch unprocessed decisions for ML group that have an attribution outcome OR are older than 1 hour
            cur.execute("""
                SELECT d.id, d.session_id, d.state_vector, d.action, 
                       a.id IS NOT NULL as converted, COALESCE(a.net_profit_impact, 0.0) as revenue 
                FROM rl_decisions d
                LEFT JOIN nolix_attributions a ON d.decision_id = a.decision_id AND a.is_valid = true
                WHERE d.processed = false AND d.ab_group = 'ml'
                  AND (a.id IS NOT NULL OR d.created_at < NOW() - INTERVAL '1 hour')
                LIMIT 100
            """)
            rows = cur.fetchall()
            
            if not rows:
                time.sleep(5)
                continue
                
            discounts_given = 0
            conversions_from_discount = 0
            total_revenue_gain = 0.0
            total_discount_waste = 0.0
            correct_decisions = 0
            total_decisions = 0

            for row in rows:
                d_id, session_id, state_vector, action, converted, revenue = row
                
                decision = {"action": action}
                outcome = {
                    "converted": bool(converted),
                    "revenue": float(revenue) if revenue else 0.0
                }
                
                # Part 7 (State Hash) - reconstruct hash to update Q-table
                state_hash = f"{state_vector.get('hes_level','L')}_{state_vector.get('eng_level','L')}_{state_vector.get('device','desktop')}"
                
                reward = compute_reward(decision, outcome)
                update_Q(conn, state_hash, action, reward)
                
                # Metrics tracking
                eval_score = evaluate(decision, outcome)
                total_decisions += 1
                if eval_score == 1: correct_decisions += 1
                
                if action.startswith("discount"):
                    discounts_given += 1
                    if outcome["converted"]:
                        conversions_from_discount += 1
                        total_revenue_gain += outcome["revenue"]
                    else:
                        total_discount_waste += 10.0 # Fixed waste metric
                elif outcome["converted"]:
                    total_revenue_gain += outcome["revenue"]
                
                # Mark processed
                cur.execute("UPDATE rl_decisions SET processed = true WHERE id = %s", (d_id,))
            
            # Part 10 & 13 - Waste Detector & Performance Metrics
            cur.execute("SELECT * FROM ai_metrics ORDER BY id DESC LIMIT 1")
            metrics = cur.fetchone()
            if metrics:
                m_id, old_acc, old_rev, old_waste, rolling_conv, rolling_disc, _ = metrics
                
                new_rolling_conv = rolling_conv + conversions_from_discount
                new_rolling_disc = rolling_disc + discounts_given
                
                # Part 10: Waste Detector (if discounts given heavily outpace conversions)
                if new_rolling_disc > 100 and (new_rolling_disc > new_rolling_conv * 3):
                    log.warning("🚨 WASTE DETECTOR TRIGGERED: Discounts drastically exceed conversions. Triggering global penalty.")
                    # Penalize all discount Q-values
                    cur.execute("UPDATE rl_q_table SET q_value = q_value - 5.0 WHERE action LIKE 'discount%'")
                    # Reset rolling counters
                    new_rolling_conv = 0
                    new_rolling_disc = 0
                
                new_acc = (old_acc * 0.9) + ((correct_decisions / total_decisions) * 0.1) if total_decisions > 0 else old_acc
                new_rev = old_rev + total_revenue_gain
                new_waste = old_waste + total_discount_waste
                
                cur.execute("""
                    UPDATE ai_metrics 
                    SET accuracy = %s, revenue_gain = %s, discount_waste = %s,
                        rolling_conversions = %s, rolling_discounts = %s, updated_at = NOW()
                    WHERE id = %s
                """, (new_acc, new_rev, new_waste, new_rolling_conv, new_rolling_disc, m_id))
            
            conn.commit()
            log.info(f"✅ Processed {len(rows)} RL events. Rewards distributed.")
            
        except Exception as e:
            log.error(f"Worker Error: {e}")
            time.sleep(5)
        finally:
            if 'conn' in locals() and conn:
                conn.close()
        
        time.sleep(2) # Prevent aggressive looping

if __name__ == "__main__":
    run_worker_loop()
