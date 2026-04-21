-- ================================================================
-- NOLIX — PostgreSQL Schema (STEP 9.1)
-- Run: psql -U support -d support -f scripts/nolix-schema.sql
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE 1: nolix_events
-- All behavioral events ingested from master.js via /api/track
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_events (
  id            BIGSERIAL    PRIMARY KEY,
  type          VARCHAR(100) NOT NULL,
  visitor_id    VARCHAR(255),
  session_id    VARCHAR(255),
  store         VARCHAR(255),
  payload       JSONB        NOT NULL DEFAULT '{}',
  queued_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nolix_events_visitor    ON nolix_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_nolix_events_session    ON nolix_events (session_id);
CREATE INDEX IF NOT EXISTS idx_nolix_events_type       ON nolix_events (type);
CREATE INDEX IF NOT EXISTS idx_nolix_events_store      ON nolix_events (store);
CREATE INDEX IF NOT EXISTS idx_nolix_events_created    ON nolix_events (created_at DESC);

-- ----------------------------------------------------------------
-- TABLE 2: nolix_embeddings
-- Persistent behavioral vectors + centroid per visitor
-- Replaces in-memory Map (survives server restart)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_embeddings (
  visitor_id    VARCHAR(255) PRIMARY KEY,
  store         VARCHAR(255),
  vectors       JSONB        NOT NULL DEFAULT '[]',
  centroid      JSONB,
  session_count INTEGER      NOT NULL DEFAULT 0,
  last_updated  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nolix_embeddings_store  ON nolix_embeddings (store);
CREATE INDEX IF NOT EXISTS idx_nolix_embeddings_updated ON nolix_embeddings (last_updated DESC);

-- ----------------------------------------------------------------
-- TABLE 3: nolix_conversions
-- Ground truth purchase records from Shopify webhooks
-- truth_label is ALWAYS 1.0 for paid orders
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_conversions (
  id               BIGSERIAL    PRIMARY KEY,
  visitor_id       VARCHAR(255) NOT NULL,
  order_id         VARCHAR(255) NOT NULL UNIQUE,
  coupon_code      VARCHAR(100),
  store            VARCHAR(255),
  total_price      VARCHAR(50),
  truth_label      NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  financial_status VARCHAR(50)  NOT NULL DEFAULT 'paid',
  confirmed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nolix_conversions_visitor  ON nolix_conversions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_nolix_conversions_store    ON nolix_conversions (store);
CREATE INDEX IF NOT EXISTS idx_nolix_conversions_coupon   ON nolix_conversions (coupon_code);
CREATE INDEX IF NOT EXISTS idx_nolix_conversions_date     ON nolix_conversions (confirmed_at DESC);

-- ----------------------------------------------------------------
-- TABLE 4: nolix_model_weights
-- Persisted logistic regression weights (server-side model)
-- id = 1 is the single global model row (upserted on every train)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_model_weights (
  id            INTEGER      PRIMARY KEY DEFAULT 1,
  scroll        NUMERIC(8,6) NOT NULL DEFAULT 0.25,
  clicks        NUMERIC(8,6) NOT NULL DEFAULT 0.20,
  time          NUMERIC(8,6) NOT NULL DEFAULT 0.15,
  engagement    NUMERIC(8,6) NOT NULL DEFAULT 0.25,
  hesitation    NUMERIC(8,6) NOT NULL DEFAULT -0.35,
  bias          NUMERIC(8,6) NOT NULL DEFAULT 0,
  lr            NUMERIC(8,6) NOT NULL DEFAULT 0.01,
  version       INTEGER      NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed with default weights if not exists
INSERT INTO nolix_model_weights (id, scroll, clicks, time, engagement, hesitation, bias, lr, version)
VALUES (1, 0.25, 0.20, 0.15, 0.25, -0.35, 0, 0.01, 0)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- TABLE 5: nolix_training_log
-- Full audit trail of every gradient descent update
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_training_log (
  id            BIGSERIAL    PRIMARY KEY,
  visitor_id    VARCHAR(255),
  label         NUMERIC(4,3) NOT NULL,
  prediction    NUMERIC(8,6),
  error         NUMERIC(8,6),
  event_type    VARCHAR(100),
  model_version INTEGER,
  trained_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nolix_training_visitor ON nolix_training_log (visitor_id);
CREATE INDEX IF NOT EXISTS idx_nolix_training_date    ON nolix_training_log (trained_at DESC);

-- ----------------------------------------------------------------
-- TABLE 6: nolix_coupon_registry
-- Persisted coupon → visitor mapping
-- Replaces in-memory COUPON_VISITOR_MAP (survives server restart)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_coupon_registry (
  coupon_code   VARCHAR(100) PRIMARY KEY,
  visitor_id    VARCHAR(255) NOT NULL,
  session_id    VARCHAR(255),
  store         VARCHAR(255),
  issued_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  used          BOOLEAN      NOT NULL DEFAULT false,
  used_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nolix_coupon_visitor ON nolix_coupon_registry (visitor_id);
CREATE INDEX IF NOT EXISTS idx_nolix_coupon_store   ON nolix_coupon_registry (store);

-- ----------------------------------------------------------------
-- TABLE 7: nolix_purchase_signals
-- Purchase confirmation flags for client polling (master.js)
-- Prevents double-training: trained = true after first delivery
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_purchase_signals (
  visitor_id    VARCHAR(255) PRIMARY KEY,
  order_id      VARCHAR(255) NOT NULL,
  truth_label   NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  trained       BOOLEAN      NOT NULL DEFAULT false,
  confirmed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nolix_signals_trained ON nolix_purchase_signals (trained, visitor_id);

-- ----------------------------------------------------------------
-- TABLE 8: nolix_unresolved_conversions
-- Dead letter queue for purchases where visitor_id unknown
-- For manual reconciliation
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_unresolved_conversions (
  id            BIGSERIAL    PRIMARY KEY,
  order_id      VARCHAR(255) UNIQUE,
  coupon_code   VARCHAR(100),
  shop          VARCHAR(255),
  total_price   VARCHAR(50),
  raw_payload   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE 9: nolix_webhook_errors
-- Dead letter for failed webhook processing
-- Enables manual recovery without data loss
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nolix_webhook_errors (
  id            BIGSERIAL    PRIMARY KEY,
  raw_payload   TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- DONE
-- ================================================================
SELECT 'NOLIX SCHEMA READY' AS status,
       COUNT(*) AS tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'nolix_%';
