import xgboost as xgb
from sklearn.model_selection import train_test_split
from data_loader import DataLoader
from feature_engineering import FeatureEngineer
from config import get_db_connection
import json

class BaselineModelTrainer:
    def __init__(self):
        self.loader = DataLoader()
        self.engineer = FeatureEngineer()
        self.conn = get_db_connection()

    def train_and_deploy(self):
        print("Fetching data for Baseline Model...")
        df_raw = self.loader.fetch_training_data()
        df = self.engineer.extract_features(df_raw)

        # Baseline model ONLY trains on Control and Holdout groups
        df_baseline = df[df['is_treatment'] == 0]

        if len(df_baseline) < 100:
            print("Not enough control/holdout data to train Baseline XGBoost. Skipping...")
            return

        X = df_baseline[['time_on_site', 'pages_viewed', 'scroll_depth', 'device_type', 'intent_score']]
        y = df_baseline['converted']

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        print("Training XGBoost Baseline Model...")
        model = xgb.XGBClassifier(n_estimators=100, learning_rate=0.1, max_depth=4, objective='binary:logistic')
        model.fit(X_train, y_train)

        accuracy = model.score(X_test, y_test)
        print(f"Baseline Model Accuracy: {accuracy:.4f}")

        # Extract feature importance (weights approximation) to sync to DB
        importance = model.feature_importances_
        feature_weights = {
            "duration": float(importance[0]),
            "pages": float(importance[1]),
            "scroll": float(importance[2]),
            "device": float(importance[3]),
            "intent": float(importance[4])
        }

        # Deploy weights to database
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO bic_baseline_model (store_domain, feature_weights, intercept, accuracy)
            VALUES (%s, %s, %s, %s)
        """, ('nolix', json.dumps(feature_weights), -3.0, float(accuracy))) # using -3.0 as proxy base intercept
        self.conn.commit()
        print("Baseline Model deployed to Database successfully.")

if __name__ == "__main__":
    trainer = BaselineModelTrainer()
    trainer.train_and_deploy()
