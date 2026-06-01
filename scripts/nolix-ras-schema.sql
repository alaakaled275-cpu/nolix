-- Phase 1: ZenoAI RAS Schema Updates

-- Add decision_id and ab_group to rl_decisions to track exact actions
ALTER TABLE rl_decisions 
ADD COLUMN IF NOT EXISTS decision_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS ab_group TEXT DEFAULT 'ml';

-- Ensure we can lookup quickly by decision_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_rl_decisions_decision_id ON rl_decisions (decision_id);

-- Create nolix_attributions table to map conversions to specific decisions
CREATE TABLE IF NOT EXISTS nolix_attributions (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    visitor_id TEXT NOT NULL,
    decision_id UUID NOT NULL REFERENCES rl_decisions(decision_id),
    attribution_type TEXT NOT NULL, -- 'Primary' or 'Secondary'
    is_valid BOOLEAN NOT NULL DEFAULT true, -- For Causal Validation Logic
    validation_reason TEXT,
    order_value NUMERIC NOT NULL,
    discount_cost NUMERIC NOT NULL DEFAULT 0.0,
    net_profit_impact NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
