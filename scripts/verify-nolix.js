const { Pool } = require("pg");
const p = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

(async () => {
  // Check all NOLIX tables
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  console.log("\n📊 DB TABLES (" + tables.rows.length + " total):");
  tables.rows.forEach(r => console.log("  ✓", r.table_name));

  // Check model weights
  const weights = await p.query("SELECT version, scroll, clicks, time, engagement, hesitation, bias, lr FROM nolix_model_weights WHERE id=1");
  if (weights.rows.length) {
    console.log("\n🧠 MODEL WEIGHTS (DB):", weights.rows[0]);
  } else {
    console.log("\n⚠ No model weights row found.");
  }

  // Count events
  const events = await p.query("SELECT COUNT(*) as cnt FROM nolix_events");
  console.log("\n📡 Total events in DB:", events.rows[0].cnt);

  // Count feature store
  const features = await p.query("SELECT COUNT(*) as cnt FROM nolix_feature_store");
  console.log("🗂 Feature store entries:", features.rows[0].cnt);

  // Count embeddings
  const emb = await p.query("SELECT COUNT(*) as cnt FROM nolix_embeddings");
  console.log("🔢 Embeddings:", emb.rows[0].cnt);

  // Count truth events
  const truth = await p.query("SELECT COUNT(*) as cnt FROM nolix_truth_events");
  console.log("✅ Truth events:", truth.rows[0].cnt);

  // Count conversions
  const conv = await p.query("SELECT COUNT(*) as cnt FROM nolix_conversions");
  console.log("💰 Conversions:", conv.rows[0].cnt);

  // Check observability
  const obs = await p.query("SELECT COUNT(*) as cnt FROM nolix_model_observability");
  console.log("📈 Observability logs:", obs.rows[0].cnt);

  console.log("\n✅ STEP 10 VERIFICATION COMPLETE\n");
  await p.end();
})().catch(e => { console.error("❌ ERROR:", e.message); process.exit(1); });
