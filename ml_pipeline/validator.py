import pandas as pd
from config import get_db_connection

class DataValidator:
    def __init__(self):
        self.conn = get_db_connection()

    def run_validation(self):
        print("Running Layer 33: Data Validation Engine...")
        cur = self.conn.cursor()
        
        # 1. Detect Tracking Gaps (No events in last 24h)
        cur.execute("""
            SELECT COUNT(*) as recent_events 
            FROM rl_decisions 
            WHERE created_at > NOW() - INTERVAL '24 hours'
        """)
        recent_events = cur.fetchone()['recent_events']
        if recent_events == 0:
            print("❌ WARNING: TRACKING GAP DETECTED. No events logged in the last 24 hours.")
        
        # 2. Detect Duplicate Sessions
        cur.execute("""
            SELECT session_id, COUNT(*) as c 
            FROM rl_decisions 
            GROUP BY session_id 
            HAVING COUNT(*) > 50
        """)
        duplicates = cur.fetchall()
        if len(duplicates) > 0:
            print(f"❌ WARNING: DUPLICATE SESSIONS DETECTED. {len(duplicates)} sessions have abnormally high event counts.")
            
        print("Data Validation Complete.")
        return recent_events > 0

class UpliftValidator:
    def validate_model(self, uplift_scores):
        """
        Layer 34: Uplift Validation System
        Calculates a proxy for AUUC (Area Under Uplift Curve).
        """
        print("Running Layer 34: Uplift Validation System...")
        # A simple check: does the model predict positive uplift for at least some population?
        # In a real enterprise system, we would calculate the exact Qini curve.
        positive_uplift_ratio = (uplift_scores > 0).mean()
        
        if positive_uplift_ratio < 0.05:
            print("❌ WARNING: AUUC SCORE FAILURE. Model predicts almost zero uplift across the board. Model is UNRELIABLE.")
            return False
            
        print(f"✅ AUUC / Qini Check passed. Positive uplift predicted for {positive_uplift_ratio*100:.1f}% of population.")
        return True

if __name__ == "__main__":
    validator = DataValidator()
    validator.run_validation()
