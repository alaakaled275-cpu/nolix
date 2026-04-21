/**
 * NOLIX — ZENO Command Engine (Pre-Step 16 PARTS 3,5,6,7,8)
 * lib/nolix-zeno-commands.ts
 *
 * ZENO = AI Analyst Layer (READ-ONLY, NO ML compute, NO DB writes except logs)
 *
 * Rules:
 *   1. ZENO does NOT predict — uses /api/engine/predict
 *   2. ZENO does NOT write to DB — logs only
 *   3. ZENO does NOT change runtime flags
 *   4. ZENO = Classify + Score + Decide + Explain + Label-update
 *
 * PART 5 — Fail-Safe: every command checks flags FIRST
 * PART 6 — Command Contract: validates payload schema
 * PART 7 — Rejects unknown fields strictly
 * PART 8 — All responses include version field
 */

import { query }                       from "./db";
import { normalizeSignal }             from "./nolix-signal-normalizer";
import { validateSignal, validateCommandPayload } from "./nolix-signal-validator";
import { signalToFeatureVector }       from "./nolix-signal-normalizer";
import { logDecision, generateTraceId } from "./nolix-decision-trace";
import { getRuntimeFlag }              from "./nolix-runtime";
import { hybridPredict }               from "./nolix-hybrid-engine";
import { findSimilarUsers }            from "./nolix-vector-engine";
import { segmentVisitor }              from "./nolix-segmentation";
import { NolixSignalV1, CommandResult, SIGNAL_SCHEMA_VERSION } from "./nolix-signal-schema";

// ── COMMAND VERSION (PART 8) ──────────────────────────────────────────────────
const CMD_VERSION = "v1" as const;

// ── FAIL-SAFE CHECK (PART 5) ──────────────────────────────────────────────────
async function checkSystemAlive(): Promise<{ alive: boolean; reason?: string }> {
  try {
    const aiEnabled = await getRuntimeFlag("ai_enabled");
    if (!aiEnabled) return { alive: false, reason: "AI_DISABLED" };
    return { alive: true };
  } catch { return { alive: true }; } // fail-open
}

// ── Versioned response envelope (PART 8) ──────────────────────────────────────
function envelope<T>(cmd: string, result: T, traceId: string, latencyMs: number, ok = true, error?: string): CommandResult<T> {
  return {
    version:    SIGNAL_SCHEMA_VERSION,
    command:    cmd,
    ok,
    result,
    error,
    latency_ms: latencyMs,
    trace_id:   traceId
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMD_01_CLASSIFY_VISITOR — classify behavioral intent level
// ═══════════════════════════════════════════════════════════════════════════════
export type VisitorClass = "high_intent" | "medium_intent" | "low_intent" | "bot_suspect";

export async function cmd01ClassifyVisitor(raw: Record<string, any>): Promise<CommandResult<{
  class:        VisitorClass;
  signals:      Record<string, any>;
  score:        number;
  segment?:     string;
}>> {
  const traceId = generateTraceId();
  const start   = Date.now();
  const CMD     = "CMD_01_CLASSIFY_VISITOR";

  // PART 5: Fail-safe
  const system = await checkSystemAlive();
  if (!system.alive) {
    return envelope(CMD, { class: "low_intent" as VisitorClass, signals: {}, score: 0 }, traceId, 0, false, system.reason);
  }

  // PART 6: Command contract
  const contractCheck = validateCommandPayload(CMD, raw);
  if (!contractCheck.valid) {
    const err = contractCheck.errors.map(e => e.message).join("; ");
    return envelope(CMD, { class: "low_intent" as VisitorClass, signals: {}, score: 0 }, traceId, 0, false, err);
  }

  const signal    = normalizeSignal(raw);
  const validation = validateSignal(signal);

  if (!validation.valid) {
    const err = validation.errors.map(e => e.message).join("; ");
    return envelope(CMD, { class: "low_intent" as VisitorClass, signals: signal as any, score: 0 }, traceId, 0, false, err);
  }

  // Compute intent score directly from behavioral signals
  const checkoutBonus    = signal.checkout_started ? 0.35 : 0;
  const timeScore        = Math.min(0.25, signal.time_on_page / 120 * 0.25);
  const pageScore        = Math.min(0.20, signal.page_views / 10 * 0.20);
  const scrollScore      = signal.scroll_depth * 0.10;
  const productScore     = Math.min(0.10, signal.product_views / 5 * 0.10);
  const baseScore        = checkoutBonus + timeScore + pageScore + scrollScore + productScore;

  // Bot signals
  const botSignal = signal.time_on_page < 1 && signal.page_views > 3 ? -0.30 : 0;
  const score     = Math.max(0, Math.min(1, baseScore + botSignal));

  // Get segment (async, non-blocking)
  let segmentLabel = "unknown";
  try {
    const vectorFeatures = signalToFeatureVector(signal);
    const seg = await segmentVisitor(signal.visitor_id, vectorFeatures);
    segmentLabel = seg.segment;
  } catch {}

  const visitorClass: VisitorClass =
    botSignal < 0          ? "bot_suspect"   :
    score >= 0.70          ? "high_intent"   :
    score >= 0.35          ? "medium_intent" : "low_intent";

  const reasoning = `class=${visitorClass}: checkout=${signal.checkout_started}, time=${signal.time_on_page}s, pages=${signal.page_views}, scroll=${signal.scroll_depth}, score=${score.toFixed(3)}`;

  await logDecision({ trace_id: traceId, visitor_id: signal.visitor_id, command: CMD, input: signal as any, output: { class: visitorClass, score, segment: segmentLabel }, reasoning, latency_ms: Date.now() - start });

  return envelope(CMD, { class: visitorClass, signals: { time: signal.time_on_page, pages: signal.page_views, scroll: signal.scroll_depth, checkout: signal.checkout_started }, score: Math.round(score * 10000) / 10000, segment: segmentLabel }, traceId, Date.now() - start);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMD_02_SCORE_INTENT — ZENO ↔ ML Integration (PART 3)
// intent_score = base_score * 0.4 + ml.p_convert * 100 * 0.4 + similarity * 100 * 0.2
// ═══════════════════════════════════════════════════════════════════════════════
export async function cmd02ScoreIntent(raw: Record<string, any>): Promise<CommandResult<{
  intent_score:     number;   // 0-100
  base_score:       number;
  ml_score:         number;
  similarity_score: number;
  components:       Record<string, number>;
  recommended_action: string;
}>> {
  const traceId = generateTraceId();
  const start   = Date.now();
  const CMD     = "CMD_02_SCORE_INTENT";

  // PART 5
  const system = await checkSystemAlive();
  if (!system.alive) {
    return envelope(CMD, { intent_score: 0, base_score: 0, ml_score: 0, similarity_score: 0, components: {}, recommended_action: "do_nothing" }, traceId, 0, false, system.reason);
  }

  // PART 6
  const contractCheck = validateCommandPayload(CMD, raw);
  if (!contractCheck.valid) {
    return envelope(CMD, { intent_score: 0, base_score: 0, ml_score: 0, similarity_score: 0, components: {}, recommended_action: "do_nothing" }, traceId, 0, false, contractCheck.errors.map(e => e.message).join("; "));
  }

  const signal   = normalizeSignal(raw);
  const features = signalToFeatureVector(signal);

  // ── PART 3: ZENO ↔ ML INTEGRATION ────────────────────────────────────────
  // Base score from behavioral signals (ZENO domain)
  const checkoutBonus = signal.checkout_started ? 0.35 : 0;
  const baseScore = Math.min(1, checkoutBonus + Math.min(0.20, signal.time_on_page / 120 * 0.20) + Math.min(0.15, signal.page_views / 10 * 0.15) + signal.scroll_depth * 0.10 + Math.min(0.10, signal.product_views / 5 * 0.10));

  // ML prediction (model server)
  let mlPConvert = 0.35;
  try {
    const featureMap = {
      time_on_site:    signal.time_on_page,
      pages_viewed:    signal.page_views,
      scroll_depth:    signal.scroll_depth * 100,
      cart_status:     signal.checkout_started ? "checkout" : "viewing",
      hesitations:     raw.coupon_abuse_severity || 0,
      return_visitor:  raw.return_visitor || false,
      exit_intent:     false,
      cta_hover_count: signal.clicks
    };
    const mlResult   = await hybridPredict(featureMap, { visitor_id: signal.visitor_id, store: signal.store_domain });
    mlPConvert       = mlResult.final_score;
  } catch { /* fallback to base */ }

  // Cross-user similarity
  let similarityScore = 0;
  try {
    const sim = await findSimilarUsers(features, signal.store_domain, 10, 0.65);
    similarityScore = sim.boost || 0;
  } catch {}

  // ── COMPOSITE FORMULA (PART 3) ─────────────────────────────────────────────
  // intent_score = base_score * 0.4 + ml.p_convert * 100 * 0.4 + similarity * 100 * 0.2
  const intentScore = Math.min(100, Math.round((
    baseScore          * 100 * 0.40 +
    mlPConvert         * 100 * 0.40 +
    similarityScore    * 100 * 0.20
  ) * 100) / 100);

  const recommendedAction =
    intentScore >= 70 ? "high_discount" :
    intentScore >= 50 ? "free_shipping" :
    intentScore >= 35 ? "urgency"       :
    intentScore >= 20 ? "popup_info"    : "do_nothing";

  const components = {
    base_component:       Math.round(baseScore       * 100 * 0.40),
    ml_component:         Math.round(mlPConvert      * 100 * 0.40),
    similarity_component: Math.round(similarityScore * 100 * 0.20)
  };

  const reasoning = `intent_score=${intentScore}: base=${(baseScore*100).toFixed(0)} ml=${(mlPConvert*100).toFixed(0)} sim=${(similarityScore*100).toFixed(0)} → action=${recommendedAction}`;

  await logDecision({ trace_id: traceId, visitor_id: signal.visitor_id, command: CMD, input: signal as any, output: { intent_score: intentScore, ml_score: mlPConvert, recommended_action: recommendedAction }, reasoning, latency_ms: Date.now() - start });

  return envelope(CMD, {
    intent_score:       intentScore,
    base_score:         Math.round(baseScore * 100) / 100,
    ml_score:           Math.round(mlPConvert * 10000) / 10000,
    similarity_score:   Math.round(similarityScore * 10000) / 10000,
    components,
    recommended_action: recommendedAction
  }, traceId, Date.now() - start);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMD_03_DECIDE_ACTION — final go/no-go decision with full reasoning
// ═══════════════════════════════════════════════════════════════════════════════
export async function cmd03DecideAction(raw: Record<string, any>): Promise<CommandResult<{
  action:          "show_popup" | "block" | "observe";
  discount_pct:    number;
  reasoning:       string;
  intent_score:    number;
  block_reason?:   string;
}>> {
  const traceId = generateTraceId();
  const start   = Date.now();
  const CMD     = "CMD_03_DECIDE_ACTION";

  const system = await checkSystemAlive();
  if (!system.alive) {
    return envelope(CMD, { action: "observe", discount_pct: 0, reasoning: system.reason || "AI_DISABLED", intent_score: 0 }, traceId, 0, false, system.reason);
  }

  const contractCheck = validateCommandPayload(CMD, raw);
  if (!contractCheck.valid) {
    return envelope(CMD, { action: "observe", discount_pct: 0, reasoning: "invalid_payload", intent_score: 0 }, traceId, 0, false, contractCheck.errors.map(e => e.message).join("; "));
  }

  // Get intent score from CMD_02
  const scoreResult = await cmd02ScoreIntent(raw);
  const intentScore = scoreResult.result.intent_score;
  const abuseLevel  = Number(raw.coupon_abuse_severity || 0);

  let action:  "show_popup" | "block" | "observe" = "observe";
  let discount = 0;
  let blockReason: string | undefined;

  if (abuseLevel >= 3) {
    action      = "block";
    blockReason = `fraud_block: abuse_severity=${abuseLevel}`;
  } else if (intentScore >= 65) {
    action   = "show_popup";
    discount = intentScore >= 80 ? 15 : intentScore >= 70 ? 10 : 5;
  } else {
    action = "observe";
  }

  const reasoning = `CMD_03: intent=${intentScore} abuse=${abuseLevel} → ${action} discount=${discount}%`;
  await logDecision({ trace_id: traceId, visitor_id: raw.visitor_id, command: CMD, input: raw, output: { action, discount_pct: discount, intent_score: intentScore }, reasoning, latency_ms: Date.now() - start });

  return envelope(CMD, { action, discount_pct: discount, reasoning, intent_score: intentScore, block_reason: blockReason }, traceId, Date.now() - start);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMD_04_EXPLAIN_DECISION — replay + explain any past decision
// ═══════════════════════════════════════════════════════════════════════════════
export async function cmd04ExplainDecision(raw: Record<string, any>): Promise<CommandResult<{
  trace_id:   string;
  command:    string;
  reasoning:  string;
  input:      any;
  output:     any;
  created_at: any;
}>> {
  const traceId = generateTraceId();
  const start   = Date.now();
  const CMD     = "CMD_04_EXPLAIN_DECISION";

  const system = await checkSystemAlive();
  if (!system.alive) return envelope(CMD, {} as any, traceId, 0, false, system.reason);

  const { getDecisionByTraceId } = await import("./nolix-decision-trace");
  const targetTraceId = raw.trace_id || raw.decision_id;
  if (!targetTraceId) return envelope(CMD, {} as any, traceId, 0, false, "trace_id required");

  const log = await getDecisionByTraceId(targetTraceId);
  if (!log) return envelope(CMD, {} as any, traceId, 0, false, `TRACE_NOT_FOUND: ${targetTraceId}`);

  return envelope(CMD, {
    trace_id:   log.trace_id,
    command:    log.command,
    reasoning:  log.reasoning,
    input:      log.input,
    output:     log.output,
    created_at: log.created_at
  }, traceId, Date.now() - start);
}
