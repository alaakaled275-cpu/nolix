const { Pool } = require("pg");
const dotenv = require("dotenv");

// Load both env files
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  port: parseInt(process.env.PGPORT || "5432"),
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function wipeDatabase() {
  console.log("🔥 Starting Database Wipe Sequence...");

  try {
    const tablesToWipe = [
      "users",
      "popup_sessions",
      "popup_impressions",
      "zeno_action_metrics",
      "zeno_training_backlog",
      "zeno_model_versions",
      "zeno_experiment_metrics",
      "zeno_experiment_variants",
      "zeno_experiments",
      "zeno_visitor_segments",
      "zeno_segment_membership",
      "zeno_rule_metrics",
      "zeno_behavioral_rules",
      "visitor_memory_vectors",
      "visitor_identity_graph",
    ];

    console.log(`🧹 Truncating ${tablesToWipe.length} tables...`);
    
    // Disable triggers temporarily
    await pool.query("SET session_replication_role = 'replica';");
    
    for (const table of tablesToWipe) {
      try {
        await pool.query(`TRUNCATE TABLE ${table} CASCADE;`);
        console.log(`✅ Cleared ${table}`);
      } catch (err) {
        if (err.code !== '42P01') {
          console.warn(`⚠ Could not truncate ${table}: ${err.message}`);
        }
      }
    }

    await pool.query("SET session_replication_role = 'origin';");
    console.log("✨ Database wiped successfully. Fresh start ready.");

  } catch (error) {
    console.error("❌ Fatal error wiping database:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

wipeDatabase();
