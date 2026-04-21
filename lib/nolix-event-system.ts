/**
 * NOLIX — ZENO Event System (STEP 1: Event Foundation Layer)
 * lib/nolix-event-system.ts
 *
 * ⚔️ PURPOSE:
 * This is the CENTRAL NERVOUS SYSTEM of ZENO intelligence.
 * Every decision, ML signal, and behavioral event flows through here.
 *
 * Event Types:
 *   decision  — final ZENO decision (show_popup / block / do_nothing)
 *   ml        — ML signal computed for a visitor
 *   behavior  — raw behavioral assessment result
 *   system    — infrastructure events (health, errors, cold-starts)
 *   replay    — events generated during replay runs
 *
 * Sources:
 *   zeno      — ZENO Hybrid Brain (authoritative)
 *   ml        — ML engine (signal only, never authority)
 *   engine    — Core decision API
 *   system    — Infrastructure / health monitors
 *
 * LAWS:
 *   1. EVERY decision MUST produce at least one event
 *   2. Events are IMMUTABLE — never update, only append
 *   3. Events MUST contain trace_id for cross-service correlation
 *   4. Failure to insert event must NEVER crash the decision flow
 */

import { query } from "./db";

// ── Event Type Definitions ────────────────────────────────────────────────────

export type EventType = "decision" | "ml" | "behavior" | "system" | "replay";
export type EventSource = "zeno" | "ml" | "engine" | "system";

export interface NolixEvent {
  id?:         string;
  trace_id:    string;
  visitor_id?: string;
  event_type:  EventType;
  payload:     Record<string, any>;
  source:      EventSource;
  created_at?: Date;
}

export interface DecisionEventPayload {
  intent:         string;
  friction:       string;
  ml_boost:       number;
  final_score:    number;
  action:         string;
  recommended_popup?: string | null;
  discount_pct?:  number;
  reasoning:      string[] | any;
  decision_path:  string[];
  rules_version:  string;
  economic_justified: boolean;
  expected_uplift?: number;
  latency_ms?:    number;
}

export interface BehaviorEventPayload {
  intent:           string;
  intent_score:     number;
  friction:         string;
  friction_present: boolean;
  engagement_depth: string;
  is_exit_risk:     boolean;
  is_bot_suspect:   boolean;
  is_high_value:    boolean;
  rules_fired:      string[];
  intervention_eligible: boolean;
}

export interface MLEventPayload {
  ml_score:     number;
  ml_boost:     number;
  model_used:   string;
  skipped:      boolean;
  skip_reason?: string;
  latency_ms?:  number;
}

export interface SystemEventPayload {
  event:   string;   // "startup" | "healthcheck" | "error" | "cold_start"
  service: string;
  detail?: string;
  error?:  string;
}

// ── In-Memory Event Bus (WebSocket-ready) ────────────────────────────────────

type EventListener = (event: NolixEvent) => void;

const _listeners: EventListener[] = [];

export function onEvent(listener: EventListener): () => void {
  _listeners.push(listener);
  // Return unsubscribe function
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

function _broadcast(event: NolixEvent): void {
  // Non-blocking broadcast to all registered listeners (WebSocket, SSE, etc.)
  setImmediate(() => {
    for (const listener of _listeners) {
      try { listener(event); } catch { /* never crash on listener failure */ }
    }
  });
}

// ── Core: Emit Event ──────────────────────────────────────────────────────────

/**
 * emitEvent() — THE ONLY WAY to record events in ZENO
 *
 * - Persists to nolix_events table (non-blocking)
 * - Broadcasts to in-memory listeners (WebSocket / SSE ready)
 * - NEVER throws — failure is logged but NEVER propagated
 */
export async function emitEvent(event: Omit<NolixEvent, "id" | "created_at">): Promise<void> {
  // Broadcast to real-time listeners first (fastest path)
  const fullEvent: NolixEvent = { ...event, created_at: new Date() };
  _broadcast(fullEvent);

  // Persist to DB (non-blocking, never crashes the caller)
  try {
    await query(
      `INSERT INTO nolix_events (trace_id, visitor_id, event_type, payload, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.trace_id,
        event.visitor_id || null,
        event.event_type,
        JSON.stringify(event.payload),
        event.source
      ]
    );
  } catch (e: any) {
    // Log but never propagate — event failure must NEVER kill decisions
    console.warn("[ZENO EVENT] Failed to persist event:", e?.message);
    // Emit system error event to in-memory only (no recursive DB call)
    _broadcast({
      trace_id:   event.trace_id || "system",
      visitor_id: undefined,
      event_type: "system",
      source:     "system",
      payload:    { event: "error", service: "event_system", error: e?.message },
      created_at: new Date()
    });
  }
}

// ── Specialized Emitters ──────────────────────────────────────────────────────

/** Emit a complete ZENO decision event */
export async function emitDecisionEvent(
  trace_id: string,
  visitor_id: string,
  payload: DecisionEventPayload
): Promise<void> {
  return emitEvent({
    trace_id,
    visitor_id,
    event_type: "decision",
    source:     "zeno",
    payload
  });
}

/** Emit a behavioral assessment event */
export async function emitBehaviorEvent(
  trace_id: string,
  visitor_id: string,
  payload: BehaviorEventPayload
): Promise<void> {
  return emitEvent({
    trace_id,
    visitor_id,
    event_type: "behavior",
    source:     "zeno",
    payload
  });
}

/** Emit an ML signal event */
export async function emitMLEvent(
  trace_id: string,
  visitor_id: string,
  payload: MLEventPayload
): Promise<void> {
  return emitEvent({
    trace_id,
    visitor_id,
    event_type: "ml",
    source:     "ml",
    payload
  });
}

/** Emit a system event (startup, health, error) */
export async function emitSystemEvent(
  payload: SystemEventPayload
): Promise<void> {
  return emitEvent({
    trace_id:  `sys_${Date.now()}`,
    event_type: "system",
    source:     "system",
    payload
  });
}

// ── Query Helpers ─────────────────────────────────────────────────────────────

/** Fetch all events for a given trace_id in chronological order */
export async function getEventsByTrace(trace_id: string): Promise<NolixEvent[]> {
  try {
    const rows = await query<any>(
      `SELECT id, trace_id, visitor_id, event_type, payload, source, created_at
       FROM nolix_events
       WHERE trace_id = $1
       ORDER BY created_at ASC`,
      [trace_id]
    );
    return (rows as any[]).map(_parseRow);
  } catch { return []; }
}

/** Fetch latest N events across all visitors (for dashboard stream) */
export async function getLatestEvents(limit = 50): Promise<NolixEvent[]> {
  try {
    const rows = await query<any>(
      `SELECT id, trace_id, visitor_id, event_type, payload, source, created_at
       FROM nolix_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(limit, 200)]
    );
    return (rows as any[]).map(_parseRow);
  } catch { return []; }
}

/** Fetch all events for a visitor (full behavioral timeline) */
export async function getEventsByVisitor(
  visitor_id: string,
  limit = 100
): Promise<NolixEvent[]> {
  try {
    const rows = await query<any>(
      `SELECT id, trace_id, visitor_id, event_type, payload, source, created_at
       FROM nolix_events
       WHERE visitor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [visitor_id, Math.min(limit, 500)]
    );
    return (rows as any[]).map(_parseRow);
  } catch { return []; }
}

/** Count events per type in last N hours (for analytics) */
export async function getEventStats(hours = 24): Promise<Record<string, number>> {
  try {
    const rows = await query<any>(
      `SELECT event_type, COUNT(*) as cnt
       FROM nolix_events
       WHERE created_at > NOW() - INTERVAL '${Math.min(hours, 168)} hours'
       GROUP BY event_type`,
      []
    );
    const stats: Record<string, number> = {};
    for (const row of rows as any[]) {
      stats[row.event_type] = Number(row.cnt);
    }
    return stats;
  } catch { return {}; }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _parseRow(row: any): NolixEvent {
  return {
    id:         row.id,
    trace_id:   row.trace_id,
    visitor_id: row.visitor_id,
    event_type: row.event_type as EventType,
    payload:    typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {}),
    source:     row.source as EventSource,
    created_at: row.created_at
  };
}
