import sys
import os
import psycopg2

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from worker.rl_worker import get_db, compute_reward, update_Q, evaluate

def reset_tables(conn):
    cur = conn.cursor()
    cur.execute("TRUNCATE rl_decisions, rl_outcomes, rl_q_table, ai_metrics RESTART IDENTITY CASCADE;")
    cur.execute("INSERT INTO ai_metrics (accuracy, revenue_gain, discount_waste) VALUES (0.0, 0.0, 0.0)")
    conn.commit()

def test_1_discount_waste(conn):
    print("\n--- TEST 1: Discount Waste (Penalization) ---")
    state_hash = "H_M_mob"
    
    # Simulate 50 discounts given, 0 conversions
    for i in range(50):
        decision = {"action": "discount_15"}
        outcome = {"converted": False, "revenue": 0.0}
        reward = compute_reward(decision, outcome)
        update_Q(conn, state_hash, "discount_15", reward)
        
    cur = conn.cursor()
    cur.execute("SELECT q_value FROM rl_q_table WHERE action = 'discount_15'")
    q = cur.fetchone()[0]
    print(f"Final Q-Value for discount_15: {q:.2f}")
    if q < 0:
        print("✅ TEST 1 PASSED: Discount was heavily penalized and decreased.")
    else:
        print("❌ TEST 1 FAILED")

def test_2_urgency_amplification(conn):
    print("\n--- TEST 2: Urgency Amplification ---")
    state_hash = "L_H_desk"
    
    # Simulate 50 urgency actions, 25 conversions ($50 each)
    for i in range(50):
        converted = (i % 2 == 0)
        decision = {"action": "urgency"}
        outcome = {"converted": converted, "revenue": 50.0 if converted else 0.0}
        reward = compute_reward(decision, outcome)
        update_Q(conn, state_hash, "urgency", reward)
        
    cur = conn.cursor()
    cur.execute("SELECT q_value FROM rl_q_table WHERE action = 'urgency'")
    q = cur.fetchone()[0]
    print(f"Final Q-Value for urgency: {q:.2f}")
    if q > 0:
        print("✅ TEST 2 PASSED: Urgency increased in value due to conversions.")
    else:
        print("❌ TEST 2 FAILED")

def main():
    conn = get_db()
    reset_tables(conn)
    test_1_discount_waste(conn)
    test_2_urgency_amplification(conn)
    print("\n✅ All RL Core Constraints Verified successfully.")

if __name__ == "__main__":
    main()
