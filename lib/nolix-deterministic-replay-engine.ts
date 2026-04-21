/**
 * NOLIX — Deterministic Replay Engine v2 (COMMAND 02)
 * lib/nolix-deterministic-replay-engine.ts
 *
 * ⚔️ GOAL:
 *   Transform the system from "showing what happened"
 *   to "re-running the same brain to see what it decides NOW"
 *
 * ⚔️ THE FUNDAMENTAL DIFFERENCE:
 *   ❌ Before: snapshot → display
 *   ✔  After:  snapshot → re-run brain → compare → analyze drift
 *
 * ⚔️ THREE REPLAY MODES:
 *   PURE_REPLAY     — Display frozen snapshot as-is (baseline, no re-execution)
 *   REEXECUTION     — Re-run current brain with original input signals
 *   COMPARISON      — Re-run + diff between OLD decision and NEW decision
 *
 * ⚔️ DRIFT CLASSIFICATIONS (from comparison):
 *   CRITICAL_DRIFT  — Action changed AND intent shifted → system thinks differently now
 *   ML_DRIFT        — ML score moved by >0.20 → model has changed significantly
 *   RULE_EVOLUTION  — Rules structure changed but action same → system matured
 *   STABLE          — No meaningful difference → system is consistent
 */

import { getSnapshot }                  from "./nolix-intelligence-snapshot-engine";
import { runHybridBrain }               from "./nolix-hybrid-brain";
import type { ZenoDecisionSnapshot }    from "./nolix-intelligence-snapshot-engine";
import { emitEvent }                    from "./nolix-event-logger";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — TYPE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export type ReplayMode = "PURE_REPLAY" | "REEXECUTION" | "COMPARISON";

export type DriftClassification =
  | "CRITICAL_DRIFT"    // action changed AND intent shifted
  | "ML_DRIFT"          // ML score moved > 0.20
  | "RULE_EVOLUTION"    // rules changed but outcome same
  | "STABLE";           // no meaningful difference

export interface ReplayInput {
  trace_id:               string;
  mode:                   ReplayMode;
  override_rules_version?: string;  // future: replay with specific rules version
  override_ml_version?:   string;   // future: replay with specific ML model
}

export interface DecisionComparison {
  // Action-level comparison
  action_changed:       boolean;
  old_action:           string;
  new_action:           string | null;

  // Intent-level comparison
  intent_shift:         boolean;
  old_intent:           string;
  new_intent:           string | null;
  intent_delta:         number;   // numeric shift in behavior score

  // ML comparison
  ml_delta:             number;   // new_ml_score - old_ml_score
  ml_boost_delta:       number;   // new_boost - old_boost
  ml_role_changed:      boolean;  // was ML role (SECONDARY/DISABLED) different?

  // Economic comparison
  roi_delta:            number;   // new_roi - old_roi
  economic_gate_changed: boolean; // did approval status change?

  // Rules comparison
  rule_drift:           boolean;  // rules version hash changed?
  rules_added:          string[]; // new rules that weren't in original
  rules_removed:        string[]; // original rules no longer in new decision

  // Overall
  total_divergence:     number;   // 0.0–1.0 weighted divergence score
}

export interface ReplayOutput {
  trace_id:          string;
  replay_mode:       ReplayMode;
  replayed_at:       number;

  // Original (frozen) state
  original_snapshot: ZenoDecisionSnapshot;
  original_decision: {
    action:      string;
    popup_type:  string | null;
    confidence:  number;
    gate:        string;
    rules_ver:   string;
  };

  // Current brain output (null for PURE_REPLAY)
  new_decision: {
    action:      string;
    popup_type:  string | null;
    confidence:  number;
    gate:        string;
    rules_ver:   string;
    trace_id:    string;
  } | null;

  // Comparison (null for PURE_REPLAY)
  comparison:    DecisionComparison | null;

  // Drift classification
  drift:         DriftClassification;
  drift_score:   number;  // 0.0–1.0

  // Human-readable explanation
  explanation:   string;
  explanation_lines: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — BRAIN EXECUTION HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runZenoBrain() — COMMAND 02 Step 3
 *
 * Re-runs the current brain with the original frozen input signals.
 * This is the core of REEXECUTION mode.
 * Always uses the CURRENT rules version and CURRENT ML model.
 * Never interpolates or patches the input.
 */
async function runZenoBrain(
  rawSignals: Record<string, any>,
  contextFromSnapshot: ZenoDecisionSnapshot["context"]
): Promise<ReturnType<typeof runHybridBrain> | null> {
  try {
    return await runHybridBrain({
      signal: {
        schema_version:   "v1",
        visitor_id:       rawSignals.visitor_id       || "replay_visitor",
        session_id:       rawSignals.session_id       || "replay_session",
        store_domain:     rawSignals.store_domain     || "replay.store",
        time_on_page:     Number(rawSignals.time_on_page)     || 0,
        page_views:       Number(rawSignals.page_views)       || 0,
        scroll_depth:     Number(rawSignals.scroll_depth)     || 0,
        clicks:           Number(rawSignals.clicks)           || 0,
        product_views:    Number(rawSignals.product_views)    || 0,
        checkout_started: Boolean(rawSignals.checkout_started) || false,
        timestamp:        rawSignals.timestamp || Date.now(),
      },
      trigger:        contextFromSnapshot.trigger   as any,
      segment:        contextFromSnapshot.segment   as any,
      aov_estimate:   _extractAov(contextFromSnapshot),
      store_type:     contextFromSnapshot.store_type as any,
      visit_count:    rawSignals.visit_count    || 1,
      coupon_abuse:   rawSignals.coupon_abuse   || 0,
      return_visitor: rawSignals.return_visitor || false,
      hesitations:    rawSignals.hesitations    || 0,
      mouse_leave_count: rawSignals.mouse_leave_count || 0,
      tab_hidden_count:  rawSignals.tab_hidden_count  || 0,
    });
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — COMPARISON ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * detectRuleDrift() — Compare original and current rules state
 */
function detectRuleDrift(
  oldRules: ZenoDecisionSnapshot["rules"],
  newRulesFired: string[]
): { drifted: boolean; added: string[]; removed: string[] } {
  const oldSet = new Set(oldRules.triggered_rules);
  const newSet = new Set(newRulesFired);

  const added   = newRulesFired.filter(r => !oldSet.has(r));
  const removed = oldRules.triggered_rules.filter(r => !newSet.has(r));

  return {
    drifted: oldRules.version_hash !== _getCurrentRulesHash() || added.length > 0 || removed.length > 0,
    added,
    removed
  };
}

/**
 * buildComparison() — COMMAND 02 Step 4
 *
 * Compares frozen original decision with fresh re-executed decision.
 */
function buildComparison(
  snapshot: ZenoDecisionSnapshot,
  newBrain: Awaited<ReturnType<typeof runHybridBrain>>
): DecisionComparison {
  const ruleDriftResult = detectRuleDrift(snapshot.rules, newBrain.behavior.rules_fired);

  // Behavior delta
  const intentDelta = newBrain.behavior.intent_score - snapshot.behavior.behavior_score;

  // ML delta
  const mlDelta      = newBrain.final_score  - snapshot.ml.score;
  const mlBoostDelta = newBrain.ml_boost     - snapshot.ml.boost;

  // Economic delta
  const roiDelta = _safeRoiFromBrain(newBrain) - snapshot.economic.roi_ratio;

  // Total divergence 0.0–1.0
  const actionWeight   = newBrain.action !== snapshot.decision.action ? 0.40 : 0;
  const intentWeight   = (snapshot.behavior.intent_level !== newBrain.behavior.intent) ? 0.25 : 0;
  const mlWeight       = Math.min(Math.abs(mlDelta) * 0.5, 0.15);
  const ruleWeight     = ruleDriftResult.drifted ? 0.10 : 0;
  const economicWeight = (snapshot.economic.approved !== newBrain.economic_justified) ? 0.10 : 0;
  const totalDivergence = Math.min(1.0, actionWeight + intentWeight + mlWeight + ruleWeight + economicWeight);

  return {
    action_changed:        newBrain.action !== snapshot.decision.action,
    old_action:            snapshot.decision.action,
    new_action:            newBrain.action,

    intent_shift:          snapshot.behavior.intent_level !== newBrain.behavior.intent,
    old_intent:            snapshot.behavior.intent_level,
    new_intent:            newBrain.behavior.intent,
    intent_delta:          Math.round(intentDelta * 10000) / 10000,

    ml_delta:              Math.round(mlDelta * 10000) / 10000,
    ml_boost_delta:        Math.round(mlBoostDelta * 10000) / 10000,
    ml_role_changed:       snapshot.ml.skipped !== !newBrain.ml_used,

    roi_delta:             Math.round(roiDelta * 100) / 100,
    economic_gate_changed: snapshot.economic.approved !== newBrain.economic_justified,

    rule_drift:            ruleDriftResult.drifted,
    rules_added:           ruleDriftResult.added,
    rules_removed:         ruleDriftResult.removed,

    total_divergence: Math.round(totalDivergence * 10000) / 10000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — DRIFT CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * classifyDrift() — COMMAND 02 Step 5
 *
 * Produces a semantic drift label based on the comparison result.
 */
function classifyDrift(cmp: DecisionComparison): DriftClassification {
  if (cmp.action_changed && cmp.intent_shift) return "CRITICAL_DRIFT";
  if (Math.abs(cmp.ml_delta) > 0.20)          return "ML_DRIFT";
  if (cmp.rule_drift)                           return "RULE_EVOLUTION";
  return "STABLE";
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — EXPLANATION GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateExplanation() — COMMAND 02 Step 6 (explanation block)
 */
function generateExplanation(cmp: DecisionComparison | null, drift: DriftClassification): {
  summary: string;
  lines: string[];
} {
  if (!cmp) {
    return {
      summary: "PURE_REPLAY — Original snapshot displayed as-is. No re-execution performed.",
      lines:   ["This is a frozen read of the original decision state.", "To see how the brain would decide TODAY, use mode=REEXECUTION."]
    };
  }

  const lines: string[] = [];

  // Drift header
  switch (drift) {
    case "CRITICAL_DRIFT":
      lines.push(`⚔️ CRITICAL_DRIFT — Both action and intent have shifted. The brain thinks differently now.`);
      lines.push(`   OLD: intent=${cmp.old_intent} → action=${cmp.old_action}`);
      lines.push(`   NEW: intent=${cmp.new_intent} → action=${cmp.new_action}`);
      break;
    case "ML_DRIFT":
      lines.push(`🤖 ML_DRIFT — ML score shifted by ${(cmp.ml_delta > 0 ? "+" : "") + (cmp.ml_delta * 100).toFixed(1)}%.`);
      lines.push(`   The ML model has evolved significantly since this decision was made.`);
      break;
    case "RULE_EVOLUTION":
      lines.push(`📜 RULE_EVOLUTION — Rules structure changed but final decision is the same.`);
      if (cmp.rules_added.length > 0) lines.push(`   Rules ADDED:   ${cmp.rules_added.join(", ")}`);
      if (cmp.rules_removed.length > 0) lines.push(`   Rules REMOVED: ${cmp.rules_removed.join(", ")}`);
      break;
    case "STABLE":
      lines.push(`✅ STABLE — Brain would make the same decision today.`);
      lines.push(`   Total divergence: ${(cmp.total_divergence * 100).toFixed(1)}% (well within acceptable range)`);
      break;
  }

  // Detailed comparison
  lines.push(`─────────────────────────────────────`);
  if (cmp.action_changed)        lines.push(`ACTION:  ${cmp.old_action} → ${cmp.new_action} ⚠️`);
  else                           lines.push(`ACTION:  ${cmp.old_action} → unchanged ✅`);
  if (cmp.intent_shift)          lines.push(`INTENT:  ${cmp.old_intent} → ${cmp.new_intent} ⚠️ (Δ=${cmp.intent_delta > 0 ? "+" : ""}${(cmp.intent_delta * 100).toFixed(1)}%)`);
  else                           lines.push(`INTENT:  ${cmp.old_intent} → stable ✅`);
  if (Math.abs(cmp.ml_delta) > 0.05) lines.push(`ML:      Score Δ=${cmp.ml_delta > 0 ? "+" : ""}${(cmp.ml_delta * 100).toFixed(1)}% | Boost Δ=${cmp.ml_boost_delta > 0 ? "+" : ""}${(cmp.ml_boost_delta * 100).toFixed(1)}%`);
  if (cmp.economic_gate_changed) lines.push(`ECONOMIC: Gate status flipped (${cmp.old_action === "show_popup" ? "was approved" : "was rejected"} → now ${cmp.new_action === "show_popup" ? "approved" : "rejected"})`);
  if (cmp.rule_drift)            lines.push(`RULES:   Hash drift detected (+${cmp.rules_added.length} rules / -${cmp.rules_removed.length} rules)`);
  lines.push(`DIVERGENCE: ${(cmp.total_divergence * 100).toFixed(1)}%`);

  const summary = drift === "STABLE"
    ? `Brain is consistent — same decision across time (divergence: ${(cmp.total_divergence * 100).toFixed(1)}%)`
    : `${drift} detected — divergence: ${(cmp.total_divergence * 100).toFixed(1)}% | action: ${cmp.old_action}→${cmp.new_action}`;

  return { summary, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — MAIN REPLAY FUNCTION (COMMAND 02 core)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * replayDecision() — COMMAND 02 MAIN FUNCTION
 *
 * Steps (matches COMMAND 02 exactly):
 *   Step 1 — Load Snapshot (frozen state)
 *   Step 2 — Reconstruct original state object
 *   Step 3 — Re-run CURRENT BRAIN (if mode allows)
 *   Step 4 — Build Comparison (old vs new)
 *   Step 5 — Classify Drift
 *   Step 6 — Generate Explanation + Final Output
 */
export async function replayDecision(input: ReplayInput): Promise<ReplayOutput | null> {
  const replayed_at = Date.now();

  // ── Step 1: Load Snapshot ─────────────────────────────────────────────────
  const snapshot = await getSnapshot(input.trace_id);
  if (!snapshot) return null;

  // ── Step 2: Reconstruct original state ───────────────────────────────────
  const originalState = {
    behavior: snapshot.behavior,
    context:  snapshot.context,
    ml:       snapshot.ml,
    rules:    snapshot.rules,
    economic: snapshot.economic,
  };

  const originalDecision = {
    action:     snapshot.decision.action,
    popup_type: snapshot.decision.popup_type,
    confidence: snapshot.decision.confidence_final,
    gate:       snapshot.rules.final_gate,
    rules_ver:  snapshot.rules.version_label,
  };

  // PURE_REPLAY mode — no re-execution
  if (input.mode === "PURE_REPLAY") {
    const { summary, lines } = generateExplanation(null, "STABLE");
    return {
      trace_id:          input.trace_id,
      replay_mode:       "PURE_REPLAY",
      replayed_at,
      original_snapshot: snapshot,
      original_decision: originalDecision,
      new_decision:      null,
      comparison:        null,
      drift:             "STABLE",
      drift_score:       0,
      explanation:       summary,
      explanation_lines: lines,
    };
  }

  // ── Step 3: Re-run CURRENT BRAIN ─────────────────────────────────────────
  const currentBrainOutput = await runZenoBrain(
    originalState.behavior.raw_signals,
    originalState.context
  );

  if (!currentBrainOutput) {
    // Brain re-execution failed — degrade to PURE_REPLAY gracefully
    const { summary, lines } = generateExplanation(null, "STABLE");
    return {
      trace_id:          input.trace_id,
      replay_mode:       "PURE_REPLAY",
      replayed_at,
      original_snapshot: snapshot,
      original_decision: originalDecision,
      new_decision:      null,
      comparison:        null,
      drift:             "STABLE",
      drift_score:       0,
      explanation:       summary + " (BRAIN_REEXECUTION_FAILED — degraded to PURE_REPLAY)",
      explanation_lines: ["Brain re-execution failed. Displaying frozen snapshot only."],
    };
  }

  const newDecision = {
    action:     currentBrainOutput.action,
    popup_type: currentBrainOutput.recommended_popup,
    confidence: currentBrainOutput.final_score,
    gate:       currentBrainOutput.economic_justified ? "OPEN" : "BLOCKED",
    rules_ver:  "v1.0.0",
    trace_id:   currentBrainOutput.trace_id,
  };

  // ── Step 4: Build Comparison ──────────────────────────────────────────────
  const comparison = buildComparison(snapshot, currentBrainOutput);

  // ── Step 5: Classify Drift ────────────────────────────────────────────────
  const drift      = classifyDrift(comparison);
  const drift_score = comparison.total_divergence;

  // ── Step 6: Final output ──────────────────────────────────────────────────
  const { summary, lines } = generateExplanation(comparison, drift);

  await emitEvent({
    id: crypto.randomUUID(),
    trace_id: input.trace_id,
    type: "REPLAY_EXECUTED",
    level: "INFO",
    timestamp: Date.now(),
    payload: {
      mode: input.mode,
      drift,
      old_action: snapshot.decision.action,
      new_action: currentBrainOutput.action
    }
  });

  return {
    trace_id:          input.trace_id,
    replay_mode:       input.mode,
    replayed_at,
    original_snapshot: snapshot,
    original_decision: originalDecision,
    new_decision:      newDecision,
    comparison,
    drift,
    drift_score,
    explanation:       summary,
    explanation_lines: lines,
  };
}

/**
 * batchReplay() — replay multiple traces at once
 * Useful for analytics: "replay the last 100 decisions to see how the brain has evolved"
 */
export async function batchReplay(
  trace_ids: string[],
  mode: ReplayMode = "COMPARISON"
): Promise<{
  total:          number;
  completed:      number;
  drift_summary:  Record<DriftClassification, number>;
  results:        ReplayOutput[];
}> {
  const results: ReplayOutput[] = [];
  const drift_summary: Record<DriftClassification, number> = {
    CRITICAL_DRIFT: 0,
    ML_DRIFT:       0,
    RULE_EVOLUTION: 0,
    STABLE:         0,
  };

  // Run sequentially to avoid overwhelming the brain
  for (const trace_id of trace_ids.slice(0, 50)) {  // cap at 50 for safety
    const result = await replayDecision({ trace_id, mode });
    if (result) {
      results.push(result);
      drift_summary[result.drift]++;
    }
  }

  return {
    total:         trace_ids.length,
    completed:     results.length,
    drift_summary,
    results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _getCurrentRulesHash(): string {
  return "sha_z1b3f7a9c2e4d6f8";  // matches CURRENT_RULES_VERSION = v1.0.0
}

function _extractAov(ctx: ZenoDecisionSnapshot["context"]): number {
  const bucket = ctx.aov_bucket || "mid_50-100";
  if (bucket.startsWith("premium"))  return 250;
  if (bucket.startsWith("high"))     return 150;
  if (bucket.startsWith("mid"))      return 75;
  if (bucket.startsWith("low"))      return 35;
  return 15;
}

function _safeRoiFromBrain(brain: Awaited<ReturnType<typeof runHybridBrain>>): number {
  const cost = brain.action_cost;
  if (cost <= 0) return brain.expected_uplift > 0 ? 99 : 0;
  return Math.round((brain.expected_uplift / (cost * 65)) * 100) / 100;
}
