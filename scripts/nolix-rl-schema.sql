-- nolix-rl-schema.sql
-- Phase 1: Reinforcement Learning Base Tables

CREATE TABLE IF NOT EXISTS rl_decisions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  state_vector JSONB NOT NULL,
  action TEXT NOT NULL,
  value FLOAT,
  confidence FLOAT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rl_decisions_session ON rl_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_rl_decisions_processed ON rl_decisions(processed);

CREATE TABLE IF NOT EXISTS rl_outcomes (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  converted BOOLEAN NOT NULL DEFAULT false,
  revenue FLOAT DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rl_outcomes_session ON rl_outcomes(session_id);

CREATE TABLE IF NOT EXISTS rl_q_table (
  state_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  q_value FLOAT NOT NULL DEFAULT 0.0,
  visits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (state_hash, action)
);

CREATE TABLE IF NOT EXISTS ai_metrics (
  id SERIAL PRIMARY KEY,
  accuracy FLOAT NOT NULL DEFAULT 0.0,
  revenue_gain FLOAT NOT NULL DEFAULT 0.0,
  discount_waste FLOAT NOT NULL DEFAULT 0.0,
  rolling_conversions INT NOT NULL DEFAULT 0,
  rolling_discounts INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial baseline for AI metrics if empty
INSERT INTO ai_metrics (accuracy, revenue_gain, discount_waste)
SELECT 0.0, 0.0, 0.0
WHERE NOT EXISTS (SELECT 1 FROM ai_metrics LIMIT 1);
