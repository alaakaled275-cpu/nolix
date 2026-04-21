/**
 * NOLIX — STEP 12 Schema Migration
 * Tables: nolix_licenses, nolix_license_violations, nolix_system_health,
 *         nolix_ab_results, nolix_runtime_flags, nolix_runtime_audit
 */

const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // PART 1: License Key System
  `CREATE TABLE IF NOT EXISTS nolix_licenses (
    id             BIGSERIAL    PRIMARY KEY,
    shop_domain    TEXT         UNIQUE NOT NULL,
    license_key    TEXT         UNIQUE NOT NULL,
    plan           VARCHAR(50)  NOT NULL DEFAULT 'starter',
    is_active      BOOLEAN      NOT NULL DEFAULT true,
    allowed_domains TEXT[]      NOT NULL DEFAULT '{}',
    expires_at     TIMESTAMPTZ,
    request_count  BIGINT       NOT NULL DEFAULT 0,
    last_seen_at   TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_lic_key    ON nolix_licenses (license_key)`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_lic_domain ON nolix_licenses (shop_domain)`,

  // License violation log
  `CREATE TABLE IF NOT EXISTS nolix_license_violations (
    id            BIGSERIAL   PRIMARY KEY,
    license_key   TEXT        NOT NULL,
    blocked_domain TEXT       NOT NULL,
    attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_lic_viol ON nolix_license_violations (license_key, attempted_at DESC)`,

  // PART 2: System Health Snapshots
  `CREATE TABLE IF NOT EXISTS nolix_system_health (
    id                BIGSERIAL    PRIMARY KEY,
    auc               NUMERIC(6,4) NOT NULL DEFAULT 0,
    drift             NUMERIC(8,6) NOT NULL DEFAULT 0,
    conversion_rate   NUMERIC(8,6) NOT NULL DEFAULT 0,
    training_failures INTEGER      NOT NULL DEFAULT 0,
    events_last_2h    INTEGER      NOT NULL DEFAULT 0,
    health_score      NUMERIC(6,4) NOT NULL DEFAULT 1,
    status            VARCHAR(20)  NOT NULL DEFAULT 'healthy',
    issues            JSONB        NOT NULL DEFAULT '[]',
    ai_enabled        BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_sh_created ON nolix_system_health (created_at DESC)`,

  // PART 4: A/B Daily Results (for revenue tracking)
  `CREATE TABLE IF NOT EXISTS nolix_ab_results (
    id             BIGSERIAL    PRIMARY KEY,
    result_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
    store          TEXT,
    ml_sessions    INTEGER      NOT NULL DEFAULT 0,
    ctrl_sessions  INTEGER      NOT NULL DEFAULT 0,
    ml_revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
    ctrl_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
    ml_conv_rate   NUMERIC(8,6) NOT NULL DEFAULT 0,
    ctrl_conv_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
    revenue_lift   NUMERIC(8,6) NOT NULL DEFAULT 0,
    conv_lift      NUMERIC(8,6) NOT NULL DEFAULT 0,
    significant    BOOLEAN      NOT NULL DEFAULT false,
    p_value        NUMERIC(8,6),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nolix_abr_date ON nolix_ab_results (result_date, store)`,

  // PART 7: Runtime Control Flags
  `CREATE TABLE IF NOT EXISTS nolix_runtime_flags (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL DEFAULT 'true',
    updated_by TEXT        NOT NULL DEFAULT 'system',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Seed default runtime flags
  `INSERT INTO nolix_runtime_flags (key, value, updated_by) VALUES
   ('ai_enabled',        'true',  'system'),
   ('training_enabled',  'true',  'system'),
   ('embedding_enabled', 'true',  'system'),
   ('ab_test_enabled',   'true',  'system'),
   ('coupons_enabled',   'true',  'system'),
   ('webhooks_enabled',  'true',  'system'),
   ('maintenance_mode',  'false', 'system')
   ON CONFLICT (key) DO NOTHING`,

  // Runtime Flag Audit Trail
  `CREATE TABLE IF NOT EXISTS nolix_runtime_audit (
    id          BIGSERIAL   PRIMARY KEY,
    flag_key    TEXT        NOT NULL,
    old_value   BOOLEAN,
    new_value   BOOLEAN,
    changed_by  TEXT        NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nolix_ra_at ON nolix_runtime_audit (changed_at DESC)`
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

  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  const rflags = await p.query("SELECT key, value FROM nolix_runtime_flags ORDER BY key");

  console.log("\n✅ STEP 12 SCHEMA COMPLETE");
  console.log(`   OK: ${ok} | FAIL: ${fail}`);
  console.log("   Total NOLIX Tables:", tables.rows.length);

  const newTables = ["nolix_licenses","nolix_license_violations","nolix_system_health","nolix_ab_results","nolix_runtime_flags","nolix_runtime_audit"];
  newTables.forEach(t => {
    const found = tables.rows.find(r => r.table_name === t);
    console.log(found ? "  ✅" : "  ❌", t);
  });

  console.log("\n  Runtime Flags Seeded:");
  rflags.rows.forEach(r => console.log(" ", r.key, "=", r.value));
  await p.end();
})();
