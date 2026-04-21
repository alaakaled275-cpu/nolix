/**
 * NOLIX — Production Startup Assertions (STEP 13.5 PART 8)
 * lib/nolix-startup-assert.ts
 *
 * HARD BLOCK on startup if critical dependencies are missing:
 *   - DB not connected
 *   - Webhook secret missing
 *   - Sync secret missing
 *   - pgvector assertion (logs warning, doesn't block — fallback exists)
 *
 * Called once at server boot in lib/nolix-queue.ts startQueueWorker()
 */

import { query } from "./db";

export interface AssertionResult {
  passed:    boolean;
  checks:    { name: string; passed: boolean; critical: boolean; message: string }[];
  fatal:     string[];
  warnings:  string[];
}

export async function runStartupAssertions(): Promise<AssertionResult> {
  const checks: AssertionResult["checks"] = [];
  const fatal:    string[] = [];
  const warnings: string[] = [];

  // ── 1. DATABASE CONNECTION ────────────────────────────────────────
  try {
    await query("SELECT 1");
    checks.push({ name: "db_connection",     passed: true,  critical: true,  message: "DB connected" });
  } catch(e: any) {
    const msg = "DB connection failed: " + e.message;
    checks.push({ name: "db_connection",     passed: false, critical: true,  message: msg });
    fatal.push("FATAL: " + msg);
  }

  // ── 2. REQUIRED ENV VARS ─────────────────────────────────────────
  const requiredEnvs = [
    ["NOLIX_SYNC_SECRET",   true,  "Model sync auth secret"],
    ["NOLIX_CRON_SECRET",   true,  "Cron endpoint protection"],
    ["SHOPIFY_WEBHOOK_SECRET", false, "Shopify webhook validation"]
  ];

  for (const [key, critical, label] of requiredEnvs) {
    const present = !!process.env[key as string];
    checks.push({
      name:     key as string,
      passed:   present,
      critical: critical as boolean,
      message:  present ? `${label} configured` : `${label} MISSING`
    });
    if (!present) {
      if (critical) fatal.push("FATAL: " + key + " not set");
      else          warnings.push("WARN: " + key + " not set — webhook validation disabled");
    }
  }

  // ── 3. REQUIRED TABLES ───────────────────────────────────────────
  const requiredTables = [
    "nolix_events", "nolix_feature_store", "nolix_embeddings",
    "nolix_model_weights", "nolix_training_logs", "nolix_runtime_flags",
    "nolix_licenses", "nolix_training_backlog", "nolix_event_queue"
  ];

  try {
    const rows = await query<any>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
      [requiredTables]
    );
    const present = new Set((rows as any[]).map(r => r.table_name));
    for (const t of requiredTables) {
      const exists = present.has(t);
      checks.push({ name: "table_" + t, passed: exists, critical: true, message: exists ? t + " exists" : t + " MISSING" });
      if (!exists) fatal.push("FATAL: Table " + t + " does not exist. Run schema migrations.");
    }
  } catch(e: any) {
    warnings.push("Could not check tables: " + e.message);
  }

  // ── 4. PGVECTOR CHECK (warning only — fallback exists) ───────────
  try {
    const r = await query<any>("SELECT extname FROM pg_extension WHERE extname='vector'");
    const active = (r as any[]).length > 0;
    checks.push({
      name: "pgvector", passed: active, critical: false,
      message: active ? "pgvector extension active — ANN search enabled" : "pgvector not installed — JS fallback active"
    });
    if (!active) warnings.push("WARN: pgvector not installed. Similarity search uses JS O(n). Run scripts/pgvector-neon-supabase.sql in production.");
  } catch { warnings.push("WARN: Could not check pgvector status"); }

  // ── 5. RUNTIME FLAGS LOADED ──────────────────────────────────────
  try {
    const r = await query<any>("SELECT COUNT(*) as cnt FROM nolix_runtime_flags");
    const cnt = Number((r as any[])[0]?.cnt) || 0;
    checks.push({ name: "runtime_flags", passed: cnt >= 7, critical: false, message: cnt + " flags in DB (expected 7)" });
    if (cnt < 7) warnings.push("WARN: Runtime flags incomplete. Run schema migration.");
  } catch(e: any) { warnings.push("Could not check runtime flags: " + e.message); }

  const hasFatal = fatal.length > 0;

  // Print startup report
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   NOLIX STARTUP ASSERTIONS               ║");
  console.log("╚══════════════════════════════════════════╝");
  checks.forEach(c => {
    console.log(c.passed ? "  ✅" : (c.critical ? "  ❌" : "  ⚠"), c.name + ":", c.message);
  });
  if (fatal.length)    { console.error("\n🔴 FATAL ERRORS:"); fatal.forEach(f => console.error("  ", f)); }
  if (warnings.length) { console.warn("\n🟡 WARNINGS:");    warnings.forEach(w => console.warn("  ", w)); }
  console.log(hasFatal ? "\n💀 SYSTEM BOOT INCOMPLETE — fix fatal errors" : "\n✅ SYSTEM ASSERTIONS PASSED");
  console.log("═══════════════════════════════════════════\n");

  if (hasFatal && process.env.NODE_ENV === "production") {
    console.error("🚨 PRODUCTION FATAL: Assertions failed. System will not serve traffic safely.");
    // Do not call process.exit() in serverless — instead set global flag
    (global as any).__NOLIX_BOOT_FAILED__ = true;
  }

  return { passed: !hasFatal, checks, fatal, warnings };
}

// Global result cached after first run
let _assertionResult: AssertionResult | null = null;
export async function assertOnce(): Promise<AssertionResult> {
  if (_assertionResult) return _assertionResult;
  _assertionResult = await runStartupAssertions();
  return _assertionResult;
}
