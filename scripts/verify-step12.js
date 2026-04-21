const { Pool } = require("pg");
const fs   = require("fs");
const path = require("path");
const p    = new Pool({ user:"support", host:"localhost", database:"support", password:"nolix_admin_123", port:5432 });

const STEP12_TABLES = [
  "nolix_licenses", "nolix_license_violations",
  "nolix_system_health", "nolix_ab_results",
  "nolix_runtime_flags", "nolix_runtime_audit"
];

const STEP12_FILES = [
  "lib/nolix-license.ts",
  "lib/nolix-health-engine.ts",
  "lib/nolix-api-guard.ts",
  "lib/nolix-runtime.ts",
  "app/api/license/verify/route.ts",
  "app/api/dashboard/metrics/route.ts",
  "app/api/admin/runtime/route.ts",
  "app/api/admin/license/route.ts",
  "app/api/system/health/route.ts",
  "scripts/run-nolix-schema-step12.js"
];

(async () => {
  console.log("\n════════ STEP 12 FINAL VERIFICATION ════════\n");
  let pass = 0, fail = 0;

  // DB Tables
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nolix_%' ORDER BY table_name"
  );
  const presentTables = tables.rows.map(r => r.table_name);
  console.log("[1] DB TABLES (Total: " + presentTables.length + "):");
  STEP12_TABLES.forEach(t => {
    const ok = presentTables.includes(t);
    console.log("  " + (ok ? "✅" : "❌"), t);
    ok ? pass++ : fail++;
  });

  // Files
  console.log("\n[2] SOURCE FILES:");
  STEP12_FILES.forEach(f => {
    const ok = fs.existsSync(path.join(__dirname, "..", f));
    const sz = ok ? Math.round(fs.statSync(path.join(__dirname, "..", f)).size / 1024) : 0;
    console.log("  " + (ok ? "✅" : "❌"), f, ok ? "(" + sz + "KB)" : "MISSING");
    ok ? pass++ : fail++;
  });

  // Runtime Flags
  console.log("\n[3] RUNTIME FLAGS:");
  const flags = await p.query("SELECT key, value FROM nolix_runtime_flags ORDER BY key");
  const f7 = flags.rows.length === 7;
  console.log("  " + (f7 ? "✅" : "❌"), "7 flags seeded (" + flags.rows.length + " found)");
  f7 ? pass++ : fail++;
  flags.rows.forEach(r => console.log("      " + r.key + " = " + r.value));

  // ENV vars
  console.log("\n[4] ENV VARS:");
  const envPath    = path.join(__dirname, "..", ".env");
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  ["NOLIX_API_SECRET", "NOLIX_SYNC_SECRET", "NOLIX_CRON_SECRET", "NOLIX_ALERT_WEBHOOK"].forEach(v => {
    const ok = envContent.includes(v + "=");
    console.log("  " + (ok ? "✅" : "⚠ "), v, ok ? "" : "(not set — add to .env)");
    if (ok) pass++; else fail++;
  });

  // master.js checks
  console.log("\n[5] MASTER.JS FEATURES:");
  const masterPath = path.join(__dirname, "..", "public", "master.js");
  const master     = fs.existsSync(masterPath) ? fs.readFileSync(masterPath, "utf8") : "";
  const masterChecks = [
    ["verifyLicense",      "License verification function"],
    ["x-nolix-key",        "License key header"],
    ["LICENSE DENIED",     "Hard block on denied license"],
    ["ai_enabled:",        "Fail-safe flag in model state"],
    ["GATE -1",            "Fail-safe gate in decision engine"],
    ["_licenseKey",        "License key extraction from script tag"]
  ];
  masterChecks.forEach(([needle, label]) => {
    const ok = master.includes(needle);
    console.log("  " + (ok ? "✅" : "❌"), label);
    ok ? pass++ : fail++;
  });

  console.log("\n════════════════════════════════════════════");
  console.log("  PASS: " + pass + " | FAIL: " + fail);
  console.log("  READINESS: " + Math.round(pass / (pass + fail) * 100) + "%");
  if (fail === 0) console.log("  🟢 STEP 12 COMPLETE — ALL CHECKS PASS");
  else            console.log("  🟡 STEP 12 MOSTLY DONE — " + fail + " items need attention:");
  console.log("════════════════════════════════════════════\n");
  await p.end();
})();
