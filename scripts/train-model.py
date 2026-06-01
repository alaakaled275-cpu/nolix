"""
scripts/train-model.py
Trains RandomForest on real popup_sessions data from Docker PostgreSQL.
Run: python scripts/train-model.py
"""
import os, sys
import numpy as np
import joblib
import psycopg2
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

DB = {
    "host": os.getenv("PGHOST_LOCAL", "127.0.0.1"),
    "port": int(os.getenv("PGPORT", "5432")),
    "database": os.getenv("PGDATABASE", "support"),
    "user": os.getenv("PGUSER", "support"),
    "password": os.getenv("PGPASSWORD", "nolix_admin_123"),
}

print("Connecting to DB...")
conn = psycopg2.connect(**DB)
cur  = conn.cursor()

cur.execute("""
    SELECT
        COALESCE(time_on_site,0)::float,
        COALESCE(scroll_depth_pct,0)::float,
        COALESCE(cta_hover_count,0)::float,
        COALESCE(hesitation_score,0)::float,
        COALESCE(engagement_score,0)::float,
        COALESCE(cta_hover_count,0)::float / GREATEST(time_on_site,1),
        CASE WHEN device='mobile' THEN 1.0 ELSE 0.0 END,
        COALESCE(return_visitor::int,0)::float,
        CASE cart_status
            WHEN 'checkout' THEN 1.0 WHEN 'added' THEN 0.6
            WHEN 'viewed' THEN 0.3 ELSE 0.0 END,
        COALESCE(engagement_score,0)::float,
        COALESCE(scroll_depth_pct,0)::float / GREATEST(time_on_site,1),
        CASE WHEN group_assignment='control' THEN 0.0 ELSE 1.0 END,
        converted::int
    FROM popup_sessions
    WHERE time_on_site IS NOT NULL
    LIMIT 5000
""")
rows = cur.fetchall()
conn.close()
print(f"Fetched {len(rows)} rows")

if len(rows) < 20:
    print("Not enough data (need 20+). Run seed-training-data.py first.")
    sys.exit(1)

data = np.array(rows, dtype=np.float32)
X, y  = data[:, :-1], data[:, -1]
print(f"Features: {X.shape} | Conversions: {int(y.sum())}/{len(y)}")

X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(
    n_estimators=150, max_depth=8,
    min_samples_leaf=3, class_weight="balanced",
    random_state=42, n_jobs=-1
)
model.fit(X_tr, y_tr)
print("Training done.")

if len(set(y_val)) > 1:
    auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    print(f"AUC: {auc:.3f}")
else:
    auc = 0.5
    print("AUC: N/A (only one class in val)")

joblib.dump({"model": model, "version": 1, "auc": auc, "samples": len(rows)}, "model.pkl")
print(f"model.pkl saved (v1, AUC={auc:.3f}, samples={len(rows)})")
print("DONE — AI Brain will load this on next restart.")
