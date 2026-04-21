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
  console.log("Setting up nolix_workspaces...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nolix_workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        domain TEXT UNIQUE,
        public_key TEXT UNIQUE,
        secret_key TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("nolix_workspaces table created/verified.");
    
    // Create initial safe workspace for our demo if it doesn't exist
    const crypto = require('crypto');
    const existing = await pool.query(`SELECT id FROM nolix_workspaces WHERE id = 'ws_demo_live'`);
    if (existing.rowCount === 0) {
      const pub_key = "pk_zeno_" + crypto.randomBytes(16).toString("hex");
      const sec_key = "sk_zeno_" + crypto.randomBytes(32).toString("hex");
      await pool.query(`
        INSERT INTO nolix_workspaces (id, name, domain, public_key, secret_key)
        VALUES ('ws_demo_live', 'Demo Store', 'demo.local', $1, $2)
      `, [pub_key, sec_key]);
      console.log("Demo workspace initialized with public key:", pub_key);
    }
    
    // Add workspace_id column to existing critical tables if missing
    const tables = ['nolix_decision_outcomes', 'nolix_pricing_decisions', 'ab_test_results'];
    for (const table of tables) {
       try {
         await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws_demo_live';`);
         console.log(`workspace_id ensured on ${table}`);
       } catch(e) {
         console.log(`Skip adding to ${table}: ${e.message}`);
       }
    }
    
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}

run();
