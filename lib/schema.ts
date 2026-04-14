import { getPool } from "./db";
import { query } from "./db";

export { query };

// Use global to persist across Hot Module Replacement (HMR) in dev mode
const globalAny: any = global;
let migrationPromise: Promise<void> | null = globalAny._convertAISchemaPromise || null;

export async function ensureNolixSchema(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const pool = getPool();
    await pool.query(`create extension if not exists pgcrypto;`);
    
    // Core tables
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

      create table if not exists waitlist (
        id uuid primary key default gen_random_uuid(),
        email text unique not null,
        name text,
        password text,
        store_url text,
        quiz_answers jsonb,
        created_at timestamptz not null default now()
      );

      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        email text unique not null,
        name text,
        password_hash text,
        provider text not null default 'local',
        reset_token text,
        reset_token_expiry timestamptz,
        created_at timestamptz not null default now()
      );

      create table if not exists zeno_action_metrics (
        id uuid primary key default gen_random_uuid(),
        store_domain text not null,
        intent_category text not null,
        friction_type text not null,
        action_name text not null,
        impressions int not null default 0,
        conversions int not null default 0,
        revenue_earned numeric(10,2) not null default 0,
        updated_at timestamptz not null default now(),
        unique (store_domain, intent_category, friction_type, action_name)
      );
    `);

    // Add new columns if they don't exist (one by one to avoid total failure)
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
      ["waitlist", "name", "text"],
      ["waitlist", "password", "text"],
      ["waitlist", "store_url", "text"],
      ["waitlist", "quiz_answers", "jsonb"],
      // Zeno verification schema for strict access 
      ["users", "store_url",              "text"],
      ["users", "store_verified",         "boolean not null default false"],
      ["users", "store_analysis",         "jsonb"],
      ["users", "quiz_answers",           "jsonb"],
      // Domain Gate — classification result stored at connection time
      // Prevents analysis from running on non-ecommerce / template / unknown sites
      ["users", "domain_gate_result",     "jsonb"],
      ["users", "domain_gate_checked_at", "timestamptz"],
      // ── ADVANCED AUTH SCHEMA ──
      ["users", "reset_token",            "text"],
      ["users", "reset_token_expiry",     "timestamptz"],
      // ── STRIPE HYBRID BILLING MODEL SCHEMA ──
      ["users", "stripe_customer_id",     "text unique"],
      ["users", "stripe_subscription_id", "text unique"],
      ["users", "subscription_status",    "text not null default 'trialing'"],
      ["users", "plan_id",                "text"],
      ["users", "revenue_share_pct",      "numeric(3,2) not null default 0.20"],
      ["users", "failed_payment_count",   "int not null default 0"],
      ["users", "billing_period_end",     "timestamptz"],
    ];

    for (const [table, col, type] of columns) {
      // Check if column exists first (faster and less locking than blind ALTER TABLE IF NOT EXISTS in some cases)
      const check = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2",
        [table, col]
      );
      if (check.rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }

    // Zeno Learning Log — persistent self-improvement memory
    await pool.query(`
      create table if not exists zeno_learning_log (
        id uuid primary key default gen_random_uuid(),
        url text not null,
        business_model text,
        error_type text not null,
        error_description text not null,
        correction_rule text not null,
        confidence_before int default 0,
        confidence_after int default 0,
        phase text,
        created_at timestamptz not null default now()
      );

      create index if not exists zeno_learning_log_created_idx on zeno_learning_log(created_at desc);
    `);

    // ── CALIBRATED REALITY LEARNING SYSTEM (CRLS) ────────────────────────────
    // These 3 tables form the ground truth validation layer.
    // Without them: probabilities are claims. With them: probabilities are measured.

    // 1. Prediction Log — what the model predicted for each URL
    await pool.query(`
      create table if not exists prediction_log (
        id                      text primary key,
        url                     text not null unique,
        ecommerce_probability   float not null,
        content_probability     float not null default 0,
        saas_probability        float not null default 0,
        marketplace_probability float not null default 0,
        confidence              float not null default 0,
        confidence_level        text,
        data_quality            text,
        detected_platform       text,
        model_version           text not null,
        created_at              timestamptz not null default now()
      );
      create index if not exists prediction_log_url_idx on prediction_log(url);
      create index if not exists prediction_log_model_idx on prediction_log(model_version, created_at desc);
    `);

    // 2. Outcome Log — what actually happened (ground truth)
    // verified_by priority: checkout_data > backend_event > analytics > human > inferred
    await pool.query(`
      create table if not exists outcome_log (
        id              text primary key,
        url             text not null unique,
        actual_type     text not null,
        verified_by     text not null default 'inferred',
        revenue_real    float,
        conversion_real float,
        created_at      timestamptz not null default now()
      );
      create index if not exists outcome_log_url_idx on outcome_log(url);
      create index if not exists outcome_log_type_idx on outcome_log(actual_type, verified_by);
    `);

    // 3. Calibration Metrics — model performance history
    // Every calibration run is stored. Allows tracking improvement over time.
    await pool.query(`
      create table if not exists calibration_metrics (
        id                   text primary key,
        model_version        text not null,
        mean_brier           float not null,
        mean_logloss         float not null,
        auc                  float not null,
        calibration_error    float not null,
        calibration_quality  text not null,
        overconfidence_bias  float not null default 0,
        sample_size          int not null default 0,
        created_at           timestamptz not null default now()
      );
      create index if not exists calibration_metrics_version_idx on calibration_metrics(model_version, created_at desc);
    `);

    // ── REVENUE INFRASTRUCTURE — STRICT IDEMPOTENCY & DURABILITY ─────────────
    
    // Prevents "Double Billing" disaster scenario
    await pool.query(`
      create table if not exists processed_orders (
        order_id        text primary key,
        store_domain    text not null,
        revenue_cents   int not null,
        ai_commission   int not null,
        stripe_record_id text,
        created_at      timestamptz not null default now()
      );
      create index if not exists processed_orders_store_idx on processed_orders(store_domain);
    `);

    // Reliable Usage Sync Queue (Outbox Pattern)
    await pool.query(`
      create table if not exists usage_sync_queue (
        id              uuid primary key default gen_random_uuid(),
        order_id        text not null unique,
        store_domain    text not null,
        revenue_cents   int not null,
        status          text not null default 'pending', -- pending, processing, completed, failed
        fail_count      int not null default 0,
        last_error      text,
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now()
      );
    `);

    // ── CAUSAL INTELLIGENCE CORE ────────────────────────────────────────────────
    // nolix_uplift_model: stores REAL causal effect per (cohort × action)
    // uplift_rate = treatment_cvr - control_cvr  ← this IS causation, not correlation
    await pool.query(`
      create table if not exists nolix_uplift_model (
        id             uuid primary key default gen_random_uuid(),
        cohort_key     text not null,
        action_type    text not null,
        treatment_conversions  int not null default 0,
        treatment_impressions  int not null default 0,
        control_conversions    int not null default 0,
        control_impressions    int not null default 0,
        uplift_rate    float not null default 0,
        confidence     float not null default 0,
        sample_size    int not null default 0,
        exploration_weight float not null default 1.0,
        updated_at     timestamptz not null default now(),
        unique (cohort_key, action_type)
      );

      create index if not exists uplift_model_cohort_idx on nolix_uplift_model(cohort_key);
    `);

    // Add causal tracking columns to existing sessions table
    const causalCols = [
      ["popup_sessions", "group_assignment", "text not null default 'treatment'"],
      ["popup_sessions", "cohort_key", "text"],
      ["popup_sessions", "expected_uplift", "float"],
      ["popup_sessions", "uplift_confidence", "float"],
      ["popup_sessions", "scroll_depth_pct", "int"],
      ["popup_sessions", "return_visitor", "boolean not null default false"],
      ["popup_sessions", "price_bucket", "text"],
    ];
    for (const [table, col, type] of causalCols) {
      const check = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2",
        [table, col]
      );
      if (check.rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }

    // ── CAUSAL STABILITY: 7-day rolling window table ───────────────────────────
    // Stores ONLY recent 7-day data for stability + drift detection.
    // Separate from the all-time model to avoid conflating historical vs current behavior.
    await pool.query(`
      create table if not exists nolix_uplift_recent (
        id                    uuid primary key default gen_random_uuid(),
        cohort_key            text not null,
        action_type           text not null,
        treatment_conversions int not null default 0,
        treatment_impressions int not null default 0,
        control_conversions   int not null default 0,
        control_impressions   int not null default 0,
        window_start          timestamptz not null default now(),
        updated_at            timestamptz not null default now(),
        unique (cohort_key, action_type)
      );
      create index if not exists uplift_recent_cohort_idx on nolix_uplift_recent(cohort_key);
    `);

    // Add stability_score column to nolix_uplift_model if it doesn't exist
    const stabCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='nolix_uplift_model' AND column_name='stability_score'"
    );
    if (stabCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE nolix_uplift_model ADD COLUMN stability_score float not null default 0`);
    }

    // ── OUTCOME BINDING: Add missing columns to popup_sessions ─────────────────
    const outcomeCols = [
      ["popup_sessions", "causal_revenue_credit", "float default 0"],
      ["popup_sessions", "time_to_convert_ms",    "bigint"],
      ["popup_sessions", "discount_avoided",       "boolean not null default false"],
      // Hesitation signals — the pre-decision psychology layer
      ["popup_sessions", "hesitation_score",       "int default 0"],
      ["popup_sessions", "cta_hover_count",        "int default 0"],
      ["popup_sessions", "mouse_leave_count",      "int default 0"],
      ["popup_sessions", "tab_hidden_count",       "int default 0"],
      // Hesitation-adjusted causal weight: 0.0–1.5
      // High hesitation + converted → weight > 1.0 (action was CRITICAL)
      // Low hesitation + converted  → weight < 1.0 (would have bought anyway)
      ["popup_sessions", "causal_weight",          "float default 1.0"],
    ];
    for (const [table, col, type] of outcomeCols) {
      const ck = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2",
        [table, col]
      );
      if (ck.rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }

    // ── ZENO REALITY LOGS — Per-visit prediction calibration ─────────────────
    // Every decision Zeno makes is logged here with its predicted probability.
    // When feedback arrives (convert/exit), actual_class is filled.
    // This is the ONLY way to know if the system is honest or just confident.
    await pool.query(`
      create table if not exists zeno_reality_logs (
        id                    uuid primary key default gen_random_uuid(),
        session_id            text not null,
        store_domain          text not null,
        predicted_class       text not null,          -- 'convert' | 'exit' | 'hesitate'
        predicted_probability float not null,          -- 0.0-1.0
        actual_class          text,                   -- filled on feedback: 'convert' | 'exit'
        verification_source   text default 'pending', -- 'checkout_event' | 'timeout' | 'manual'
        causal_weights        jsonb,                  -- which signals drove this prediction
        uplift_estimated      float,                  -- P(convert|action) - P(convert|no_action)
        action_taken          text,                   -- what NOLIX was told to execute
        p_convert_no_action   float,                  -- baseline probability
        p_convert_action      float,                  -- treatment probability
        economic_decision     text,                   -- 'intervene' | 'wait'
        decision_cost         float default 0,
        session_signals       jsonb,                  -- full visitor signal snapshot
        timestamp             timestamptz not null default now()
      );
      create index if not exists zeno_reality_logs_session_idx on zeno_reality_logs(session_id);
      create index if not exists zeno_reality_logs_domain_idx on zeno_reality_logs(store_domain, timestamp desc);
      create index if not exists zeno_reality_logs_calibration_idx on zeno_reality_logs(actual_class, timestamp desc);
    `);

    // ── SIGNAL IMPORTANCE LEARNING TABLE (with hesitation) ──────────────────
    await pool.query(`
      create table if not exists nolix_signal_outcomes (
        id                    uuid primary key default gen_random_uuid(),
        cohort_key            text not null,
        intent_level          text,
        friction              text,
        device                text,
        traffic_source        text,
        scroll_depth_pct      int,
        return_visitor        boolean,
        price_bucket          text,
        action_type           text not null,
        group_assignment      text not null default 'treatment',
        converted             boolean not null default false,
        hesitation_score      int default 0,
        cta_hover_count       int default 0,
        mouse_leave_count     int default 0,
        tab_hidden_count      int default 0,
        causal_weight         float default 1.0,
        causal_revenue_credit float default 0,
        created_at            timestamptz not null default now()
      );

      create index if not exists signal_outcomes_cohort_idx
        on nolix_signal_outcomes(cohort_key);
      create index if not exists signal_outcomes_converted_idx
        on nolix_signal_outcomes(converted, created_at desc);
      create index if not exists signal_outcomes_hesitation_idx
        on nolix_signal_outcomes(hesitation_score, converted);
    `);
  })();

  globalAny._convertAISchemaPromise = migrationPromise;
  return migrationPromise;
}

export async function ensureSchema(): Promise<void> {
  // Original CRM schema (untouched for safety)
  const pool = getPool();
  await pool.query(`create extension if not exists pgcrypto;`);
  await pool.query(`
    create table if not exists tenants (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      created_at timestamptz not null default now()
    );
    -- ... (rest of the CRM schema)
  `);
}
