/**
 * NOLIX — STEP 14 Schema Migration
 * Tables: nolix_event_dedup, ordering columns, queue metrics
 */
const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // PART 4 — Idempotency dedup table
  `CREATE TABLE IF NOT EXISTS nolix_event_dedup (
    id           BIGSERIAL    PRIMARY KEY,
    event_id     TEXT         NOT NULL UNIQUE,
    event_type   TEXT         NOT NULL,
    visitor_id   TEXT,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_dedup_id  ON nolix_event_dedup (event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_dedup_at  ON nolix_event_dedup (processed_at DESC)`,

  // PART 5 — Add event_sequence to nolix_event_queue for ordering guarantee
  `ALTER TABLE nolix_event_queue ADD COLUMN IF NOT EXISTS event_sequence BIGSERIAL`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_eq_seq ON nolix_event_queue (event_sequence ASC)`,

  // PART 6 — Queue metrics snapshot table (for visibility)
  `CREATE TABLE IF NOT EXISTS nolix_queue_metrics (
    id                  BIGSERIAL    PRIMARY KEY,
    queue_size          INT          NOT NULL DEFAULT 0,
    processing_rate     NUMERIC(8,2) NOT NULL DEFAULT 0,
    lag_seconds         INT          NOT NULL DEFAULT 0,
    dead_letter_count   INT          NOT NULL DEFAULT 0,
    redis_connected     BOOLEAN      NOT NULL DEFAULT false,
    circuit_state       VARCHAR(12)  NOT NULL DEFAULT 'CLOSED',
    error_rate          NUMERIC(5,4) NOT NULL DEFAULT 0,
    recorded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_qm_at ON nolix_queue_metrics (recorded_at DESC)`,

  // Ensure nolix_event_queue has all STEP 14 columns
  `ALTER TABLE nolix_event_queue ADD COLUMN IF NOT EXISTS event_id TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nolix_eq_event_id ON nolix_event_queue (event_id) WHERE event_id IS NOT NULL`
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      if (msg.includes("already exists") || msg.includes("does not exist")) { ok++; }
      else { console.error("❌", msg.substring(0, 120)); fail++; }
    }
  }

  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );

  const step14 = ["nolix_event_dedup","nolix_queue_metrics"];
  console.log("\n✅ STEP 14 SCHEMA | OK:", ok, "| FAIL:", fail);
  console.log("   Total NOLIX Tables:", tables.rows.length);
  step14.forEach(t => {
    const found = tables.rows.find(r => r.table_name === t);
    console.log(found ? "  ✅" : "  ❌", t);
  });
  await p.end();
})();
