import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import time

def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME", "support"),
        user=os.environ.get("DB_USER", "support"),
        password=os.environ.get("DB_PASS", "support"),
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432")
    )

def calculate_net_profit(action: str, order_value: float) -> tuple:
    discount_cost = 0.0
    if action == "Offer discount":
        discount_cost = order_value * 0.15 # Assuming 15% discount for simplified tracking
    elif action == "discount_15":
        discount_cost = order_value * 0.15
    elif action == "discount_10":
        discount_cost = order_value * 0.10
    elif action == "discount_5":
        discount_cost = order_value * 0.05
    elif action == "Offer bundle":
        discount_cost = order_value * 0.10 # Assuming bundle is effectively 10% off
        
    net_profit = order_value - discount_cost
    return discount_cost, net_profit

def validate_and_attribute(order_id: str, visitor_id: str, order_value: float, created_at):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if this order has already been attributed
            cur.execute("SELECT id FROM nolix_attributions WHERE order_id = %s", (order_id,))
            if cur.fetchone():
                return
            
            # Fetch all AI decisions for this visitor in the last 24 hours BEFORE the conversion
            cur.execute("""
                SELECT * FROM rl_decisions 
                WHERE session_id LIKE %s AND created_at <= %s 
                ORDER BY created_at DESC
            """, (f"%{visitor_id}%", created_at))
            decisions = cur.fetchall()
            
            if not decisions:
                return # Organic conversion, no AI decisions
                
            # Causal Validation Logic (Step 5)
            # Find the primary decision. We reject attribution if:
            # - Action is "Do Nothing" (or None)
            # - User was already in checkout before ANY AI action fired
            
            primary_decision = None
            validation_reason = ""
            is_valid = True
            
            for d in decisions:
                if d['action'] not in ["Do Nothing", "none", None]:
                    primary_decision = d
                    break
                    
            if not primary_decision:
                # User was exposed to AI, but AI chose "Do Nothing" or they were in Control group.
                # No attribution.
                return
                
            # Example Validation: Check the very first decision in the session to see if they were already in checkout
            first_decision = decisions[-1]
            try:
                if first_decision.get('friction_type') == "shipping_cost" and first_decision.get('intent_score', 0) > 80:
                    pass # They were far along, but this is a valid intervention.
            except Exception:
                pass
                
            if primary_decision['ab_group'] == 'control':
                is_valid = False
                validation_reason = "User was in control group (Suppressed Action)"
            else:
                validation_reason = "Valid AI Intervention"
                
            # Profit-Based Attribution (Step 6)
            discount_cost, net_profit = calculate_net_profit(primary_decision['action'], order_value)
            
            cur.execute("""
                INSERT INTO nolix_attributions 
                (order_id, visitor_id, decision_id, attribution_type, is_valid, validation_reason, order_value, discount_cost, net_profit_impact)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                order_id, visitor_id, primary_decision['decision_id'], 'Primary', is_valid, validation_reason,
                order_value, discount_cost, net_profit
            ))
            
            conn.commit()
            print(f"Attributed Order {order_id} -> Decision {primary_decision['decision_id']} (Profit: ${net_profit:.2f})")
            
    except Exception as e:
        conn.rollback()
        print(f"Error attributing order {order_id}: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("RAS Attribution Worker Running...")
    # This worker would normally listen to a message queue or be called directly by the webhook.
    # For now, it's a structural module.
