/**
 * NOLIX — STEP 15 Schema Migration
 * scripts/run-nolix-schema-step15.js
 */
const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // PART 1+2 — Model Registry
  `CREATE TABLE IF NOT EXISTS nolix_model_registry (
    model_id       TEXT         NOT NULL UNIQUE,
    version        INT          NOT NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'staging',
    auc            NUMERIC(6,4) NOT NULL DEFAULT 0.5,
    drift          NUMERIC(6,4) NOT NULL DEFAULT 0,
    train_samples  INT          NOT NULL DEFAULT 0,
    registered_by  TEXT,
    promoted_by    TEXT,
    promoted_at    TIMESTAMPTZ,
    concluded_by   TEXT,
    metrics_json   JSONB        NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nolix_mr_version ON nolix_model_registry (version)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_mr_status ON nolix_model_registry (status)`,

  // PART 3 — Feature Snapshots (point-in-time correct)
  `CREATE TABLE IF NOT EXISTS nolix_feature_snapshots (
    id             BIGSERIAL    PRIMARY KEY,
    visitor_id     TEXT         NOT NULL,
    session_id     TEXT,
    store          TEXT,
    features_json  JSONB        NOT NULL,
    label          SMALLINT,
    schema_version INT          NOT NULL DEFAULT 3,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ,
    UNIQUE (visitor_id, session_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_fs_visitor  ON nolix_feature_snapshots (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_fs_created  ON nolix_feature_snapshots (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_fs_label    ON nolix_feature_snapshots (label) WHERE label IS NOT NULL`,

  // PART 4 — GBT Models
  `CREATE TABLE IF NOT EXISTS nolix_gbt_models (
    id           BIGSERIAL    PRIMARY KEY,
    model_json   JSONB        NOT NULL,
    auc          NUMERIC(6,4) NOT NULL DEFAULT 0.5,
    train_samples INT         NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  // PART 10 — Experiments
  `CREATE TABLE IF NOT EXISTS nolix_experiments (
    experiment_id  TEXT         NOT NULL PRIMARY KEY,
    name           TEXT         NOT NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'active',
    buckets_json   JSONB        NOT NULL DEFAULT '[]',
    winner         TEXT,
    created_by     TEXT,
    concluded_by   TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    concluded_at   TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS nolix_experiment_results (
    id            BIGSERIAL    PRIMARY KEY,
    experiment_id TEXT         NOT NULL,
    visitor_id    TEXT         NOT NULL,
    bucket        TEXT         NOT NULL,
    converted     BOOLEAN      NOT NULL DEFAULT false,
    revenue       NUMERIC(10,2) NOT NULL DEFAULT 0,
    recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (experiment_id, visitor_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_er_exp ON nolix_experiment_results (experiment_id)`,

  // PART 11 — Visitor segments
  `CREATE TABLE IF NOT EXISTS nolix_visitor_segments (
    visitor_id    TEXT         NOT NULL PRIMARY KEY,
    segment       TEXT         NOT NULL DEFAULT 'unknown',
    cluster_id    INT          NOT NULL DEFAULT 0,
    confidence    NUMERIC(5,4) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_vs_segment ON nolix_visitor_segments (segment)`,

  // PART 12 — Monitor reports
  `CREATE TABLE IF NOT EXISTS nolix_monitor_reports (
    id           BIGSERIAL    PRIMARY KEY,
    report_json  JSONB        NOT NULL,
    alert_level  VARCHAR(8)   NOT NULL DEFAULT 'green',
    model_version INT         NOT NULL DEFAULT 0,
    computed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_monitor_at ON nolix_monitor_reports (computed_at DESC)`,

  // PART 14 — Audit log
  `CREATE TABLE IF NOT EXISTS nolix_audit_log (
    id           BIGSERIAL    PRIMARY KEY,
    action       TEXT         NOT NULL,
    client_id    TEXT         NOT NULL,
    access_tier  TEXT         NOT NULL DEFAULT 'none',
    details_json JSONB        NOT NULL DEFAULT '{}',
    logged_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_audit_at ON nolix_audit_log (logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_audit_action ON nolix_audit_log (action)`,
];

(async () => {
  let ok=0, fail=0;
  for (const sql of migrations) {
    const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)|CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+)/)?.[1] || sql.substring(0,60);
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      if (msg.includes("already exists")) { ok++; }
      else { console.error("❌", name, ":", msg.substring(0,80)); fail++; }
    }
  }

  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );

  const step15 = [
    "nolix_model_registry","nolix_feature_snapshots","nolix_gbt_models",
    "nolix_experiments","nolix_experiment_results","nolix_visitor_segments",
    "nolix_monitor_reports","nolix_audit_log"
  ];

  console.log("\n✅ STEP 15 SCHEMA | OK:", ok, "| FAIL:", fail);
  console.log("   Total NOLIX Tables:", tables.rows.length);
  step15.forEach(t => {
    const found = tables.rows.find(r => r.table_name === t);
    console.log(found ? "  ✅" : "  ❌", t);
  });
  await p.end();
})();
