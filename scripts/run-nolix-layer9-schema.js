import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function runSchema() {
  const pool = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "support",
    user: "support",
    password: "nolix_admin_123"
  });
  
  console.log('Connecting to DB to apply Layer 9 Schema...');
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'nolix-layer9-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    console.log('✅ Layer 9 Schema applied successfully!');
  } catch (err) {
    console.error('❌ Failed to apply Schema:', err);
  } finally {
    await pool.end();
  }
}

runSchema();
