/**
 * NOLIX — ZENO Replay Engine (STEP 1: Event Foundation Layer)
 * lib/nolix-replay-engine.ts
 *
 * ⚔️ PURPOSE:
 * Reconstruct and replay any past ZENO decision from beginning to end.
 *
 * This means:
 *   - behavior assessment result is visible at each stage
 *   - context logic decisions are visible
 *   - ml signal contribution is shown
 *   - economic gate outcome is shown
 *   - full timeline with timestamps
 *
 * LAWS:
 *   1. Replay NEVER modifies original events — read-only
 *   2. Replay result is tagged with source: "replay"
 *   3. Replay result is stored as new nolix_events rows (replay type)
 *   4. If trace not found → return structured 404-style object
 */

import { query } from "./db";
import {
  NolixEvent,
  emitEvent,
  getEventsByTrace
} from "./nolix-event-system";

// ── Replay Result Types ───────────────────────────────────────────────────────

export interface ReplayStep {
  step:        number;
  event_type:  string;
  source:      string;
  timestamp:   Date;
  payload:     Record<string, any>;
  summary:     string;   // human-readable one-liner of what happened at this step
}

export interface ReplayResult {
  trace_id:         string;
  visitor_id:       string | null;
  found:            boolean;
  total_events:     number;
  replay_at:        Date;
  timeline:         ReplayStep[];
  final_decision:   Record<string, any> | null;
  behavior_summary: Record<string, any> | null;
  ml_summary:       Record<string, any> | null;
  replay_id:        string;   // new trace_id for THIS replay run
}

// ── Core: Replay a Trace ──────────────────────────────────────────────────────

/**
 * replayTrace(trace_id) — Full reconstruction of a past decision
 *
 * 1. Fetches all events for the trace
 * 2. Builds chronological timeline
 * 3. Extracts key decision points
 * 4. Stores the replay itself as new "replay" type events
 * 5. Returns fully structured ReplayResult
 */
export async function replayTrace(trace_id: string): Promise<ReplayResult> {
  const replay_id = crypto.randomUUID();
  const replay_at = new Date();

  // ── Step 1: Fetch original events ────────────────────────────────────────
  const events = await getEventsByTrace(trace_id);

  if (events.length === 0) {
    return {
      trace_id,
      visitor_id:       null,
      found:            false,
      total_events:     0,
      replay_at,
      timeline:         [],
      final_decision:   null,
      behavior_summary: null,
      ml_summary:       null,
      replay_id
    };
  }

  // ── Step 2: Build timeline ────────────────────────────────────────────────
  const timeline: ReplayStep[] = events.map((ev, idx) => ({
    step:       idx + 1,
    event_type: ev.event_type,
    source:     ev.source,
    timestamp:  ev.created_at || replay_at,
    payload:    ev.payload,
    summary:    _buildStepSummary(ev)
  }));

  // ── Step 3: Extract key results ───────────────────────────────────────────
  const decisionEvent = events.find(e => e.event_type === "decision");
  const behaviorEvent = events.find(e => e.event_type === "behavior");
  const mlEvent       = events.find(e => e.event_type === "ml");
  const visitor_id    = events[0]?.visitor_id || null;

  const final_decision   = decisionEvent?.payload || null;
  const behavior_summary = behaviorEvent?.payload || null;
  const ml_summary       = mlEvent?.payload || null;

  // ── Step 4: Persist this replay run as new events ─────────────────────────
  await emitEvent({
    trace_id:   replay_id,
    visitor_id: visitor_id || undefined,
    event_type: "replay",
    source:     "system",
    payload: {
      original_trace_id: trace_id,
      total_events:      events.length,
      replayed_at:       replay_at.toISOString(),
      final_action:      final_decision?.action || null,
      timeline_length:   timeline.length
    }
  });

  // ── Step 5: Return structured result ─────────────────────────────────────
  return {
    trace_id,
    visitor_id,
    found:         true,
    total_events:  events.length,
    replay_at,
    timeline,
    final_decision,
    behavior_summary,
    ml_summary,
    replay_id
  };
}

// ── Compare Two Traces ────────────────────────────────────────────────────────

export interface TraceDiff {
  trace_a:    string;
  trace_b:    string;
  a_decision: Record<string, any> | null;
  b_decision: Record<string, any> | null;
  diffs:      Array<{ field: string; a: any; b: any }>;
  same_action: boolean;
}

/**
 * compareTraces() — Side-by-side diff of two trace decisions
 * Used by the Analyst Dashboard to compare A/B decisions
 */
export async function compareTraces(trace_a: string, trace_b: string): Promise<TraceDiff> {
  const [eventsA, eventsB] = await Promise.all([
    getEventsByTrace(trace_a),
    getEventsByTrace(trace_b)
  ]);

  const decA = eventsA.find(e => e.event_type === "decision")?.payload || null;
  const decB = eventsB.find(e => e.event_type === "decision")?.payload || null;

  const COMPARE_FIELDS = [
    "intent", "friction", "ml_boost", "final_score",
    "action", "recommended_popup", "discount_pct",
    "economic_justified", "expected_uplift", "rules_version"
  ];

  const diffs: Array<{ field: string; a: any; b: any }> = [];
  for (const field of COMPARE_FIELDS) {
    const aVal = decA?.[field];
    const bVal = decB?.[field];
    if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
      diffs.push({ field, a: aVal, b: bVal });
    }
  }

  return {
    trace_a,
    trace_b,
    a_decision:  decA,
    b_decision:  decB,
    diffs,
    same_action: decA?.action === decB?.action
  };
}

// ── Visitor Full Timeline ─────────────────────────────────────────────────────

export interface VisitorTimeline {
  visitor_id:    string;
  total_sessions: number;
  first_seen:    Date | null;
  last_seen:     Date | null;
  sessions:      Array<{
    trace_id:   string;
    action:     string | null;
    intent:     string | null;
    created_at: Date;
  }>;
}

/**
 * getVisitorTimeline() — Full behavioral history of a single visitor
 */
export async function getVisitorTimeline(visitor_id: string): Promise<VisitorTimeline> {
  try {
    const rows = await query<any>(
      `SELECT DISTINCT ON (trace_id)
         trace_id,
         payload->>'action' as action,
         payload->>'intent' as intent,
         created_at
       FROM nolix_events
       WHERE visitor_id = $1
         AND event_type = 'decision'
       ORDER BY trace_id, created_at DESC`,
      [visitor_id]
    );

    const sessions = (rows as any[]).map(r => ({
      trace_id:   r.trace_id,
      action:     r.action,
      intent:     r.intent,
      created_at: r.created_at
    }));

    return {
      visitor_id,
      total_sessions: sessions.length,
      first_seen: sessions.length > 0 ? sessions[sessions.length - 1].created_at : null,
      last_seen:  sessions.length > 0 ? sessions[0].created_at : null,
      sessions
    };
  } catch {
    return {
      visitor_id,
      total_sessions: 0,
      first_seen: null,
      last_seen:  null,
      sessions:   []
    };
  }
}

// ── Edge Case / Failure Replay ────────────────────────────────────────────────

/**
 * getFailedDecisions() — Returns all events where action = "do_nothing"
 * due to error (not by legitimate rule) in the last N hours.
 * Used for auditing and system health monitoring.
 */
export async function getFailedDecisions(hours = 24): Promise<NolixEvent[]> {
  try {
    const rows = await query<any>(
      `SELECT id, trace_id, visitor_id, event_type, payload, source, created_at
       FROM nolix_events
       WHERE event_type = 'decision'
         AND payload->>'action' = 'do_nothing'
         AND payload ? 'error'
         AND created_at > NOW() - INTERVAL '${Math.min(hours, 168)} hours'
       ORDER BY created_at DESC
       LIMIT 100`,
      []
    );
    return (rows as any[]).map(_parseEventRow);
  } catch { return []; }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _buildStepSummary(ev: NolixEvent): string {
  switch (ev.event_type) {
    case "behavior":
      return `Behavior: intent=${ev.payload.intent}, friction=${ev.payload.friction}, bot=${ev.payload.is_bot_suspect}, exit_risk=${ev.payload.is_exit_risk}`;
    case "ml":
      if (ev.payload.skipped) return `ML: SKIPPED (${ev.payload.skip_reason || "unknown reason"})`;
      return `ML: boost=+${(ev.payload.ml_boost * 100).toFixed(1)}%, score=${ev.payload.ml_score?.toFixed(3)}`;
    case "decision":
      return `Decision: action=${ev.payload.action}, popup=${ev.payload.recommended_popup || "none"}, economic=${ev.payload.economic_justified}`;
    case "system":
      return `System: ${ev.payload.event} | ${ev.payload.service}${ev.payload.error ? " | ERROR: " + ev.payload.error : ""}`;
    case "replay":
      return `Replay: replaying trace ${ev.payload.original_trace_id} — ${ev.payload.total_events} events`;
    default:
      return `Event: ${ev.event_type} from ${ev.source}`;
  }
}

function _parseEventRow(row: any) {
  return {
    id:         row.id,
    trace_id:   row.trace_id,
    visitor_id: row.visitor_id,
    event_type: row.event_type,
    payload:    typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {}),
    source:     row.source,
    created_at: row.created_at
  };
}
