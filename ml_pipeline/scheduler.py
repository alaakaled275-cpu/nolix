import schedule
import time
from train_baseline_model import BaselineModelTrainer
from train_uplift_model import UpliftModelTrainer
from datetime import datetime

from config import get_db_connection

def has_sufficient_new_data(threshold=1000):
    conn = get_db_connection()
    cur = conn.cursor()
    # Check if there are more than 1000 new decisions since last training
    cur.execute("""
        SELECT COUNT(*) as new_decisions 
        FROM rl_decisions 
        WHERE created_at > (SELECT COALESCE(MAX(trained_at), '1970-01-01') FROM bic_baseline_model)
    """)
    res = cur.fetchone()
    conn.close()
    return res['new_decisions'] > threshold

def run_ml_pipeline():
    print(f"\n[{datetime.now()}] 🚀 Checking Dynamic Retraining Condition...")
    
    if not has_sufficient_new_data(threshold=1000):
        print(f"[{datetime.now()}] ⏭️ Insufficient new data to warrant retraining. Skipping...")
        return
        
    print(f"[{datetime.now()}] 📊 Threshold met. Initiating ML Pipeline Training...")
    
    # 1. Train and Deploy Baseline (Layer 17)
    baseline_trainer = BaselineModelTrainer()
    baseline_trainer.train_and_deploy()
    
    # 2. Train Uplift Models (Layer 25)
    uplift_trainer = UpliftModelTrainer()
    uplift_trainer.train_uplift()
    
    print(f"[{datetime.now()}] ✅ ML Pipeline execution completed successfully.\n")

if __name__ == "__main__":
    print("Layer 36: Dynamic Retraining Logic activated.")
    # Run once immediately on startup
    run_ml_pipeline()
    
    # Schedule every 24 hours at midnight
    schedule.every().day.at("00:00").do(run_ml_pipeline)
    
    while True:
        schedule.run_pending()
        time.sleep(60)
