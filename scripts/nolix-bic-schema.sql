-- BUSINESS INTELLIGENCE CORE (BIC) SCHEMA UPDATES

-- 1. True Incrementality Tracking (Holdout vs ML)
-- Adding holdout group to the decisions log is not enough because holdout users might never have an AI event.
-- However, we log them during `prediction_decision` or `track` endpoint.
ALTER TABLE rl_decisions ADD COLUMN IF NOT EXISTS is_holdout BOOLEAN DEFAULT false;

-- 2. Learned Multi-Touch Attribution (Markov/Shapley Weights)
CREATE TABLE IF NOT EXISTS bic_learned_weights (
    id SERIAL PRIMARY KEY,
    store_domain VARCHAR(255) NOT NULL,
    model_type VARCHAR(50) DEFAULT 'markov_chain',
    touch_first_weight NUMERIC(5, 4) DEFAULT 0.2000,
    touch_middle_weight NUMERIC(5, 4) DEFAULT 0.3000,
    touch_last_weight NUMERIC(5, 4) DEFAULT 0.5000,
    confidence_score NUMERIC(5, 4) DEFAULT 1.0000,
    training_samples INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Context Signal Engine (Ad spikes, seasonal)
CREATE TABLE IF NOT EXISTS bic_context_signals (
    id SERIAL PRIMARY KEY,
    store_domain VARCHAR(255) NOT NULL,
    signal_type VARCHAR(100), -- 'ad_spike', 'influencer', 'seasonal'
    intensity_score NUMERIC(5, 4), -- 0.0 to 1.0
    detected_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- 4. Executive Dashboard Analytics
CREATE TABLE IF NOT EXISTS bic_global_metrics (
    id SERIAL PRIMARY KEY,
    store_domain VARCHAR(255) NOT NULL,
    incremental_revenue NUMERIC(12, 2) DEFAULT 0.00,
    profit_impact NUMERIC(12, 2) DEFAULT 0.00,
    conversion_lift_percent NUMERIC(8, 4) DEFAULT 0.0000,
    revenue_confidence_percent NUMERIC(5, 4) DEFAULT 1.0000,
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Baseline Learning Model Parameters (Logistic Regression)
CREATE TABLE IF NOT EXISTS bic_baseline_model (
    id SERIAL PRIMARY KEY,
    store_domain VARCHAR(255) NOT NULL,
    feature_weights JSONB NOT NULL,
    intercept NUMERIC(10, 6) NOT NULL,
    accuracy NUMERIC(5, 4) DEFAULT 0.0000,
    trained_at TIMESTAMP DEFAULT NOW()
);
