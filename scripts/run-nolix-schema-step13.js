/**
 * NOLIX — STEP 13.5 Schema Migration
 * Tables: nolix_training_backlog, nolix_event_queue, nolix_system_metrics
 */

const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // Training Backlog — stores events when training is blocked
  `CREATE TABLE IF NOT EXISTS nolix_training_backlog (
    id           BIGSERIAL   PRIMARY KEY,
    visitor_id   TEXT        NOT NULL,
    store        TEXT,
    features     JSONB       NOT NULL,
    label        NUMERIC(3,1) NOT NULL,
    event_meta   JSONB       NOT NULL DEFAULT '{}',
    processed    BOOLEAN     NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_tb_pending ON nolix_training_backlog (created_at ASC) WHERE processed=false`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_tb_vis     ON nolix_training_backlog (visitor_id)`,

  // Persistent Event Queue — DB-backed for durability
  `CREATE TABLE IF NOT EXISTS nolix_event_queue (
    id           BIGSERIAL   PRIMARY KEY,
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL DEFAULT '{}',
    visitor_id   TEXT,
    session_id   TEXT,
    store        TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    retries      SMALLINT    NOT NULL DEFAULT 0,
    max_retries  SMALLINT    NOT NULL DEFAULT 5,
    error_msg    TEXT,
    enqueued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_eq_pending  ON nolix_event_queue (enqueued_at ASC) WHERE status='pending'`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_eq_retry    ON nolix_event_queue (next_retry_at) WHERE status='retrying'`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_eq_vis      ON nolix_event_queue (visitor_id)`,

  // Dead Letter Queue — failed events after max retries
  `CREATE TABLE IF NOT EXISTS nolix_dead_letter (
    id           BIGSERIAL   PRIMARY KEY,
    original_id  BIGINT,
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL DEFAULT '{}',
    error_msg    TEXT,
    retries      SMALLINT,
    failed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // System Metrics — operational observability
  `CREATE TABLE IF NOT EXISTS nolix_system_metrics (
    id             BIGSERIAL    PRIMARY KEY,
    metric_name    TEXT         NOT NULL,
    metric_value   NUMERIC(12,4) NOT NULL,
    tags           JSONB        NOT NULL DEFAULT '{}',
    recorded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_sm_name    ON nolix_system_metrics (metric_name, recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_sm_at      ON nolix_system_metrics (recorded_at DESC)`,

  // Add processed_at to training_backlog if missing
  `ALTER TABLE nolix_training_backlog ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      if (msg.includes("already exists")) { ok++; }
      else { console.error("❌", msg.substring(0, 100)); fail++; }
    }
  }

  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );

  const step13 = ["nolix_training_backlog","nolix_event_queue","nolix_dead_letter","nolix_system_metrics"];
  console.log("\n✅ STEP 13.5 SCHEMA COMPLETE | OK:", ok, "| FAIL:", fail);
  console.log("   Total NOLIX Tables:", tables.rows.length);
  step13.forEach(t => {
    const ok = tables.rows.find(r => r.table_name === t);
    console.log(ok ? "  ✅" : "  ❌", t);
  });
  await p.end();
})();
