/**
 * NOLIX — Step 11 Schema Migration
 * Adds: nolix_ab_sessions, nolix_ab_conversions, nolix_cron_log
 * Updates: nolix_embeddings for pgvector readiness
 */

const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [

  // PART 1: A/B Testing tables
  `CREATE TABLE IF NOT EXISTS nolix_ab_sessions (
    session_id  VARCHAR(255) PRIMARY KEY,
    visitor_id  VARCHAR(255) NOT NULL,
    store       VARCHAR(255),
    bucket      INTEGER      NOT NULL,     -- 0-99
    ab_group    VARCHAR(20)  NOT NULL,     -- 'ml' | 'control'
    extra       JSONB        NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_ab_visitor ON nolix_ab_sessions (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_ab_group   ON nolix_ab_sessions (ab_group)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_ab_store   ON nolix_ab_sessions (store, ab_group)`,

  `CREATE TABLE IF NOT EXISTS nolix_ab_conversions (
    order_id    VARCHAR(255) PRIMARY KEY,
    visitor_id  VARCHAR(255) NOT NULL,
    order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    bucket      INTEGER       NOT NULL,
    ab_group    VARCHAR(20)   NOT NULL,
    converted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_abc_visitor ON nolix_ab_conversions (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_abc_group   ON nolix_ab_conversions (ab_group)`,

  // PART 2: Cron audit log
  `CREATE TABLE IF NOT EXISTS nolix_cron_log (
    id            BIGSERIAL    PRIMARY KEY,
    job_name      VARCHAR(100) NOT NULL,
    samples       INTEGER      NOT NULL DEFAULT 0,
    loss          NUMERIC(8,6) NOT NULL DEFAULT 0,
    accuracy      NUMERIC(8,6) NOT NULL DEFAULT 0,
    drift_score   NUMERIC(8,6) NOT NULL DEFAULT 0,
    model_version INTEGER      NOT NULL DEFAULT 0,
    duration_ms   INTEGER      NOT NULL DEFAULT 0,
    ran_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_cron_ran ON nolix_cron_log (ran_at DESC)`,

  // PART 3: Add unique coupon support (already has coupon_registry — add unique index)
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nolix_coupon_unique ON nolix_coupon_registry (coupon_code)`,

  // PART 8: pgvector readiness — add vector column to embeddings
  // NOTE: Requires pgvector extension. Added as NULLABLE so it works without the extension too.
  // When pgvector is installed: CREATE EXTENSION IF NOT EXISTS vector;
  // Then the column type changes from TEXT to vector(8)
  `ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_8d TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_emb_updated ON nolix_embeddings (last_updated DESC)`,

  // PART 9: Attribution window — add event_time to truth events
  `ALTER TABLE nolix_truth_events ADD COLUMN IF NOT EXISTS event_time TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE nolix_truth_events ADD COLUMN IF NOT EXISTS attribution_window_days INTEGER DEFAULT 7`,

  // Model governance column
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS allow_sync BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS last_auc NUMERIC(6,4) NOT NULL DEFAULT 0.5`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS drift_score NUMERIC(8,6) NOT NULL DEFAULT 0`
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      // Column already exists is acceptable
      if (msg.includes("already exists")) { ok++; }
      else { console.error("❌", msg.substring(0, 120)); fail++; }
    }
  }

  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  console.log("\n✅ NOLIX STEP 11 SCHEMA COMPLETE");
  console.log(`   OK: ${ok} | FAIL: ${fail}`);
  console.log("   Tables:");
  tables.rows.forEach(r => console.log("   -", r.table_name));
  await p.end();
})();
