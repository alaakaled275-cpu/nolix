/**
 * NOLIX — STEP 11.1 Schema Migration
 * Tables: nolix_feature_stats, nolix_training_logs, nolix_models
 */

const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // PART 1: Feature statistics (Welford mean/std per dimension)
  `CREATE TABLE IF NOT EXISTS nolix_feature_stats (
    feature      TEXT         PRIMARY KEY,
    n            BIGINT       NOT NULL DEFAULT 0,
    mean         NUMERIC(12,8) NOT NULL DEFAULT 0,
    std          NUMERIC(12,8) NOT NULL DEFAULT 1,
    m2           NUMERIC(20,8) NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  // PART 6: Training audit log (every batch run)
  `CREATE TABLE IF NOT EXISTS nolix_training_logs (
    id             BIGSERIAL    PRIMARY KEY,
    model_id       VARCHAR(100),
    model_version  INTEGER      NOT NULL DEFAULT 0,
    train_samples  INTEGER      NOT NULL DEFAULT 0,
    val_samples    INTEGER      NOT NULL DEFAULT 0,
    train_loss     NUMERIC(10,6) NOT NULL DEFAULT 0,
    val_loss       NUMERIC(10,6) NOT NULL DEFAULT 0,
    accuracy       NUMERIC(8,6)  NOT NULL DEFAULT 0,
    precision      NUMERIC(8,6)  NOT NULL DEFAULT 0,
    recall         NUMERIC(8,6)  NOT NULL DEFAULT 0,
    f1             NUMERIC(8,6)  NOT NULL DEFAULT 0,
    auc            NUMERIC(8,6)  NOT NULL DEFAULT 0.5,
    drift_detected BOOLEAN       NOT NULL DEFAULT false,
    ai_enabled     BOOLEAN       NOT NULL DEFAULT true,
    logged_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_tl_logged  ON nolix_training_logs (logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_tl_version ON nolix_training_logs (model_version)`,

  // PART 7: Model versioning snapshots (rollback-capable)
  `CREATE TABLE IF NOT EXISTS nolix_models (
    model_id       VARCHAR(100)  PRIMARY KEY,
    weights        JSONB         NOT NULL,
    bias           NUMERIC(10,6) NOT NULL DEFAULT 0,
    lr             NUMERIC(10,8) NOT NULL DEFAULT 0.01,
    lambda         NUMERIC(10,8) NOT NULL DEFAULT 0.001,
    version        INTEGER       NOT NULL DEFAULT 0,
    metrics        JSONB         NOT NULL DEFAULT '{}',
    drift_detected BOOLEAN       NOT NULL DEFAULT false,
    ai_enabled     BOOLEAN       NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_models_created ON nolix_models (created_at DESC)`,

  // Add allow_sync and ai_enabled columns to model_weights (if not already)
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS allow_sync  BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS ai_enabled  BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS last_auc    NUMERIC(6,4) NOT NULL DEFAULT 0.5`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS drift_score NUMERIC(8,6) NOT NULL DEFAULT 0`,
  `ALTER TABLE nolix_model_weights ADD COLUMN IF NOT EXISTS val_loss    NUMERIC(8,6) NOT NULL DEFAULT 0.693`,

  // Seed feature stats with 8 feature names (initial values)
  `INSERT INTO nolix_feature_stats (feature, n, mean, std, m2) VALUES
   ('scroll',     0, 0, 1, 0),
   ('clicks',     0, 0, 1, 0),
   ('dwell',      0, 0, 1, 0),
   ('hesitation', 0, 0, 1, 0),
   ('engagement', 0, 0, 1, 0),
   ('recency',    0, 0, 1, 0),
   ('loyalty',    0, 0, 1, 0),
   ('trust',      0, 1, 0, 0)
   ON CONFLICT (feature) DO NOTHING`
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      if (msg.includes("already exists")) { ok++; }
      else { console.error("❌", msg.substring(0, 120)); fail++; }
    }
  }

  // Verify
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  const fstats = await p.query("SELECT feature, n, mean, std FROM nolix_feature_stats ORDER BY feature");
  
  console.log("\n✅ STEP 11.1 SCHEMA COMPLETE");
  console.log(`   OK: ${ok} | FAIL: ${fail}`);
  console.log("   Tables (" + tables.rows.length + "):");
  tables.rows.forEach(r => console.log("   -", r.table_name));
  console.log("\n   Feature Stats Seeded:");
  fstats.rows.forEach(r => console.log("  ", r.feature, "| n:", r.n, "| mean:", r.mean, "| std:", r.std));
  await p.end();
})();
