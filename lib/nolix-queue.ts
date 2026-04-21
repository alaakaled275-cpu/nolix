/**
 * NOLIX — Queue & Isolation System v3 (STEP 10 → STEP 14)
 * lib/nolix-queue.ts
 *
 * RULES:
 * 1. API requests ONLY enqueue — ZERO direct training
 * 2. Training ONLY inside processQueue() worker
 * 3. eventWorker() orchestrates: dedup → circuit-check → features → truth → embedding → ML
 * 4. Worker runs every 2 seconds
 * 5. Batch training runs every 60 minutes
 * 6. Circuit breaker blocks all processing when OPEN
 * 7. Idempotency dedup prevents double-training
 */

import { query }            from "./db";
import { extractFeatures, featureStore, featureToArray } from "./nolix-feature-store";
import { trainOnline, trainBatch, saveModelToDB, loadModelFromDB, isLoaded } from "./nolix-ml-engine";
import { updateFeatureStats, loadFeatureStatsFromDB, saveFeatureStatsToDB } from "./nolix-feature-stats";
import { embeddingDB }      from "./nolix-embedding-db";
import { truthEngine, getTruthLabel } from "./nolix-truth-engine";
import { recordABSession }  from "./nolix-ab-engine";
import { flags, loadRuntimeFlags } from "./nolix-runtime";
import { saveToBacklog }    from "./nolix-training-backlog";
import { runEmbeddingPipeline } from "./nolix-vector-engine";
import { assertOnce }       from "./nolix-startup-assert";
import { recordOutcome, canPass, updateHealthScore, getCircuitStatus } from "./nolix-circuit-breaker";
import { checkAndMark, generateEventId } from "./nolix-idempotency";
import { logMetric }        from "./nolix-metrics";

let _statsLoaded   = false;
let _eventCounter  = 0;  // track events to save feature stats periodically

// ============================================================
// QUEUE TYPES
// ============================================================
interface QueuedEvent {
  type:        string;
  visitor_id?: string;
  session_id?: string;
  store?:      string;
  payload:     Record<string, unknown>;
  queued_at:   number;
  enriched?:   Record<string, unknown>;  // geo, ua_hash, session_bucket
}

interface TrainingEvent {
  type:       string;
  visitor_id: string;
  session_id?: string;
  store?:     string;
  embedding:  number[] | null;
  features:   number[] | null;
  label:      number;
  queued_at:  number;
  meta?:      Record<string, unknown>;
}

// In-memory queues (fast ingestion, async drain)
const _eventQueue:    QueuedEvent[]   = [];
const _trainingQueue: TrainingEvent[] = [];

// ============================================================
// ENQUEUE API (called from API routes — synchronous push only)
// ============================================================
export function enqueue(event: QueuedEvent): void {
  _eventQueue.push({ ...event, queued_at: Date.now() });
}

export function enqueueTraining(event: TrainingEvent): void {
  _trainingQueue.push({ ...event, queued_at: Date.now() });
  console.log("📥 TRAINING QUEUED:", { visitor_id: event.visitor_id, label: event.label, type: event.type });
}

// ============================================================
// LAYER 2 — EVENT WORKER (full orchestration pipeline)
// Called for each event drained from queue.
// Implements the full: featureStore → truth → embedding → training pipeline
// ============================================================
async function eventWorker(event: QueuedEvent): Promise<void> {
  const visitorId = event.visitor_id;
  const store     = event.store || "unknown";

  // -- STEP A: Persist raw event to DB
  await safeInsert(
    `INSERT INTO nolix_events
     (type, visitor_id, session_id, store, payload, queued_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [event.type, visitorId || null, event.session_id || null, store, JSON.stringify(event.payload), new Date(event.queued_at)]
  );

  if (!visitorId) return;

  // -- STEP B: Feature Store upsert + Welford Stats Update (PART 1 STEP 11.1)
  try {
    const features = extractFeatures({ ...event.payload, tracking: event.payload.tracking, visitor: event.payload.visitor });
    await featureStore.upsert(visitorId, store, features, event.session_id);

    // Feed raw feature vector to Welford algorithm to update global mean/std
    const featArr = featureToArray(features);
    if (featArr && featArr.length === 8) {
      updateFeatureStats(featArr);
    }
  } catch(e) { console.warn("⚠ QUEUE: featureStore.upsert failed:", e); }

  // -- STEP C: Embedding update (if tracking data available)
  try {
    const tracking = (event.payload.tracking || {}) as any;
    const visitor  = (event.payload.visitor  || {}) as any;

    if (tracking && visitor && visitorId) {
      const vec = generateEmbeddingVector(tracking, visitor);
      if (vec) { await embeddingDB.store(visitorId, store, vec, event.session_id); }
    }
  } catch(e) { console.warn("⚠ QUEUE: embeddingDB.store failed:", e); }

  // -- STEP D: Truth engine registration (for events with truth weight)
  const label = getTruthLabel(event.type);
  if (label > 0 || event.type === "popup_dismissed") {
    try {
      await truthEngine.register({
        visitor_id: visitorId,
        event_type: event.type,
        store,
        order_id:   (event.payload.order_id as string) || undefined,
        value:      (event.payload.total_price as string) || undefined,
        meta:       event.enriched || {}
      });
    } catch(e) { console.warn("⚠ QUEUE: truthEngine.register failed:", e); }
  }

  // -- STEP E: A/B Session Recording (STEP 11 PART 1)
  if (event.type === "ab_control_observe" || event.type === "ab_ml_popup_shown") {
    if (event.session_id) {
      await recordABSession(visitorId, event.session_id, store, {
        event_type:   event.type,
        ab_group:     event.payload.ab_group || "ml", // default ml if not specified but popup shown
        discount_pct: event.payload.discount_pct || 0
      });
    }
  }
}

// Helper: generate 7D embedding vector from tracking + visitor
function generateEmbeddingVector(tracking: any, visitor: any): number[] | null {
  if (!tracking || !visitor) return null;
  function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, isNaN(v) ? 0 : v)); }
  return [
    clamp((tracking.time_on_page    || 0) / 120),
    clamp((tracking.scroll_depth    || 0) / 100),
    clamp(tracking.engagement_score  || 0),
    clamp(1 - (tracking.hesitation_score || 0)),
    clamp((visitor.visit_count       || 0) / 10),
    clamp((visitor.conversion_attempts || 0) / 5),
    (visitor.coupon_abuse_severity || 0) >= 2 ? 0 : 1
  ];
}

// ============================================================
// ISOLATED TRAINING PIPELINE (with Backlog — zero data loss)
// ============================================================
async function runTrainingPipeline(event: TrainingEvent): Promise<void> {
  // TRAINING GUARD: if blocked → save to backlog, do NOT drop
  if (!flags.trainingEnabled || !flags.aiEnabled || flags.maintenanceMode) {
    const reason = !flags.trainingEnabled ? "training_disabled"
                 : !flags.aiEnabled       ? "ai_disabled"
                 : "maintenance_mode";
    console.warn("⚠ QUEUE: Training blocked (" + reason + ") — saving to backlog");

    if (event.features && typeof event.label === "number") {
      await saveToBacklog(event.visitor_id, event.features, event.label, event.store, { reason });
    }
    return;
  }

  if (!event.features || !Array.isArray(event.features)) {
    const feats = await featureStore.get(event.visitor_id);
    if (!feats) { console.warn("⚠ TRAINING: No features for:", event.visitor_id); return; }
    event.features = featureToArray(feats);
  }

  if (typeof event.label !== "number") { return; }

  // ONLINE TRAINING (real-time gradient descent)
  trainOnline(event.features, event.label);

  // Log to training audit table
  await safeInsert(
    `INSERT INTO nolix_training_log
     (visitor_id, label, event_type, model_version, trained_at)
     VALUES ($1, $2, $3, 0, NOW())`,
    [event.visitor_id, event.label, event.type]
  );

  // Persist updated weights after every purchase_confirmed (high-value truth)
  if (event.label >= 0.8) { await saveModelToDB(); }
}

// ============================================================
// QUEUE PROCESSOR — runs every 2 seconds
// ============================================================
export async function processQueue(): Promise<void> {
  // STEP 11.1: Load Welford feature stats from DB on first run
  if (!isLoaded())       { await loadModelFromDB(); }
  if (!_statsLoaded)     { await loadFeatureStatsFromDB(); _statsLoaded = true; }

  // ── STEP 14 PART 7: CIRCUIT BREAKER CHECK ─────────────────────────────────
  const circuit = getCircuitStatus();
  if (!canPass()) {
    console.warn(`🔴 QUEUE: Circuit breaker ${circuit.state}. Skipping processing.`);
    await logMetric("queue_skipped_circuit_open", 1, { state: circuit.state }).catch(() => {});
    return;
  }

  // ── Drain event queue (batch of 50, ORDERED by arrival) ───────────────────
  const events = _eventQueue.splice(0, 50);
  for (const event of events) {
    const start = Date.now();
    let succeeded = false;
    try {
      // STEP 14 PART 4: IDEMPOTENCY — skip duplicate events
      const eventId = generateEventId(
        event.visitor_id || "anon",
        event.type,
        event.session_id,
        event.queued_at
      );
      const isNew = await checkAndMark(eventId, event.type, event.visitor_id);
      if (!isNew) continue; // skip duplicate

      await eventWorker(event);
      _eventCounter++;
      succeeded = true;
    } catch(e) {
      console.warn("⚠ eventWorker error:", e);
    }
    // STEP 14 PART 7: record outcome for circuit breaker
    recordOutcome(succeeded, Date.now() - start);
  }

  // STEP 11.1: Save Welford stats to DB every 50 processed events
  if (_eventCounter > 0 && _eventCounter % 50 === 0) {
    await saveFeatureStatsToDB().catch(() => {});
  }

  // ── Drain training queue (batch of 10) ────────────────────────────────────
  const trainings = _trainingQueue.splice(0, 10);
  for (const t of trainings) {
    await runTrainingPipeline(t);
  }

  // ── Queue visibility: log metrics ─────────────────────────────────────────
  if (events.length > 0 || trainings.length > 0) {
    console.log(`⚙ QUEUE: ${events.length}ev | ${trainings.length}tr | total:${_eventCounter} | circuit:${circuit.state}`);
    await logMetric("queue_processing_rate", events.length, { circuit: circuit.state }).catch(() => {});
  }
}


// ============================================================
// BATCH WORKER — runs every 60 minutes
// Layer 4B: aggregated learning for stability
// ============================================================
let _batchWorkerStarted = false;
export function startBatchWorker(): void {
  if (_batchWorkerStarted) return;
  _batchWorkerStarted = true;

  const BATCH_INTERVAL = 60 * 60 * 1000; // 60 minutes

  setTimeout(async function runBatch() {
    console.log("🔵 BATCH WORKER: Starting batch training pass...");
    try {
      const result = await trainBatch();
      console.log("🔵 BATCH WORKER COMPLETE:", result);
    } catch(e) {
      console.error("❌ BATCH WORKER ERROR:", e);
    }
    setTimeout(runBatch, BATCH_INTERVAL);
  }, BATCH_INTERVAL);

  console.log("⚙ NOLIX BATCH WORKER: Scheduled (60min interval)");
}

// ============================================================
// QUEUE WORKER — runs every 2 seconds
// ============================================================
let _workerStarted = false;
export function startQueueWorker(): void {
  if (_workerStarted) return;
  _workerStarted = true;

  // STEP 13.5 PART 8: Run startup assertions (DB, env, tables, pgvector)
  assertOnce().then(result => {
    if (!result.passed) {
      console.error("🔴 STARTUP ASSERTIONS FAILED:", result.fatal.join("; "));
    }
  }).catch(e => console.warn("⚠ assertOnce error:", e));

  // Load runtime flags from DB (distributed-safe initial load)
  loadRuntimeFlags().catch(e => console.warn("⚠ loadRuntimeFlags:", e));

  // Main event worker (every 2 seconds)
  setInterval(async () => {
    try { await processQueue(); }
    catch(e) { console.error("❌ QUEUE WORKER ERROR:", e); }
  }, 2000);

  // Metrics snapshot (every 5 minutes)
  setInterval(async () => {
    try {
      const { snapshotSystemMetrics } = await import("./nolix-metrics");
      await snapshotSystemMetrics();
    } catch { /* non-blocking */ }
  }, 5 * 60_000);

  startBatchWorker();
  console.log("⚙ NOLIX QUEUE WORKER v3: Started (2s events, 5min metrics, assertions)");
}

// ============================================================
// RETRY INSERT — Layer 5 reliability
// ============================================================
export async function retryInsert(
  sql: string, params: unknown[], retries = 3, delayMs = 500
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try { await query(sql, params); return true; }
    catch(e) {
      console.warn(`⚠ RETRY ${i + 1}/${retries}:`, e);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  console.error("❌ ALL RETRIES EXHAUSTED");
  return false;
}

// ============================================================
// SAFE INSERT (non-crashing — for low-priority writes)
// ============================================================
async function safeInsert(sql: string, params: unknown[]): Promise<boolean> {
  try { await query(sql, params); return true; }
  catch(e) { console.error("❌ DB INSERT:", e); return false; }
}
