const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const tables = [
  // NEW TABLE: nolix_feature_store (Layer 3)
  `CREATE TABLE IF NOT EXISTS nolix_feature_store (
    visitor_id    VARCHAR(255) PRIMARY KEY,
    store         VARCHAR(255),
    session_id    VARCHAR(255),
    scroll        NUMERIC(8,6) NOT NULL DEFAULT 0,
    clicks        NUMERIC(8,6) NOT NULL DEFAULT 0,
    dwell         NUMERIC(8,6) NOT NULL DEFAULT 0,
    hesitation    NUMERIC(8,6) NOT NULL DEFAULT 0,
    engagement    NUMERIC(8,6) NOT NULL DEFAULT 0,
    recency       NUMERIC(8,6) NOT NULL DEFAULT 0,
    visit_loyalty NUMERIC(8,6) NOT NULL DEFAULT 0,
    trust         NUMERIC(8,6) NOT NULL DEFAULT 1,
    version       INTEGER      NOT NULL DEFAULT 1,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_fs_store   ON nolix_feature_store (store)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_fs_updated ON nolix_feature_store (updated_at DESC)`,

  // NEW TABLE: nolix_truth_events (Layer 6)
  `CREATE TABLE IF NOT EXISTS nolix_truth_events (
    id            BIGSERIAL    PRIMARY KEY,
    visitor_id    VARCHAR(255) NOT NULL,
    event_type    VARCHAR(100) NOT NULL,
    truth_label   NUMERIC(4,3) NOT NULL,
    order_id      VARCHAR(255),
    store         VARCHAR(255),
    value         VARCHAR(50),
    meta          JSONB        NOT NULL DEFAULT '{}',
    registered_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (visitor_id, event_type, order_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_truth_visitor ON nolix_truth_events (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_truth_type    ON nolix_truth_events (event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_truth_store   ON nolix_truth_events (store)`,

  // NEW TABLE: nolix_model_observability (Layer 8)
  `CREATE TABLE IF NOT EXISTS nolix_model_observability (
    id             BIGSERIAL    PRIMARY KEY,
    training_type  VARCHAR(50)  NOT NULL,
    samples        INTEGER      NOT NULL DEFAULT 0,
    loss           NUMERIC(8,6) NOT NULL DEFAULT 0,
    accuracy       NUMERIC(8,6) NOT NULL DEFAULT 0,
    drift_score    NUMERIC(8,6) NOT NULL DEFAULT 0,
    model_version  INTEGER      NOT NULL DEFAULT 0,
    logged_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_obs_logged ON nolix_model_observability (logged_at DESC)`,

  // ENSURE existing tables still exist (idempotent)
  `CREATE TABLE IF NOT EXISTS nolix_events (
    id BIGSERIAL PRIMARY KEY, type VARCHAR(100) NOT NULL,
    visitor_id VARCHAR(255), session_id VARCHAR(255), store VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}', queued_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_model_weights (
    id INTEGER PRIMARY KEY DEFAULT 1,
    scroll NUMERIC(8,6) NOT NULL DEFAULT 0.25, clicks NUMERIC(8,6) NOT NULL DEFAULT 0.20,
    time NUMERIC(8,6) NOT NULL DEFAULT 0.15, engagement NUMERIC(8,6) NOT NULL DEFAULT 0.25,
    hesitation NUMERIC(8,6) NOT NULL DEFAULT -0.35, bias NUMERIC(8,6) NOT NULL DEFAULT 0,
    lr NUMERIC(8,6) NOT NULL DEFAULT 0.01, version INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO nolix_model_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS nolix_embeddings (
    visitor_id VARCHAR(255) PRIMARY KEY, store VARCHAR(255),
    vectors JSONB NOT NULL DEFAULT '[]', centroid JSONB,
    session_count INTEGER NOT NULL DEFAULT 0, last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_conversions (
    id BIGSERIAL PRIMARY KEY, visitor_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL UNIQUE, coupon_code VARCHAR(100), store VARCHAR(255),
    total_price VARCHAR(50), truth_label NUMERIC(4,3) NOT NULL DEFAULT 1.0,
    financial_status VARCHAR(50) NOT NULL DEFAULT 'paid', confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_coupon_registry (
    coupon_code VARCHAR(100) PRIMARY KEY, visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255), store VARCHAR(255),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), used BOOLEAN NOT NULL DEFAULT false, used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_purchase_signals (
    visitor_id VARCHAR(255) PRIMARY KEY, order_id VARCHAR(255) NOT NULL,
    truth_label NUMERIC(4,3) NOT NULL DEFAULT 1.0,
    trained BOOLEAN NOT NULL DEFAULT false, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_training_log (
    id BIGSERIAL PRIMARY KEY, visitor_id VARCHAR(255),
    label NUMERIC(4,3) NOT NULL, prediction NUMERIC(8,6), error NUMERIC(8,6),
    event_type VARCHAR(100), model_version INTEGER, trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_unresolved_conversions (
    id BIGSERIAL PRIMARY KEY, order_id VARCHAR(255) UNIQUE,
    coupon_code VARCHAR(100), shop VARCHAR(255), total_price VARCHAR(50),
    raw_payload TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_webhook_errors (
    id BIGSERIAL PRIMARY KEY, raw_payload TEXT, error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of tables) {
    try { await p.query(sql); ok++; }
    catch(e) { console.error("❌", e.message.substring(0, 120)); fail++; }
  }

  const r = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );

  console.log("\n✅ NOLIX STEP 10 SCHEMA COMPLETE");
  console.log(`   Statements OK: ${ok} | FAIL: ${fail}`);
  console.log("   Tables in DB:");
  r.rows.forEach(row => console.log("   -", row.table_name));
  await p.end();
})();
