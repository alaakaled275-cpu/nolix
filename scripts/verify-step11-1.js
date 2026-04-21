/**
 * NOLIX — STEP 11.1 Final Verification Script
 * Checks: all tables, all APIs exist, all files present
 */

const { Pool } = require("pg");
const fs       = require("fs");
const path     = require("path");
const p        = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const EXPECTED_TABLES = [
  "nolix_ab_conversions", "nolix_ab_sessions", "nolix_conversions",
  "nolix_coupon_registry", "nolix_cron_log", "nolix_embeddings",
  "nolix_events", "nolix_feature_stats", "nolix_feature_store",
  "nolix_model_observability", "nolix_model_weights", "nolix_models",
  "nolix_purchase_signals", "nolix_training_logs", "nolix_truth_events",
  "nolix_unresolved_conversions", "nolix_webhook_errors"
];

const EXPECTED_FILES = [
  "lib/nolix-feature-stats.ts",
  "lib/nolix-ml-engine.ts",
  "lib/nolix-ab-engine.ts",
  "lib/nolix-queue.ts",
  "lib/nolix-truth-engine.ts",
  "lib/nolix-embedding-db.ts",
  "lib/nolix-decision-engine.ts",
  "app/api/model/sync/route.ts",
  "app/api/model/batch-train/route.ts",
  "app/api/model/rollback/route.ts",
  "app/api/model/ab-results/route.ts",
  "app/api/verify-script/route.ts",
  "app/api/webhooks/shopify/purchase/route.ts",
  "public/master.js",
  "vercel.json"
];

const EXPECTED_ENV = [
  "SHOPIFY_WEBHOOK_SECRET",
  "NOLIX_API_BASE",
  "NOLIX_SYNC_SECRET",
  "NOLIX_CRON_SECRET"
];

(async () => {
  console.log("\n════════ NOLIX STEP 11.1 FINAL VERIFICATION ════════\n");
  let pass = 0, fail = 0;

  // 1. DB Tables
  console.log("📋 [1] DATABASE TABLES:");
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  const presentTables = tables.rows.map(r => r.table_name);
  for (const t of EXPECTED_TABLES) {
    if (presentTables.includes(t)) { console.log("  ✅", t); pass++; }
    else { console.log("  ❌ MISSING:", t); fail++; }
  }

  // 2. Feature stats seeded
  console.log("\n📊 [2] FEATURE STATS:");
  const fs_rows = await p.query("SELECT COUNT(*) as cnt FROM nolix_feature_stats");
  const cnt = Number(fs_rows.rows[0].cnt);
  if (cnt === 8) { console.log("  ✅ 8 features seeded in nolix_feature_stats"); pass++; }
  else { console.log("  ⚠ Only", cnt, "features in nolix_feature_stats (expected 8)"); fail++; }

  // 3. Files
  console.log("\n📁 [3] SOURCE FILES:");
  const base = path.join(__dirname, "..");
  for (const f of EXPECTED_FILES) {
    const fp = path.join(base, f);
    if (fs.existsSync(fp)) {
      const sz = Math.round(fs.statSync(fp).size / 1024);
      console.log(`  ✅ ${f} (${sz}KB)`);
      pass++;
    } else { console.log("  ❌ MISSING:", f); fail++; }
  }

  // 4. .env vars
  console.log("\n🔑 [4] ENV VARIABLES:");
  const envPath = path.join(base, ".env");
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  for (const v of EXPECTED_ENV) {
    if (envContent.includes(v + "=")) { console.log("  ✅", v); pass++; }
    else { console.log("  ❌ MISSING:", v); fail++; }
  }

  // 5. vercel.json cron check
  console.log("\n⏰ [5] VERCEL CRON:");
  const vercelPath = path.join(base, "vercel.json");
  if (fs.existsSync(vercelPath)) {
    const vj = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
    if (vj.crons && vj.crons.length > 0) {
      vj.crons.forEach(c => console.log("  ✅ Cron:", c.path, c.schedule));
      pass++;
    } else { console.log("  ❌ vercel.json has no crons"); fail++; }
  } else { console.log("  ❌ vercel.json missing"); fail++; }

  // 6. Key DB columns check
  console.log("\n🔧 [6] KEY COLUMNS:");
  const colChecks = [
    { table: "nolix_model_weights", col: "allow_sync" },
    { table: "nolix_model_weights", col: "ai_enabled" },
    { table: "nolix_model_weights", col: "last_auc" },
    { table: "nolix_ab_sessions",   col: "ab_group" },
    { table: "nolix_truth_events",  col: "event_time" },
    { table: "nolix_coupon_registry", col: "issued_at" }
  ];
  for (const c of colChecks) {
    const r = await p.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2",
      [c.table, c.col]
    );
    if (r.rows.length) { console.log(`  ✅ ${c.table}.${c.col}`); pass++; }
    else { console.log(`  ❌ MISSING: ${c.table}.${c.col}`); fail++; }
  }

  console.log("\n════════════════════════════════════════════════════");
  console.log(`  TOTAL PASS: ${pass} | FAIL: ${fail}`);
  const pct = Math.round(pass / (pass + fail) * 100);
  console.log(`  SYSTEM READINESS: ${pct}%`);
  if (fail === 0) { console.log("  🟢 SYSTEM COMPLETE — ALL CHECKS PASS"); }
  else            { console.log("  🟡 SYSTEM MOSTLY READY — " + fail + " items need attention"); }
  console.log("════════════════════════════════════════════════════\n");
  await p.end();
})();
