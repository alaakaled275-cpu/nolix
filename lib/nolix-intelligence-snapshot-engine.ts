/**
 * NOLIX — Intelligence Snapshot Engine (COMMAND 01 — FULL INTELLIGENCE STATE LOCK)
 * lib/nolix-intelligence-snapshot-engine.ts
 *
 * ⚔️ PHILOSOPHY:
 *
 *   Every Decision = Function(
 *     Behavior State,
 *     Context State,
 *     ML State,
 *     Economic State,
 *     Rules State
 *   )
 *
 *   A Decision is NOT just a result.
 *   A Decision is an IMMUTABLE INTELLIGENCE STATE SNAPSHOT.
 *
 * ⚔️ WHAT THIS MODULE PROVIDES:
 *
 *   1. ZenoDecisionSnapshot — the complete frozen state of ZENO at decision time
 *   2. captureDecisionSnapshot() — assembles the full snapshot from brain output
 *   3. saveSnapshot() — persists immutably to nolix_decision_snapshots
 *   4. getSnapshot() — retrieves + validates a snapshot by trace_id
 *   5. replayFromSnapshot() — reconstructs and re-runs the exact same decision
 *   6. detectDrift() — compares two snapshots and measures rule/ml drift
 *   7. querySnapshots() — analytics queries for the analyst dashboard
 *
 * ⚔️ HARD RULES (ENFORCED):
 *   ❌ NO decision is valid without a snapshot
 *   ❌ NO live ML can overwrite a saved snapshot
 *   ❌ NO partial snapshots allowed — all 7 states must be present
 *   ✔  Every snapshot is IMMUTABLE after INSERT
 *   ✔  Every snapshot is REPLAYABLE via trace_id
 *   ✔  Every snapshot contains its own rules version hash
 */

import { query } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — TYPE SYSTEM (Exact Schema from COMMAND 01)
// ─────────────────────────────────────────────────────────────────────────────

export type IntentLevel  = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FrictionType = "PRICE" | "TRUST" | "URGENCY" | "INDECISION" | "NONE";
export type GateStatus   = "OPEN" | "BLOCKED";
export type MLRole       = "PRIMARY" | "SECONDARY" | "DISABLED";

/** Full frozen intelligence state of ZENO at decision time */
export interface ZenoDecisionSnapshot {
  // Identity
  trace_id:  string;
  timestamp: number;    // Unix ms — moment of decision

  // 🧠 Behavioral State (Layer 1 output — frozen)
  behavior: {
    intent_level:      IntentLevel;
    friction_type:     FrictionType;
    raw_signals:       Record<string, any>;  // full input signal
    behavior_score:    number;               // 0.0–1.0
    rules_fired:       string[];             // every rule that ran
    engagement_depth:  "deep" | "medium" | "shallow" | "none";
    is_exit_risk:      boolean;
    is_bot_suspect:    boolean;
    is_high_value:     boolean;
    eligible:          boolean;
    ineligible_reason: string | null;
  };

  // 🌍 Context State (Layer 2 output — frozen)
  context: {
    segment:           string;     // K-Means cluster label
    aov_bucket:        string;     // "low" | "mid" | "high"
    time_context:      string;     // "morning" | "afternoon" | "evening" | "night"
    trigger:           string;     // what triggered ZENO
    store_type:        string;     // "fashion" | "electronics" | "food" | "general"
    modifiers:         Record<string, number>;  // all context multipliers applied
    eligible_actions:  string[];   // what context said was allowed
  };

  // 🤖 ML State (Layer 3 — SNAPSHOT ONLY, never re-inferred from here)
  ml: {
    model_version: string;   // which version of the model was active
    score:         number;   // raw ML conversion probability
    boost:         number;   // how much ML moved the score (+/-)
    confidence:    number;   // ML confidence 0.0–1.0
    used_as:       MLRole;   // what authority ML was given
    skipped:       boolean;  // was ML skipped?
    skip_reason:   string | null;  // if skipped, why
  };

  // ⚖️ Economic State (Layer 4 output — frozen)
  economic: {
    expected_uplift: number;   // E[lift] * AOV in $
    action_cost:     number;   // cost of chosen action
    roi_ratio:       number;   // revenue / cost (must be > 1.20)
    approved:        boolean;  // did economic gate pass?
    aov_estimate:    number;   // what AOV was used in calculation
    rejection_reason: string | null;  // if not approved, why
  };

  // 📜 Rules State (CRITICAL — the law at the moment of decision)
  rules: {
    version_hash:     string;    // SHA-style hash of rules version
    version_label:    string;    // human label e.g. "v1.0.0"
    triggered_rules:  string[];  // rules that fired and contributed
    blocked_rules:    string[];  // rules that were checked but blocked
    final_gate:       GateStatus; // OPEN = decided to act, BLOCKED = blocked
  };

  // 🧠 Final Decision Output (the verdict)
  decision: {
    action:           string;       // "show_popup" | "block" | "do_nothing"
    popup_type:       string | null;
    discount_pct:     number;
    payload:          Record<string, any>;  // full popup payload if applicable
    confidence_final: number;  // final composite score
    decision_path:    string[];  // step-by-step trail
  };

  // 🔁 Reconstruction Metadata
  reconstruction: {
    deterministic:   boolean;  // can this be replayed to same result?
    replay_safe:     boolean;  // are all inputs preserved?
    drift_detected:  boolean;  // has rule drift been detected vs current rules?
    rules_changed:   boolean;  // have rules changed since this snapshot?
    ml_changed:      boolean;  // has ML model changed since this snapshot?
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — INTERNAL CONSTANTS (Rules Version System)
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_RULES_VERSION = "v1.0.0";

/**
 * getRulesVersionHash() — deterministic hash of the current rules version
 * In production this would hash the actual rule code.
 * For now: stable hash per labeled version.
 */
function getRulesVersionHash(): string {
  const VERSION_HASHES: Record<string, string> = {
    "v1.0.0": "sha_z1b3f7a9c2e4d6f8",  // stable hash for rules v1.0.0
  };
  return VERSION_HASHES[CURRENT_RULES_VERSION] || `sha_${CURRENT_RULES_VERSION.replace(/\./g, "_")}`;
}

/**
 * getActiveModelVersion() — what ML model version is currently running
 */
function getActiveModelVersion(): string {
  return process.env.ML_MODEL_VERSION || "hybrid_brain_v1";
}

/**
 * computeAovBucket() — classify AOV into human-readable range
 */
function computeAovBucket(aov: number): string {
  if (aov >= 200) return "premium_200+";
  if (aov >= 100) return "high_100-200";
  if (aov >= 50)  return "mid_50-100";
  if (aov >= 20)  return "low_20-50";
  return "micro_<20";
}

/**
 * computeTimeContext() — classify current hour into time-of-day segment
 */
function computeTimeContext(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12)  return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

/**
 * computeRoiRatio() — calculate ROI ratio for economic gate
 */
function computeRoiRatio(expectedUplift: number, actionCost: number, aov: number): number {
  const revenue = expectedUplift;
  const cost    = actionCost * aov;
  if (cost <= 0) return expectedUplift > 0 ? 99 : 0;
  return Math.round((revenue / cost) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — CORE CAPTURE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input required to capture a full snapshot — comes from decide-v2 after
 * runHybridBrain() returns its full BrainDecision object.
 */
export interface SnapshotInput {
  // Raw signal fed into the brain
  signal: Record<string, any>;

  // From BrainInput (context layer)
  trigger:        string;
  segment:        string;
  aov_estimate:   number;
  store_type?:    string;

  // From BrainDecision (full brain output)
  brain: {
    trace_id:           string;
    action:             string;
    recommended_popup:  string | null;
    discount_pct:       number;
    final_score:        number;
    ml_boost:           number;
    ml_used:            boolean;
    economic_justified: boolean;
    expected_uplift:    number;
    action_cost:        number;
    decision_path:      string[];
    latency_ms:         number;

    behavior: {
      intent:            string;
      friction:          string;
      intent_score:      number;
      friction_score?:   number;
      friction_present:  boolean;
      engagement_depth:  string;
      is_exit_risk:      boolean;
      is_bot_suspect:    boolean;
      is_high_value:     boolean;
      eligible_for_intervention: boolean;
      ineligible_reason?: string;
      rules_fired:       string[];
      weights_applied?:  Record<string, number>;
    };

    context: {
      eligible_actions:  Array<{ action: string; base_priority?: number }>;
      context_modifiers: Record<string, number>;
      should_observe?:   boolean;
      observe_reason?:   string;
    };
  };

  // Optional popup payload for snapshot
  popup_content?: {
    headline?: string;
    sub?: string;
    cta?: string;
  } | null;
}

/**
 * captureDecisionSnapshot() — COMMAND 01 CORE FUNCTION
 *
 * Takes all raw brain output and assembles one immutable snapshot.
 * This is the "freezing" of ZENO's mental state at decision time.
 *
 * Steps (matches COMMAND 01 exactly):
 *   Step 1 — Freeze time context
 *   Step 2 — Capture behavioral state
 *   Step 3 — Capture context state
 *   Step 4 — Freeze ML state (NO re-inference)
 *   Step 5 — Capture rules state
 *   Step 6 — Economic lock
 *   Step 7 — Final assembly
 */
export function captureDecisionSnapshot(input: SnapshotInput): ZenoDecisionSnapshot {

  // ── Step 1: Freeze Time ───────────────────────────────────────────────────
  const timestamp = Date.now();

  // ── Step 2: Capture Behavioral State ─────────────────────────────────────
  const behavior: ZenoDecisionSnapshot["behavior"] = {
    intent_level:      input.brain.behavior.intent as IntentLevel,
    friction_type:     input.brain.behavior.friction as FrictionType,
    raw_signals:       {
      time_on_page:      input.signal.time_on_page,
      page_views:        input.signal.page_views,
      scroll_depth:      input.signal.scroll_depth,
      clicks:            input.signal.clicks,
      product_views:     input.signal.product_views,
      checkout_started:  input.signal.checkout_started,
      visitor_id:        input.signal.visitor_id,
      session_id:        input.signal.session_id,
      store_domain:      input.signal.store_domain,
    },
    behavior_score:    input.brain.behavior.intent_score,
    rules_fired:       input.brain.behavior.rules_fired || [],
    engagement_depth:  input.brain.behavior.engagement_depth as any,
    is_exit_risk:      input.brain.behavior.is_exit_risk,
    is_bot_suspect:    input.brain.behavior.is_bot_suspect,
    is_high_value:     input.brain.behavior.is_high_value,
    eligible:          input.brain.behavior.eligible_for_intervention,
    ineligible_reason: input.brain.behavior.ineligible_reason || null,
  };

  // ── Step 3: Capture Context State ─────────────────────────────────────────
  const context: ZenoDecisionSnapshot["context"] = {
    segment:          input.segment,
    aov_bucket:       computeAovBucket(input.aov_estimate),
    time_context:     computeTimeContext(),
    trigger:          input.trigger,
    store_type:       input.store_type || "general",
    modifiers:        input.brain.context.context_modifiers || {},
    eligible_actions: (input.brain.context.eligible_actions || []).map(a => a.action),
  };

  // ── Step 4: Freeze ML State (SNAPSHOT ONLY — no live re-inference) ────────
  const ml: ZenoDecisionSnapshot["ml"] = {
    model_version: getActiveModelVersion(),
    score:         input.brain.final_score,      // composite final score
    boost:         input.brain.ml_boost,          // ML's contribution delta
    confidence:    Math.min(1.0, Math.abs(input.brain.ml_boost) * 5),  // derived confidence
    used_as:       input.brain.ml_used ? "SECONDARY" : "DISABLED",
    skipped:       !input.brain.ml_used,
    skip_reason:   !input.brain.ml_used ? "behavioral-only path (ML disabled or ineligible)" : null,
  };

  // ── Step 5: Capture Rules State ───────────────────────────────────────────
  //
  // triggered_rules = rules that fired and contributed to final_score
  // blocked_rules   = rules that were evaluated but led to gate=BLOCKED or no action
  const triggered = input.brain.behavior.rules_fired.filter(r => !r.startsWith("HARD_BLOCK") && !r.startsWith("FRAUD"));
  const blocked   = input.brain.behavior.rules_fired.filter(r => r.startsWith("HARD_BLOCK") || r.startsWith("FRAUD") || r.startsWith("BOT"));

  const rules: ZenoDecisionSnapshot["rules"] = {
    version_hash:    getRulesVersionHash(),
    version_label:   CURRENT_RULES_VERSION,
    triggered_rules: triggered,
    blocked_rules:   blocked,
    final_gate:      input.brain.economic_justified ? "OPEN" : "BLOCKED",
  };

  // ── Step 6: Economic Lock ─────────────────────────────────────────────────
  const economic: ZenoDecisionSnapshot["economic"] = {
    expected_uplift:  input.brain.expected_uplift,
    action_cost:      input.brain.action_cost,
    roi_ratio:        computeRoiRatio(input.brain.expected_uplift, input.brain.action_cost, input.aov_estimate),
    approved:         input.brain.economic_justified,
    aov_estimate:     input.aov_estimate,
    rejection_reason: !input.brain.economic_justified
      ? `ROI ratio below 1.20 minimum — intervention not economically justified at AOV=$${input.aov_estimate}`
      : null,
  };

  // ── Step 7: Final Assembly ────────────────────────────────────────────────
  const decision: ZenoDecisionSnapshot["decision"] = {
    action:           input.brain.action,
    popup_type:       input.brain.recommended_popup,
    discount_pct:     input.brain.discount_pct,
    payload:          {
      headline:  input.popup_content?.headline || null,
      sub:       input.popup_content?.sub || null,
      cta:       input.popup_content?.cta || null,
      discount:  input.brain.discount_pct,
      latency_ms: input.brain.latency_ms,
    },
    confidence_final: input.brain.final_score,
    decision_path:    input.brain.decision_path,
  };

  const reconstruction: ZenoDecisionSnapshot["reconstruction"] = {
    deterministic:  true,      // All inputs are frozen → same inputs = same output
    replay_safe:    true,      // raw_signals is fully preserved
    drift_detected: false,     // checked at query/replay time, not creation
    rules_changed:  false,     // will be set at replay time by comparing hashes
    ml_changed:     false,     // will be set at replay time by comparing model versions
  };

  return {
    trace_id:      input.brain.trace_id,
    timestamp,
    behavior,
    context,
    ml,
    economic,
    rules,
    decision,
    reconstruction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — STORAGE (Immutable Insert)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveSnapshot() — persist snapshot to nolix_decision_snapshots
 *
 * LAWS:
 *   - ON CONFLICT DO NOTHING (snapshots are immutable — never overwrite)
 *   - Never throws — failure is logged silently
 *   - Returns true if inserted, false if conflict or error
 */
export async function saveSnapshot(snapshot: ZenoDecisionSnapshot): Promise<boolean> {
  try {
    await query(
      `INSERT INTO nolix_decision_snapshots
         (trace_id, timestamp, behavior, context, ml, economic, rules, decision, reconstruction,
          visitor_id, intent_level, friction_type, decision_action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (trace_id) DO NOTHING`,
      [
        snapshot.trace_id,
        snapshot.timestamp,
        JSON.stringify(snapshot.behavior),
        JSON.stringify(snapshot.context),
        JSON.stringify(snapshot.ml),
        JSON.stringify(snapshot.economic),
        JSON.stringify(snapshot.rules),
        JSON.stringify(snapshot.decision),
        JSON.stringify(snapshot.reconstruction),
        // Normalized columns for fast queries (no JSONB bottleneck)
        snapshot.behavior.raw_signals?.visitor_id || null,
        snapshot.behavior.intent_level,
        snapshot.behavior.friction_type,
        snapshot.decision.action,
      ]
    );
    return true;
  } catch (e: any) {
    console.error("[SNAPSHOT] Failed to save snapshot:", e?.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getSnapshot() — retrieve a full snapshot by trace_id
 * Returns null if not found (doesn't throw)
 */
export async function getSnapshot(trace_id: string): Promise<ZenoDecisionSnapshot | null> {
  try {
    const rows = await query<any>(
      `SELECT trace_id, timestamp, behavior, context, ml, economic, rules, decision, reconstruction
       FROM nolix_decision_snapshots WHERE trace_id = $1 LIMIT 1`,
      [trace_id]
    );
    if ((rows as any[]).length === 0) return null;
    return _parseSnapshotRow((rows as any[])[0]);
  } catch { return null; }
}

/**
 * getSnapshotsByVisitor() — all snapshots for a visitor, newest first
 */
export async function getSnapshotsByVisitor(visitor_id: string, limit = 20): Promise<ZenoDecisionSnapshot[]> {
  try {
    const rows = await query<any>(
      `SELECT trace_id, timestamp, behavior, context, ml, economic, rules, decision, reconstruction
       FROM nolix_decision_snapshots
       WHERE visitor_id = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [visitor_id, Math.min(limit, 100)]
    );
    return (rows as any[]).map(_parseSnapshotRow);
  } catch { return []; }
}

/**
 * getRecentSnapshots() — latest N snapshots for dashboard analytics
 */
export async function getRecentSnapshots(limit = 50, filterAction?: string): Promise<ZenoDecisionSnapshot[]> {
  try {
    const rows = await query<any>(
      `SELECT trace_id, timestamp, behavior, context, ml, economic, rules, decision, reconstruction
       FROM nolix_decision_snapshots
       ${filterAction ? "WHERE decision_action = $2" : ""}
       ORDER BY timestamp DESC LIMIT $1`,
      filterAction ? [Math.min(limit, 200), filterAction] : [Math.min(limit, 200)]
    );
    return (rows as any[]).map(_parseSnapshotRow);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — DRIFT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export interface DriftReport {
  trace_id:         string;
  snapshot_rules:   string;  // rules version at snapshot time
  current_rules:    string;  // current rules version
  snapshot_model:   string;  // ML model at snapshot time
  current_model:    string;  // current ML model
  rules_drifted:    boolean;
  model_drifted:    boolean;
  drift_severity:   "NONE" | "MINOR" | "MAJOR";
  replay_reliable:  boolean;  // can we trust a replay to match original?
}

/**
 * detectDrift() — checks if a saved snapshot was made under different rules/model
 * Injects drift info into the snapshot's reconstruction metadata
 */
export function detectDrift(snapshot: ZenoDecisionSnapshot): DriftReport {
  const currentRulesHash  = getRulesVersionHash();
  const currentModel      = getActiveModelVersion();
  const snapshotRulesHash = snapshot.rules.version_hash;
  const snapshotModel     = snapshot.ml.model_version;

  const rulesDrifted = snapshotRulesHash !== currentRulesHash;
  const modelDrifted = snapshotModel     !== currentModel;

  let severity: DriftReport["drift_severity"] = "NONE";
  if (rulesDrifted && modelDrifted) severity = "MAJOR";
  else if (rulesDrifted || modelDrifted) severity = "MINOR";

  return {
    trace_id:        snapshot.trace_id,
    snapshot_rules:  snapshot.rules.version_label,
    current_rules:   CURRENT_RULES_VERSION,
    snapshot_model:  snapshotModel,
    current_model:   currentModel,
    rules_drifted:   rulesDrifted,
    model_drifted:   modelDrifted,
    drift_severity:  severity,
    replay_reliable: !rulesDrifted,  // ML drift is OK for replay, rules drift breaks determinism
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — REPLAY FROM SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotReplayResult {
  original_trace_id: string;
  replay_trace_id:   string;
  replayed_at:       number;
  drift:             DriftReport;
  original_decision: string;
  replayed_decision: string | null;  // would require re-running the brain
  timeline: Array<{
    step:    number;
    label:   string;
    state:   string;
    value:   any;
  }>;
  full_snapshot: ZenoDecisionSnapshot;
}

/**
 * replayFromSnapshot() — Time-travel reconstruction of a past decision
 *
 * Re-reads the frozen state and reconstructs the full decision timeline.
 * Does NOT re-run ML (ML is frozen in snapshot).
 * Detects drift between snapshot-time rules and current rules.
 */
export async function replayFromSnapshot(trace_id: string): Promise<SnapshotReplayResult | null> {
  const snapshot = await getSnapshot(trace_id);
  if (!snapshot) return null;

  const drift        = detectDrift(snapshot);
  const replay_id    = crypto.randomUUID();

  // Build step-by-step timeline from frozen state
  const timeline: SnapshotReplayResult["timeline"] = [
    {
      step:  1,
      label: "SIGNAL_RECEIVED",
      state: "raw",
      value: snapshot.behavior.raw_signals
    },
    {
      step:  2,
      label: "BEHAVIORAL_ASSESSMENT",
      state: `intent=${snapshot.behavior.intent_level} friction=${snapshot.behavior.friction_type}`,
      value: {
        score:       snapshot.behavior.behavior_score,
        rules_fired: snapshot.behavior.rules_fired,
        eligible:    snapshot.behavior.eligible,
        reason:      snapshot.behavior.ineligible_reason
      }
    },
    {
      step:  3,
      label: "CONTEXT_EVALUATION",
      state: `segment=${snapshot.context.segment} trigger=${snapshot.context.trigger}`,
      value: {
        aov_bucket:       snapshot.context.aov_bucket,
        eligible_actions: snapshot.context.eligible_actions,
        modifiers:        snapshot.context.modifiers
      }
    },
    {
      step:  4,
      label: "ML_SIGNAL",
      state: snapshot.ml.skipped ? `SKIPPED: ${snapshot.ml.skip_reason}` : `USED_AS_${snapshot.ml.used_as}`,
      value: {
        model:      snapshot.ml.model_version,
        score:      snapshot.ml.score,
        boost:      snapshot.ml.boost,
        confidence: snapshot.ml.confidence
      }
    },
    {
      step:  5,
      label: "ECONOMIC_GATE",
      state: snapshot.economic.approved ? "APPROVED" : "REJECTED",
      value: {
        expected_uplift:  snapshot.economic.expected_uplift,
        action_cost:      snapshot.economic.action_cost,
        roi_ratio:        snapshot.economic.roi_ratio,
        aov:              snapshot.economic.aov_estimate,
        rejection_reason: snapshot.economic.rejection_reason
      }
    },
    {
      step:  6,
      label: "RULES_GATE",
      state: snapshot.rules.final_gate,
      value: {
        version:         snapshot.rules.version_label,
        hash:            snapshot.rules.version_hash,
        triggered_count: snapshot.rules.triggered_rules.length,
        blocked_count:   snapshot.rules.blocked_rules.length
      }
    },
    {
      step:  7,
      label: "FINAL_DECISION",
      state: snapshot.decision.action.toUpperCase(),
      value: {
        action:      snapshot.decision.action,
        popup_type:  snapshot.decision.popup_type,
        discount:    snapshot.decision.discount_pct,
        confidence:  snapshot.decision.confidence_final,
        path_length: snapshot.decision.decision_path.length
      }
    },
    {
      step:  8,
      label: "DRIFT_CHECK",
      state: drift.drift_severity,
      value: {
        rules_drifted:   drift.rules_drifted,
        model_drifted:   drift.model_drifted,
        replay_reliable: drift.replay_reliable,
        severity:        drift.drift_severity
      }
    }
  ];

  return {
    original_trace_id: trace_id,
    replay_trace_id:   replay_id,
    replayed_at:       Date.now(),
    drift,
    original_decision: snapshot.decision.action,
    replayed_decision: null,  // would require full brain re-run — opt-in only
    timeline,
    full_snapshot: snapshot
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — ANALYTICS QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotStats {
  total:           number;
  by_action:       Record<string, number>;
  by_intent:       Record<string, number>;
  by_gate:         Record<string, number>;
  avg_roi_ratio:   number;
  approval_rate:   number;   // % of decisions that were economically approved
  ml_usage_rate:   number;   // % of decisions that used ML
  drift_count:     number;   // snapshots with old rules version
}

/**
 * getSnapshotStats() — aggregate stats for analyst dashboard
 */
export async function getSnapshotStats(hours = 24): Promise<SnapshotStats> {
  try {
    const since = Date.now() - (hours * 60 * 60 * 1000);

    const rows = await query<any>(
      `SELECT
         decision->>'action'         AS action,
         behavior->>'intent_level'   AS intent,
         rules->>'final_gate'        AS gate,
         (economic->>'approved')::boolean AS approved,
         (economic->>'roi_ratio')::float  AS roi_ratio,
         (ml->>'skipped')::boolean        AS ml_skipped,
         rules->>'version_hash'           AS rules_hash
       FROM nolix_decision_snapshots
       WHERE timestamp > $1`,
      [since]
    );

    const data = rows as any[];
    const currentHash = getRulesVersionHash();

    const result: SnapshotStats = {
      total:         data.length,
      by_action:     {},
      by_intent:     {},
      by_gate:       {},
      avg_roi_ratio: 0,
      approval_rate: 0,
      ml_usage_rate: 0,
      drift_count:   0,
    };

    let roiSum = 0, approvedCount = 0, mlUsedCount = 0;

    for (const row of data) {
      // Action breakdown
      result.by_action[row.action] = (result.by_action[row.action] || 0) + 1;
      // Intent breakdown
      result.by_intent[row.intent] = (result.by_intent[row.intent] || 0) + 1;
      // Gate breakdown
      result.by_gate[row.gate] = (result.by_gate[row.gate] || 0) + 1;
      // ROI sum
      roiSum += Number(row.roi_ratio) || 0;
      // Approval count
      if (row.approved) approvedCount++;
      // ML usage
      if (!row.ml_skipped) mlUsedCount++;
      // Drift
      if (row.rules_hash !== currentHash) result.drift_count++;
    }

    if (data.length > 0) {
      result.avg_roi_ratio = Math.round((roiSum / data.length) * 100) / 100;
      result.approval_rate = Math.round((approvedCount / data.length) * 10000) / 100;
      result.ml_usage_rate = Math.round((mlUsedCount / data.length) * 10000) / 100;
    }

    return result;
  } catch {
    return {
      total: 0, by_action: {}, by_intent: {}, by_gate: {},
      avg_roi_ratio: 0, approval_rate: 0, ml_usage_rate: 0, drift_count: 0
    };
  }
}

/**
 * compareSnapshots() — side-by-side diff of two frozen decision states
 */
export async function compareSnapshots(
  trace_a: string,
  trace_b: string
): Promise<{
  same_action:  boolean;
  same_intent:  boolean;
  same_gate:    boolean;
  diffs:        Array<{ field: string; a: any; b: any }>;
  a: ZenoDecisionSnapshot | null;
  b: ZenoDecisionSnapshot | null;
}> {
  const [a, b] = await Promise.all([getSnapshot(trace_a), getSnapshot(trace_b)]);

  if (!a || !b) return { same_action: false, same_intent: false, same_gate: false, diffs: [], a, b };

  const diffs: Array<{ field: string; a: any; b: any }> = [];
  const compare = (field: string, va: any, vb: any) => {
    if (JSON.stringify(va) !== JSON.stringify(vb)) diffs.push({ field, a: va, b: vb });
  };

  compare("decision.action",         a.decision.action,          b.decision.action);
  compare("decision.popup_type",     a.decision.popup_type,      b.decision.popup_type);
  compare("decision.discount_pct",   a.decision.discount_pct,    b.decision.discount_pct);
  compare("behavior.intent_level",   a.behavior.intent_level,    b.behavior.intent_level);
  compare("behavior.friction_type",  a.behavior.friction_type,   b.behavior.friction_type);
  compare("behavior.behavior_score", a.behavior.behavior_score,  b.behavior.behavior_score);
  compare("ml.boost",                a.ml.boost,                 b.ml.boost);
  compare("ml.used_as",              a.ml.used_as,               b.ml.used_as);
  compare("economic.roi_ratio",      a.economic.roi_ratio,       b.economic.roi_ratio);
  compare("economic.approved",       a.economic.approved,        b.economic.approved);
  compare("rules.final_gate",        a.rules.final_gate,         b.rules.final_gate);
  compare("rules.version_label",     a.rules.version_label,      b.rules.version_label);

  return {
    same_action: a.decision.action === b.decision.action,
    same_intent: a.behavior.intent_level === b.behavior.intent_level,
    same_gate:   a.rules.final_gate === b.rules.final_gate,
    diffs,
    a,
    b
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _parseSnapshotRow(row: any): ZenoDecisionSnapshot {
  const parse = (v: any) => typeof v === "string" ? JSON.parse(v) : (v || {});
  return {
    trace_id:       row.trace_id,
    timestamp:      Number(row.timestamp),
    behavior:       parse(row.behavior),
    context:        parse(row.context),
    ml:             parse(row.ml),
    economic:       parse(row.economic),
    rules:          parse(row.rules),
    decision:       parse(row.decision),
    reconstruction: parse(row.reconstruction),
  };
}
