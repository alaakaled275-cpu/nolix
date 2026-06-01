import pandas as pd
import json

class FeatureEngineer:
    def __init__(self):
        pass

    def extract_features(self, df):
        """
        Mandatory Step 2: Feature Engineering
        Converts session logs into specific ML features.
        """
        # Parse the JSON state_vector
        def parse_vector(v):
            try:
                if isinstance(v, str):
                    return json.loads(v)
                return v
            except:
                return {}

        df['parsed_state'] = df['state_vector'].apply(parse_vector)
        
        # Extract required features exactly as requested
        # Note: In production, time_on_site, product_views etc. should be aggregated from raw events.
        # Here we extract them from the state_vector we logged or default to proxy values if missing.
        df['time_on_site'] = df['parsed_state'].apply(lambda x: x.get('sessionDurationMs', 0) / 1000)
        df['pages_viewed'] = df['parsed_state'].apply(lambda x: x.get('pagesViewed', 1))
        df['scroll_depth'] = df['parsed_state'].apply(lambda x: x.get('scrollDepth', 10))
        df['device_type'] = df['parsed_state'].apply(lambda x: 1 if x.get('device', 'desktop') == 'mob' else 0)
        df['intent_score'] = df['parsed_state'].apply(lambda x: x.get('intent_score', 0))
        
        # Encode categorical variables
        df['is_treatment'] = df['ab_group'].apply(lambda x: 1 if x == 'ml' else 0)
        df['is_holdout'] = df['ab_group'].apply(lambda x: 1 if x == 'holdout' else 0)
        
        # Ensure target variables exist
        df['converted'] = df['converted'].astype(int)
        
        # Drop raw JSON columns to prepare for XGBoost
        features_df = df[['session_id', 'visitor_id', 'time_on_site', 'pages_viewed', 'scroll_depth', 
                          'device_type', 'intent_score', 'is_treatment', 'is_holdout', 'converted', 'actual_revenue']]
        
        # Fill NaNs
        features_df = features_df.fillna(0)
        
        return features_df

if __name__ == "__main__":
    print("FeatureEngineer operational.")
