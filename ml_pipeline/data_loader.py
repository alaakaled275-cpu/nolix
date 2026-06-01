import pandas as pd
from config import get_db_connection

class DataLoader:
    def __init__(self):
        self.conn = get_db_connection()

    def fetch_training_data(self):
        """
        Fetch all sessions, decisions, and outcomes.
        Mandatory Step 1: Data Collection (session logs, decisions, outcomes, holdout vs treated)
        """
        query = """
            SELECT 
                d.session_id,
                d.visitor_id,
                d.ab_group,
                d.is_holdout,
                d.action,
                d.state_vector,
                d.expected_baseline_revenue,
                a.id IS NOT NULL as converted,
                COALESCE(a.net_profit_impact, 0.0) as actual_revenue,
                d.created_at
            FROM rl_decisions d
            LEFT JOIN nolix_attributions a ON d.decision_id = a.decision_id
            WHERE d.created_at > NOW() - INTERVAL '90 days'
        """
        df = pd.read_sql(query, self.conn)
        return df

    def fetch_multi_touch_journeys(self):
        """
        Fetch sequenced actions for sequence modeling (LSTM/Transformer).
        """
        query = """
            SELECT 
                d.visitor_id,
                d.action,
                d.ab_group,
                d.created_at,
                a.id IS NOT NULL as is_conversion
            FROM rl_decisions d
            LEFT JOIN nolix_attributions a ON d.decision_id = a.decision_id
            ORDER BY d.visitor_id, d.created_at ASC
        """
        df = pd.read_sql(query, self.conn)
        return df

if __name__ == "__main__":
    loader = DataLoader()
    print("DataLoader operational.")
