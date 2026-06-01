const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://support:nolix_admin_123@127.0.0.1:5432/support"
});

async function runSchema() {
  try {
    const sqlPath = path.join(__dirname, 'nolix-level3-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log("Applying Level 3 Attribution Schema...");
    await pool.query(sql);
    console.log("✅ Level 3 Schema applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error applying schema:", error);
    process.exit(1);
  }
}

runSchema();
