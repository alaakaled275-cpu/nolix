import { query } from "../lib/schema";

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
    
    // We disable triggers temporarily to allow truncation across foreign keys if necessary
    await query("SET session_replication_role = 'replica';");
    
    for (const table of tablesToWipe) {
      try {
        await query(`TRUNCATE TABLE ${table} CASCADE;`);
        console.log(`✅ Cleared ${table}`);
      } catch (err: any) {
        // Ignore if table doesn't exist
        if (err.code !== '42P01') {
          console.warn(`⚠ Could not truncate ${table}: ${err.message}`);
        }
      }
    }

    await query("SET session_replication_role = 'origin';");
    console.log("✨ Database wiped successfully. Fresh start ready.");

  } catch (error) {
    console.error("❌ Fatal error wiping database:", error);
  } finally {
    process.exit(0);
  }
}

wipeDatabase();
