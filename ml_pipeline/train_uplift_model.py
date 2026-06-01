import xgboost as xgb
from sklearn.model_selection import train_test_split
from data_loader import DataLoader
from feature_engineering import FeatureEngineer
from config import get_db_connection

class UpliftModelTrainer:
    def __init__(self):
        self.loader = DataLoader()
        self.engineer = FeatureEngineer()

    def train_uplift(self):
        """
        Step 4: Train Uplift Model (Impact = conv_with_AI - conv_without_AI)
        Using a T-Learner approach (Two models).
        """
        print("Fetching data for Uplift Modeling...")
        df_raw = self.loader.fetch_training_data()
        df = self.engineer.extract_features(df_raw)

        if len(df) < 200:
            print("Not enough data to train Uplift models. Skipping...")
            return

        features = ['time_on_site', 'pages_viewed', 'scroll_depth', 'device_type', 'intent_score']
        
        # Model 0: Control & Holdout
        df_control = df[df['is_treatment'] == 0]
        # Model 1: Treatment
        df_treatment = df[df['is_treatment'] == 1]

        if len(df_control) < 50 or len(df_treatment) < 50:
            print("Insufficient split sizes.")
            return

        print("Training Control Learner...")
        model_0 = xgb.XGBClassifier(n_estimators=100, max_depth=3)
        model_0.fit(df_control[features], df_control['converted'])

        print("Training Treatment Learner...")
        model_1 = xgb.XGBClassifier(n_estimators=100, max_depth=3)
        model_1.fit(df_treatment[features], df_treatment['converted'])

        # Calculate average uplift on a test set (or entire population)
        p_treatment = model_1.predict_proba(df[features])[:, 1]
        p_control = model_0.predict_proba(df[features])[:, 1]
        
        uplift = p_treatment - p_control
        df['predicted_uplift'] = uplift
        
        # Layer 34: Uplift Validation
        from validator import UpliftValidator
        val = UpliftValidator()
        if not val.validate_model(uplift):
            print("Aborting model deployment due to AUUC failure.")
            return

        avg_uplift = df['predicted_uplift'].mean()
        print(f"Global Average Uplift predicted by ML: {avg_uplift * 100:.2f}%")
        
        # Segment-Level Causal Analysis (Layer 27)
        high_intent = df[df['intent_score'] > 50]['predicted_uplift'].mean()
        mobile_users = df[df['device_type'] == 1]['predicted_uplift'].mean()
        
        print(f"Segment Uplift - High Intent: {high_intent * 100:.2f}%")
        print(f"Segment Uplift - Mobile Users: {mobile_users * 100:.2f}%")
        
        # In a full production system, model_1 and model_0 would be exported (e.g. ONNX/Pickle)
        # and loaded in Node via an inference server to decide dynamically if uplift > 0 before acting.
        print("Uplift modeling complete. Models ready for export.")

if __name__ == "__main__":
    trainer = UpliftModelTrainer()
    trainer.train_uplift()
