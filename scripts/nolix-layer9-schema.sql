-- Phase 1: 9-Layer Architecture Schema Updates

ALTER TABLE rl_decisions 
ADD COLUMN IF NOT EXISTS intent_score FLOAT,
ADD COLUMN IF NOT EXISTS intent_level TEXT,
ADD COLUMN IF NOT EXISTS friction_type TEXT,
ADD COLUMN IF NOT EXISTS friction_severity FLOAT,
ADD COLUMN IF NOT EXISTS ltv_score TEXT,
ADD COLUMN IF NOT EXISTS expected_revenue_impact FLOAT,
ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- Same for popup_sessions if tracking is unified
ALTER TABLE popup_sessions
ADD COLUMN IF NOT EXISTS ltv_score TEXT,
ADD COLUMN IF NOT EXISTS margin_impact FLOAT;
