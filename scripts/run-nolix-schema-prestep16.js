/**
 * NOLIX — Pre-Step 16 Schema Migration
 * scripts/run-nolix-schema-prestep16.js
 * 
 * Creates: nolix_decision_logs + pgvector activation + indexes
 */
const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const migrations = [
  // PART 4 — Decision Logs
  `CREATE TABLE IF NOT EXISTS nolix_decision_logs (
    id         BIGSERIAL    PRIMARY KEY,
    trace_id   TEXT         NOT NULL UNIQUE,
    visitor_id TEXT         NOT NULL,
    command    TEXT         NOT NULL,
    input      JSONB        NOT NULL DEFAULT '{}',
    output     JSONB        NOT NULL DEFAULT '{}',
    reasoning  TEXT         NOT NULL DEFAULT '',
    latency_ms INT          NOT NULL DEFAULT 0,
    version    TEXT         NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ndl_visitor   ON nolix_decision_logs (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ndl_command   ON nolix_decision_logs (command)`,
  `CREATE INDEX IF NOT EXISTS idx_ndl_created   ON nolix_decision_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ndl_trace     ON nolix_decision_logs (trace_id)`,

  // pgvector — add vector_native column if not exists
  `ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native TEXT`,
];

const pgvectorMigrations = [
  // These require pgvector extension — run separately and may fail gracefully
  `DO $$ BEGIN
     CREATE EXTENSION IF NOT EXISTS vector;
   EXCEPTION WHEN OTHERS THEN NULL; END $$`,

  `DO $$ BEGIN
     ALTER TABLE nolix_embeddings ALTER COLUMN vector_native TYPE vector(8) USING vector_native::vector;
   EXCEPTION WHEN OTHERS THEN NULL; END $$`,

  `DO $$ BEGIN
     CREATE INDEX idx_nolix_emb_vector_cos ON nolix_embeddings
       USING ivfflat (vector_native vector_cosine_ops) WITH (lists = 100);
   EXCEPTION WHEN OTHERS THEN NULL; END $$`,
];

(async () => {
  let ok=0, fail=0;

  for (const sql of migrations) {
    const name = sql.substring(0,60).trim();
    try { await p.query(sql); ok++; }
    catch(e) {
      const msg = e.message || "";
      if (msg.includes("already exists")) ok++;
      else { console.error("❌", name.substring(0,50), ":", msg.substring(0,80)); fail++; }
    }
  }

  // Try pgvector
  console.log("\n--- pgvector activation ---");
  let pgvectorOk = false;
  for (const sql of pgvectorMigrations) {
    try {
      await p.query(sql);
      pgvectorOk = true;
    } catch(e) {
      // Expected if pgvector extension not installed on this DB
    }
  }

  // Check if vector_native column is vector type
  const colType = await p.query(
    "SELECT data_type FROM information_schema.columns WHERE table_name='nolix_embeddings' AND column_name='vector_native'"
  ).catch(()=>({rows:[]}));
  const isVectorType = colType.rows[0]?.data_type === 'USER-DEFINED'; // pgvector type shows as USER-DEFINED

  // Check index
  const idxExists = await p.query(
    "SELECT indexname FROM pg_indexes WHERE tablename='nolix_embeddings' AND indexname='idx_nolix_emb_vector_cos'"
  ).catch(()=>({rows:[]}));

  console.log(isVectorType ? '  ✅ vector_native IS vector(8) type' : '  ⚠️  vector_native is TEXT (pgvector not active on this DB)');
  console.log(idxExists.rows.length>0 ? '  ✅ IVFFLAT index exists' : '  ⚠️  IVFFLAT index NOT found (run pgvector-production.sql in Neon)');

  // Decision logs check
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );

  const logExists = tables.rows.find(r => r.table_name==='nolix_decision_logs');
  
  console.log("\n✅ PRE-STEP 16 SCHEMA | OK:", ok, "| FAIL:", fail);
  console.log("   Total NOLIX Tables:", tables.rows.length);
  console.log(logExists ? '  ✅ nolix_decision_logs' : '  ❌ nolix_decision_logs MISSING');

  if (!isVectorType) {
    console.log("\n  📋 pgvector MANUAL STEPS (run in Neon/Supabase SQL Editor):");
    console.log("  CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("  ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native vector(8);");
    console.log("  UPDATE nolix_embeddings SET vector_native = vector_8d::vector WHERE vector_native IS NULL;");
    console.log("  CREATE INDEX idx_nolix_emb_vector_cos ON nolix_embeddings USING ivfflat (vector_native vector_cosine_ops) WITH (lists=100);");
    console.log("  ANALYZE nolix_embeddings;");
  }

  await p.end();
})();
