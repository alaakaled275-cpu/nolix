import { getPool } from "./lib/db.js";

async function run() {
  const pool = getPool();
  try {
    const res = await pool.query("SELECT * FROM users");
    console.log("Success! Columns:", res.fields.map(f => f.name));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
  }
}
run();
