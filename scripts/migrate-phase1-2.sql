-- NOLIX Phase 1+2 Missing Tables Migration
-- Run: docker exec -i support-postgres psql -U support -d support < scripts/migrate-phase1-2.sql

-- ── Phase 1: Store Auth ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  domain     TEXT UNIQUE NOT NULL,
  public_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  secret_key TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  plan       TEXT NOT NULL DEFAULT 'trial',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS stores_public_key_idx ON stores(public_key);
CREATE INDEX IF NOT EXISTS stores_domain_idx     ON stores(domain);

-- ── Phase 2: Data Pipeline ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  visitor_id  TEXT,
  store_domain TEXT,
  event_type  TEXT NOT NULL DEFAULT 'heartbeat',
  features    JSONB NOT NULL DEFAULT '{}',
  context     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_events_session_idx ON user_events(session_id);
CREATE INDEX IF NOT EXISTS user_events_created_idx ON user_events(created_at DESC);

CREATE TABLE IF NOT EXISTS conversions (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL UNIQUE,
  visitor_id   TEXT,
  store_domain TEXT,
  converted    BOOLEAN NOT NULL DEFAULT FALSE,
  revenue      FLOAT   NOT NULL DEFAULT 0,
  action_taken TEXT,
  discount_pct INT     NOT NULL DEFAULT 0,
  prob_at_decision FLOAT,
  group_type   TEXT    NOT NULL DEFAULT 'treatment',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversions_session_idx   ON conversions(session_id);
CREATE INDEX IF NOT EXISTS conversions_converted_idx ON conversions(converted, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  store_domain TEXT,
  action       TEXT NOT NULL,
  value        INT,
  prob         FLOAT,
  model_v      INT  NOT NULL DEFAULT 0,
  model_auc    FLOAT,
  brain        TEXT NOT NULL DEFAULT 'inline',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_decisions_session_idx ON ai_decisions(session_id);
CREATE INDEX IF NOT EXISTS ai_decisions_created_idx ON ai_decisions(created_at DESC);

-- Add missing columns to popup_sessions if needed
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS scroll_depth_pct   FLOAT;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS mouse_leave_count  INT DEFAULT 0;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS cta_hover_count    INT DEFAULT 0;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS return_visitor     BOOLEAN DEFAULT FALSE;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS engagement_score   FLOAT;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS group_assignment   TEXT DEFAULT 'treatment';
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS order_value        FLOAT;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS hesitation_score   FLOAT;
ALTER TABLE popup_sessions ADD COLUMN IF NOT EXISTS time_on_site       INT;

SELECT 'Migration complete. Tables: ' || count(*)::text || ' total'
FROM information_schema.tables WHERE table_schema='public';
