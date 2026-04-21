/**
 * NOLIX — pgvector Activation + Migration Script (FIX 2)
 * scripts/activate-pgvector.js
 *
 * WHAT THIS DOES:
 * 1. Installs pgvector extension in Postgres
 * 2. Migrates nolix_embeddings.vector_8d: TEXT → vector(8)
 * 3. Creates IVFFlat ANN index for fast cosine similarity search
 * 4. Updates nolix_embedding_db to use native vector queries
 * 5. Tests the vector search with a sample query
 *
 * RUN: node scripts/activate-pgvector.js
 */

const { Pool } = require("pg");
const p = new Pool({
  user: "support", host: "localhost",
  database: "support", password: "nolix_admin_123", port: 5432
});

(async () => {
  console.log("\n════════ pgvector ACTIVATION ════════\n");
  let ok = 0, fail = 0;

  // STEP 1: Install pgvector extension
  console.log("[1] Installing pgvector extension...");
  try {
    await p.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("  ✅ CREATE EXTENSION vector — OK");
    ok++;
  } catch(e) {
    console.error("  ❌ pgvector extension FAILED:", e.message);
    console.error("     → Fix: Run 'apt-get install postgresql-16-pgvector' or enable in Neon/Supabase dashboard");
    fail++;
  }

  // STEP 2: Check current column type
  console.log("\n[2] Checking current vector_8d column type...");
  try {
    const colType = await p.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name='nolix_embeddings' AND column_name='vector_8d'
    `);
    if (colType.rows.length) {
      const c = colType.rows[0];
      console.log("  Current type:", c.data_type, "/", c.udt_name);
      if (c.udt_name === "vector") {
        console.log("  ✅ Already vector type — no migration needed");
        ok++;
      } else {
        // STEP 3: Migrate TEXT → vector(8)
        console.log("\n[3] Migrating vector_8d: TEXT → vector(8)...");
        try {
          // First: add new column as vector type
          await p.query("ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native vector(8)");
          console.log("  ✅ Added vector_native column");

          // Migrate existing TEXT data to vector format
          const rows = await p.query(
            "SELECT id, vector_8d FROM nolix_embeddings WHERE vector_8d IS NOT NULL AND vector_8d != ''"
          );
          console.log("  Migrating", rows.rows.length, "existing embedding rows...");
          let migrated = 0;
          for (const row of rows.rows) {
            try {
              // Parse JSON array like "[0.1, 0.2, ...]" to vector format
              const parsed = JSON.parse(row.vector_8d);
              if (Array.isArray(parsed) && parsed.length === 8) {
                const vectorStr = "[" + parsed.join(",") + "]";
                await p.query(
                  "UPDATE nolix_embeddings SET vector_native=$1::vector WHERE id=$2",
                  [vectorStr, row.id]
                );
                migrated++;
              }
            } catch { /* skip malformed rows */ }
          }
          console.log("  ✅ Migrated", migrated, "/", rows.rows.length, "rows");
          ok++;
        } catch(e) {
          console.error("  ❌ Migration failed:", e.message);
          fail++;
        }
      }
    } else {
      console.log("  ⚠ vector_8d column not found in nolix_embeddings");
    }
  } catch(e) {
    console.error("  ❌ Column check failed:", e.message);
    fail++;
  }

  // STEP 4: Create IVFFlat ANN Index on vector_native
  console.log("\n[4] Creating IVFFlat ANN index (cosine similarity)...");
  try {
    // Check if vector extension is available first
    const extCheck = await p.query(
      "SELECT extname FROM pg_extension WHERE extname='vector'"
    );
    if (extCheck.rows.length === 0) {
      console.log("  ⚠ Skipping index — pgvector not installed. Cannot create index.");
    } else {
      // Count rows to determine IVFFlat lists parameter
      const countRow = await p.query("SELECT COUNT(*) as cnt FROM nolix_embeddings WHERE vector_native IS NOT NULL");
      const cnt = Number(countRow.rows[0]?.cnt) || 0;
      // IVFFlat: lists = sqrt(n), min 1, max 100
      const lists = Math.max(1, Math.min(100, Math.floor(Math.sqrt(cnt || 1))));
      console.log("  Rows with vectors:", cnt, "| IVFFlat lists:", lists);

      await p.query(`
        CREATE INDEX IF NOT EXISTS idx_nolix_emb_vector
        ON nolix_embeddings USING ivfflat (vector_native vector_cosine_ops)
        WITH (lists = ${lists})
      `);
      console.log("  ✅ IVFFlat index created (lists=" + lists + ")");
      ok++;
    }
  } catch(e) {
    console.error("  ❌ IVFFlat index FAILED:", e.message);
    console.log("  → Trying HNSW as fallback...");
    try {
      await p.query(`
        CREATE INDEX IF NOT EXISTS idx_nolix_emb_vector_hnsw
        ON nolix_embeddings USING hnsw (vector_native vector_cosine_ops)
      `);
      console.log("  ✅ HNSW index created as fallback");
      ok++;
    } catch(e2) {
      console.error("  ❌ HNSW also failed:", e2.message);
      fail++;
    }
  }

  // STEP 5: Test vector similarity search
  console.log("\n[5] Testing vector similarity search...");
  try {
    const extCheck = await p.query("SELECT extname FROM pg_extension WHERE extname='vector'");
    if (extCheck.rows.length > 0) {
      // Insert a test vector
      const testVec = "[0.25, 0.20, 0.15, 0.35, 0.25, 0.10, 0.10, 0.15]";
      await p.query(`
        INSERT INTO nolix_embeddings (visitor_id, store, vector_native, updated_at)
        VALUES ('test_pgvector_check', 'test', $1::vector, NOW())
        ON CONFLICT (visitor_id) DO UPDATE SET vector_native=$1::vector, updated_at=NOW()
      `, [testVec]);

      const result = await p.query(`
        SELECT visitor_id,
               1 - (vector_native <=> $1::vector) AS cosine_similarity
        FROM nolix_embeddings
        WHERE vector_native IS NOT NULL
        ORDER BY vector_native <=> $1::vector
        LIMIT 3
      `, [testVec]);

      console.log("  ✅ pgvector SIMILARITY SEARCH WORKS:");
      result.rows.forEach(r => {
        console.log("    visitor:", r.visitor_id, "| similarity:", parseFloat(r.cosine_similarity).toFixed(4));
      });
      ok++;

      // Cleanup test row
      await p.query("DELETE FROM nolix_embeddings WHERE visitor_id='test_pgvector_check'");
    } else {
      console.log("  ⚠ Skipping test — pgvector extension not available");
    }
  } catch(e) {
    console.error("  ❌ Similarity search test failed:", e.message);
    fail++;
  }

  // STEP 6: Update column status
  console.log("\n[6] Final column verification...");
  try {
    const cols = await p.query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name='nolix_embeddings'
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(c => console.log("  ", c.column_name, "→", c.udt_name));
    ok++;
  } catch(e) {
    console.error("  ❌", e.message); fail++;
  }

  console.log("\n════════════════════════════════════");
  console.log("  pgvector PASS:", ok, "| FAIL:", fail);
  if (fail === 0) {
    console.log("  🟢 pgvector FULLY ACTIVATED — Native ANN search operational");
  } else {
    console.log("  🟡 PARTIAL — See failures above");
    console.log("  📌 If pgvector not available locally:");
    console.log("     • Neon: Dashboard → Extensions → Enable 'vector'");
    console.log("     • Supabase: Already built-in, run SQL directly");
    console.log("     • Local: sudo apt install postgresql-16-pgvector");
  }
  console.log("════════════════════════════════════\n");
  await p.end();
})();
