-- Phase 1: 12-Layer Architecture Schema Updates

ALTER TABLE rl_decisions 
ADD COLUMN IF NOT EXISTS emotion_state TEXT,
ADD COLUMN IF NOT EXISTS emotion_intensity FLOAT,
ADD COLUMN IF NOT EXISTS timing_decision TEXT,
ADD COLUMN IF NOT EXISTS elasticity_level TEXT,
ADD COLUMN IF NOT EXISTS memory_profile TEXT,
ADD COLUMN IF NOT EXISTS loss_trigger TEXT,
ADD COLUMN IF NOT EXISTS profit_risk TEXT,
ADD COLUMN IF NOT EXISTS competition_risk TEXT,
ADD COLUMN IF NOT EXISTS funnel_path TEXT,
ADD COLUMN IF NOT EXISTS identity_confidence FLOAT;
