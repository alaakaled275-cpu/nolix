import { query } from "../lib/db";

async function run() {
  console.log("Deploying nolix_workspaces table...");
  try {
    await query(`
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
    
    // Also ensuring decision_outcomes has workspace_id
    await query(`
      ALTER TABLE nolix_decision_outcomes ADD COLUMN IF NOT EXISTS workspace_id TEXT;
    `);

    console.log("Migration successful!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
