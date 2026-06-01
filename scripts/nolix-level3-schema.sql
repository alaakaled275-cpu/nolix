-- LEVEL 3: Causal Revenue Intelligence System Schema Updates

-- 1. Counterfactual Baseline
ALTER TABLE rl_decisions ADD COLUMN IF NOT EXISTS expected_baseline_revenue NUMERIC(10, 2) DEFAULT 0.0;

-- 2. Advanced Multi-Touch & Context-Aware Attribution
ALTER TABLE nolix_attributions ADD COLUMN IF NOT EXISTS impact_type VARCHAR(50) DEFAULT 'Direct';
ALTER TABLE nolix_attributions ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 4) DEFAULT 1.0000;
ALTER TABLE nolix_attributions ADD COLUMN IF NOT EXISTS attribution_weight NUMERIC(5, 4) DEFAULT 1.0000;
ALTER TABLE nolix_attributions ADD COLUMN IF NOT EXISTS context_penalty NUMERIC(5, 4) DEFAULT 0.0000;

-- 3. Dynamic Weights Tracking (Optional: store the learned Markov/Shapley weights)
CREATE TABLE IF NOT EXISTS nolix_attribution_weights (
    id SERIAL PRIMARY KEY,
    store_domain VARCHAR(255) NOT NULL,
    first_touch_weight NUMERIC(5, 4) DEFAULT 0.2000,
    middle_touch_weight NUMERIC(5, 4) DEFAULT 0.3000,
    last_touch_weight NUMERIC(5, 4) DEFAULT 0.5000,
    updated_at TIMESTAMP DEFAULT NOW()
);
