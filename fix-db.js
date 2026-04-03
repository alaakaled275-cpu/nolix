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
  console.log("Connecting to PostgreSQL...");
  try {
    await pool.query(`create extension if not exists pgcrypto;`);
    console.log("pgcrypto extension checked.");

    console.log("Creating tables...");
    await pool.query(`
      create table if not exists popup_sessions (
        id uuid primary key default gen_random_uuid(),
        session_id text not null,
        ab_variant text not null default 'A',
        time_on_site int,
        pages_viewed int,
        traffic_source text,
        cart_status text,
        device text,
        intent_score int,
        intent_level text,
        show_popup boolean not null default false,
        offer_type text,
        message text,
        reasoning text,
        converted boolean not null default false,
        created_at timestamptz not null default now()
      );

      create index if not exists popup_sessions_created_idx on popup_sessions(created_at desc);
      create index if not exists popup_sessions_offer_idx on popup_sessions(offer_type);

      create table if not exists ab_test_results (
        id uuid primary key default gen_random_uuid(),
        variant text not null,
        offer_type text not null,
        impressions int not null default 0,
        conversions int not null default 0,
        updated_at timestamptz not null default now(),
        unique (variant, offer_type)
      );

      create table if not exists store_configs (
        id uuid primary key default gen_random_uuid(),
        store_name text not null,
        platform text,
        embed_key text unique not null default gen_random_uuid()::text,
        created_at timestamptz not null default now()
      );
    `);
    console.log("Core tables created.");

    console.log("Adding required columns if they don't exist...");
    const columns = [
      ["popup_sessions", "friction_detected", "text"],
      ["popup_sessions", "action_taken", "text"],
      ["popup_sessions", "incentive_needed", "boolean"],
      ["popup_sessions", "delay_ms", "int"],
      ["popup_sessions", "order_value", "numeric(10,2)"],
      ["popup_sessions", "influenced_by_system", "boolean not null default false"],
      ["popup_sessions", "discount_avoided", "boolean not null default false"],
      ["store_configs", "mode", "text not null default 'balanced'"],
      ["store_configs", "max_discount_pct", "int not null default 15"],
    ];

    for (const [table, col, type] of columns) {
      const check = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2",
        [table, col]
      );
      if (check.rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        console.log(`Added column ${col} to ${table}.`);
      }
    }
    
    // Add tenants table from CRM schema if missing
    await pool.query(`
      create table if not exists tenants (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        created_at timestamptz not null default now()
      );
    `);
    console.log("tenants table created.");

    console.log("All tables and columns have been successfully initialized!");
  } catch (err) {
    console.error("Initialization Failed:", err.message);
  } finally {
    pool.end();
  }
}

run();
