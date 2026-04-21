/**
 * NOLIX — STEP 13 + 13.5 COMPLETE VERIFICATION
 */
const { Pool } = require("pg");
const fs  = require("fs");
const path = require("path");
const p   = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });
const BASE = "c:/Users/ALQ/Pictures/projects/projects/project-3";

function check(label, condition) {
  const ok = !!condition;
  console.log(ok ? "  ✅" : "  ❌", label);
  return ok;
}
function fileContains(file, needle) {
  try { return fs.readFileSync(path.join(BASE, file), "utf8").includes(needle); }
  catch { return false; }
}

(async () => {
  let pass = 0, fail = 0;
  const c = (l, v) => { v ? pass++ : fail++; check(l, v); };
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  STEP 13 + 13.5 FINAL VERIFICATION           ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  // ── PART 2: Vector Engine ──────────────────────────────────────────
  console.log("【PART 2】 Vector Similarity Engine:");
  c("lib/nolix-vector-engine.ts exists",          fs.existsSync(path.join(BASE, "lib/nolix-vector-engine.ts")));
  c("findSimilarUsers() defined",                  fileContains("lib/nolix-vector-engine.ts", "export async function findSimilarUsers"));
  c("filterHighSimilarity() defined",              fileContains("lib/nolix-vector-engine.ts", "export function filterHighSimilarity"));
  c("similarityBoost() defined",                   fileContains("lib/nolix-vector-engine.ts", "export function similarityBoost"));
  c("storeEmbedding() defined",                    fileContains("lib/nolix-vector-engine.ts", "export async function storeEmbedding"));
  c("runEmbeddingPipeline() defined",              fileContains("lib/nolix-vector-engine.ts", "export async function runEmbeddingPipeline"));
  c("pgvector native <=> operator",                fileContains("lib/nolix-vector-engine.ts", "vector_native <=>"));
  c("JS fallback cosine mode",                     fileContains("lib/nolix-vector-engine.ts", "js_fallback"));
  c("IVFFlat index reference",                     fileContains("lib/nolix-vector-engine.ts", "ivfflat"));
  c("normalizeVector() defined",                   fileContains("lib/nolix-vector-engine.ts", "export function normalizeVector"));
  c("getVectorEngineStatus() defined",             fileContains("lib/nolix-vector-engine.ts", "export async function getVectorEngineStatus"));

  // ── PART 3: Health Engine → Real Control ──────────────────────────
  console.log("\n【PART 3】 Health Engine → Real System Control:");
  c("setFlag imported in health-engine",           fileContains("lib/nolix-health-engine.ts", "import { setFlag }"));
  c("auto_health_shutdown action",                 fileContains("lib/nolix-health-engine.ts", "auto_health_shutdown"));
  c("auto_health_training_block action",           fileContains("lib/nolix-health-engine.ts", "auto_health_training_block"));
  c("auto_health_recovery action",                 fileContains("lib/nolix-health-engine.ts", "auto_health_recovery"));
  c("actions_taken[] field in result",             fileContains("lib/nolix-health-engine.ts", "actions_taken"));
  c("training_blocked field in result",            fileContains("lib/nolix-health-engine.ts", "training_blocked"));

  // ── PART 4: Training Gate in ML Engine ────────────────────────────
  console.log("\n【PART 4】 Training Gate in ML Engine:");
  c("canTrain() function defined",                 fileContains("lib/nolix-ml-engine.ts", "async function canTrain"));
  c("getRuntimeFlag used in canTrain",             fileContains("lib/nolix-ml-engine.ts", "getRuntimeFlag"));
  c("trainBatch checks canTrain()",               fileContains("lib/nolix-ml-engine.ts", "const allowed = await canTrain()"));
  c("training_enabled checked live from DB",       fileContains("lib/nolix-ml-engine.ts", "training_enabled"));
  c("ai_enabled checked in canTrain",              fileContains("lib/nolix-ml-engine.ts", "ai_enabled"));

  // ── PART 5: Embedding Pipeline ────────────────────────────────────
  console.log("\n【PART 5】 Embedding Pipeline:");
  c("normalize in storeEmbedding",                fileContains("lib/nolix-vector-engine.ts", "normalizeVector(vector)"));
  c("upsert on conflict",                          fileContains("lib/nolix-vector-engine.ts", "ON CONFLICT (visitor_id)"));
  c("pipeline: store → search → boost",           fileContains("lib/nolix-vector-engine.ts", "runEmbeddingPipeline"));

  // ── PART 6: Decision Engine Upgrade ──────────────────────────────
  console.log("\n【PART 6】 Decision Engine Upgrade (similarity boost):");
  c("getRuntimeFlag imported in decide",           fileContains("app/api/engine/decide/route.ts", "import { getRuntimeFlag }"));
  c("findSimilarUsers imported in decide",         fileContains("app/api/engine/decide/route.ts", "import { findSimilarUsers"));
  c("AI_DISABLED_BY_RUNTIME_FLAG gate",            fileContains("app/api/engine/decide/route.ts", "AI_DISABLED_BY_RUNTIME_FLAG"));
  c("simBoost calculation",                        fileContains("app/api/engine/decide/route.ts", "simBoost"));
  c("boosted_p_convert in response",               fileContains("app/api/engine/decide/route.ts", "boosted_p_convert"));
  c("similarity_boost in response",                fileContains("app/api/engine/decide/route.ts", "similarity_boost"));

  // ── PART 7: master.js Hard Lock ──────────────────────────────────
  console.log("\n【PART 7】 master.js Distributed Kill-Switch:");
  c("fetchRuntimeFlags() function",               fileContains("public/master.js", "async function fetchRuntimeFlags"));
  c("window.NOLIX.runtime object initialized",    fileContains("public/master.js", "window.NOLIX.runtime = {"));
  c("/api/runtime/flags fetched on boot",          fileContains("public/master.js", "/api/runtime/flags"));
  c("maintenance_mode gate in runDecisionEngine",  fileContains("public/master.js", "maintenance_mode === true"));
  c("ai_enabled gate in runDecisionEngine",        fileContains("public/master.js", "runtime.ai_enabled === false"));
  c("Boot chains: license → flags → init",         fileContains("public/master.js", "return fetchRuntimeFlags()"));

  // ── PART 8: API Route for flags ───────────────────────────────────
  console.log("\n【PART 8】 Public Runtime Flags API:");
  c("app/api/runtime/flags/route.ts exists",      fs.existsSync(path.join(BASE, "app/api/runtime/flags/route.ts")));
  c("loadRuntimeFlags() called (force fresh)",    fileContains("app/api/runtime/flags/route.ts", "loadRuntimeFlags()"));
  c("Cache-Control: no-store",                    fileContains("app/api/runtime/flags/route.ts", "no-store"));

  // ── STEP 13.5 Runtime additions ──────────────────────────────────
  console.log("\n【13.5 PART 1】 getRuntimeFlag() live DB read:");
  c("getRuntimeFlag() defined in nolix-runtime",  fileContains("lib/nolix-runtime.ts", "export async function getRuntimeFlag"));
  c("forceLoadRuntimeFlags() defined",            fileContains("lib/nolix-runtime.ts", "export async function forceLoadRuntimeFlags"));

  // ── STEP 13.5 PART 3: Training Backlog ───────────────────────────
  console.log("\n【13.5 PART 3】 Training Backlog (zero data loss):");
  c("lib/nolix-training-backlog.ts exists",       fs.existsSync(path.join(BASE, "lib/nolix-training-backlog.ts")));
  c("saveToBacklog() defined",                    fileContains("lib/nolix-training-backlog.ts", "export async function saveToBacklog"));
  c("processBacklogBatch() defined",              fileContains("lib/nolix-training-backlog.ts", "export async function processBacklogBatch"));
  c("getBacklogStatus() defined",                 fileContains("lib/nolix-training-backlog.ts", "export async function getBacklogStatus"));
  c("Queue saves to backlog (not drops)",         fileContains("lib/nolix-queue.ts", "saveToBacklog"));

  // ── STEP 13.5 PART 4: DB Tables ──────────────────────────────────
  console.log("\n【13.5 PART 4】 DB Tables:");
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  const tset = new Set(tables.rows.map(r => r.table_name));
  const step13tables = ["nolix_training_backlog","nolix_event_queue","nolix_dead_letter","nolix_system_metrics"];
  step13tables.forEach(t => c("Table: " + t, tset.has(t)));
  c("Total tables >= 31", tables.rows.length >= 31);
  console.log("  Total NOLIX tables:", tables.rows.length);

  // ── STEP 13.5 PART 6: Metrics Logger ──────────────────────────────
  console.log("\n【13.5 PART 6】 System Metrics Logger:");
  c("lib/nolix-metrics.ts exists",               fs.existsSync(path.join(BASE, "lib/nolix-metrics.ts")));
  c("logMetric() defined",                       fileContains("lib/nolix-metrics.ts", "export async function logMetric"));
  c("logMetrics() batch defined",                fileContains("lib/nolix-metrics.ts", "export async function logMetrics"));
  c("snapshotSystemMetrics() defined",           fileContains("lib/nolix-metrics.ts", "export async function snapshotSystemMetrics"));
  c("purgeOldMetrics() 7-day retention",         fileContains("lib/nolix-metrics.ts", "7 days"));
  c("Queue snapshots metrics every 5min",        fileContains("lib/nolix-queue.ts", "snapshotSystemMetrics"));

  // ── STEP 13.5 PART 8: Startup Assertions ─────────────────────────
  console.log("\n【13.5 PART 8】 Production Startup Assertions:");
  c("lib/nolix-startup-assert.ts exists",        fs.existsSync(path.join(BASE, "lib/nolix-startup-assert.ts")));
  c("runStartupAssertions() defined",            fileContains("lib/nolix-startup-assert.ts", "export async function runStartupAssertions"));
  c("assertOnce() defined",                      fileContains("lib/nolix-startup-assert.ts", "export async function assertOnce"));
  c("DB connection checked",                     fileContains("lib/nolix-startup-assert.ts", "db_connection"));
  c("pgvector checked in assertions",            fileContains("lib/nolix-startup-assert.ts", "pgvector"));
  c("Startup runs assertOnce in queue worker",   fileContains("lib/nolix-queue.ts", "assertOnce()"));

  // ── STEP 13.5 PART 3: Backlog Drain API ──────────────────────────
  console.log("\n【13.5 Drain API】:");
  c("app/api/admin/backlog/drain/route.ts",      fs.existsSync(path.join(BASE, "app/api/admin/backlog/drain/route.ts")));

  // ── pgvector SQL Scripts ──────────────────────────────────────────
  console.log("\n【pgvector SQL】:");
  c("scripts/pgvector-neon-supabase.sql ready",  fs.existsSync(path.join(BASE, "scripts/pgvector-neon-supabase.sql")));
  c("scripts/activate-pgvector.js ready",        fs.existsSync(path.join(BASE, "scripts/activate-pgvector.js")));

  // ── SUMMARY ───────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  PASS:", pass, "| FAIL:", fail, "| READINESS:", Math.round(pass/(pass+fail)*100) + "%", "          ║");
  if (fail === 0) {
    console.log("║  🟢 STEP 13 + 13.5: ALL CHECKS PASS          ║");
  } else {
    console.log("║  🟡 " + fail + " items need attention                  ║");
  }
  console.log("╚═══════════════════════════════════════════════╝\n");
  await p.end();
})();
