const { Pool } = require('pg');

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "support",
  user: "support",
  password: "nolix_admin_123",
  max: 2,
});

async function run() {
  console.log("Testing connection...");
  let start = Date.now();
  await pool.query("SELECT 1");
  console.log(`Connection OK in ${Date.now() - start}ms`);

  const queries = [
    { name: "Overview", sql: "SELECT COUNT(*) FROM popup_sessions" },
    { name: "Intent", sql: "SELECT intent_level, COUNT(*) FROM popup_sessions GROUP BY intent_level" },
    { name: "Friction", sql: "SELECT COALESCE(friction_detected,'none') AS friction_detected, COUNT(*) FROM popup_sessions GROUP BY friction_detected" },
    { name: "Today", sql: "SELECT COUNT(*) FROM popup_sessions WHERE created_at >= CURRENT_DATE" },
    { name: "TopAction", sql: "SELECT COALESCE(action_taken, offer_type, 'unknown') AS action_taken, COUNT(*) FROM popup_sessions GROUP BY action_taken, offer_type LIMIT 1" },
    { name: "AB", sql: "SELECT variant FROM ab_test_results LIMIT 1" },
    { name: "Recent", sql: "SELECT id FROM popup_sessions ORDER BY created_at DESC LIMIT 50" }
  ];

  for (const q of queries) {
    start = Date.now();
    try {
      await pool.query(q.sql);
      console.log(`${q.name}: ${Date.now() - start}ms`);
    } catch (err) {
      console.log(`${q.name} ERROR: ${err.message}`);
    }
  }
  
  console.log("Done");
  process.exit(0);
}

run().catch(console.error);
