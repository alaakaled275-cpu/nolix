/**
 * NOLIX — Decision Trace System (Pre-Step 16 PART 4)
 * lib/nolix-decision-trace.ts
 *
 * Every command execution is logged to nolix_decision_logs.
 * Enables:
 *   - Full audit trail of every AI decision
 *   - Replay: re-execute any decision with same input
 *   - Explainability: why did ZENO do X?
 *   - Debugging: what went wrong at time T?
 */

import { query }    from "./db";

export interface DecisionLog {
  id?:        number;
  trace_id:   string;         // unique per command execution
  visitor_id: string;
  command:    string;         // CMD_01_CLASSIFY_VISITOR, etc.
  input:      Record<string, any>;
  output:     Record<string, any>;
  reasoning:  string;         // human-readable explanation
  latency_ms: number;
  version:    string;
  created_at: Date;
}

// ── Generate trace ID ─────────────────────────────────────────────────────────
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// ── LOG DECISION ──────────────────────────────────────────────────────────────
export async function logDecision(params: {
  trace_id:   string;
  visitor_id: string;
  command:    string;
  input:      Record<string, any>;
  output:     Record<string, any>;
  reasoning:  string;
  latency_ms: number;
  version?:   string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_decision_logs
       (trace_id, visitor_id, command, input, output, reasoning, latency_ms, version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        params.trace_id,
        params.visitor_id.substring(0, 128),
        params.command,
        JSON.stringify(params.input),
        JSON.stringify(params.output),
        params.reasoning.substring(0, 1000),
        params.latency_ms,
        params.version || "v1"
      ]
    );
  } catch(e) {
    // Non-blocking: trace failure must NEVER affect main flow
    console.warn("⚠ TRACE: logDecision failed:", e);
  }
}

// ── GET DECISION BY TRACE ID ──────────────────────────────────────────────────
export async function getDecisionByTraceId(traceId: string): Promise<DecisionLog | null> {
  try {
    const rows = await query<any>(
      "SELECT * FROM nolix_decision_logs WHERE trace_id=$1 LIMIT 1",
      [traceId]
    );
    const row = (rows as any[])[0];
    if (!row) return null;

    return {
      id:         row.id,
      trace_id:   row.trace_id,
      visitor_id: row.visitor_id,
      command:    row.command,
      input:      typeof row.input === "string" ? JSON.parse(row.input) : row.input,
      output:     typeof row.output === "string" ? JSON.parse(row.output) : row.output,
      reasoning:  row.reasoning,
      latency_ms: Number(row.latency_ms),
      version:    row.version,
      created_at: row.created_at
    };
  } catch { return null; }
}

// ── GET RECENT DECISIONS ──────────────────────────────────────────────────────
export async function getRecentDecisions(
  filters: { visitor_id?: string; command?: string; limit?: number } = {}
): Promise<DecisionLog[]> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.visitor_id) {
      params.push(filters.visitor_id);
      conditions.push(`visitor_id = $${params.length}`);
    }
    if (filters.command) {
      params.push(filters.command);
      conditions.push(`command = $${params.length}`);
    }

    const where     = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitNum  = Math.min(filters.limit || 50, 200);
    params.push(limitNum);

    const rows = await query<any>(
      `SELECT id, trace_id, visitor_id, command, output, reasoning, latency_ms, version, created_at
       FROM nolix_decision_logs ${where}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );

    return (rows as any[]).map(r => ({
      id:         r.id,
      trace_id:   r.trace_id,
      visitor_id: r.visitor_id,
      command:    r.command,
      input:      {}, // don't return input by default (privacy)
      output:     typeof r.output === "string" ? JSON.parse(r.output) : r.output,
      reasoning:  r.reasoning,
      latency_ms: Number(r.latency_ms),
      version:    r.version,
      created_at: r.created_at
    }));
  } catch { return []; }
}

// ── DECISION ACCURACY STATS ───────────────────────────────────────────────────
export async function getDecisionAccuracyStats(): Promise<{
  total_decisions:   number;
  avg_latency_ms:    number;
  commands_breakdown: Record<string, number>;
  avg_intent_score:  number;
  ml_vs_zeno_diff:   number;     // avg difference between ML and ZENO scores
  failure_rate:      number;     // % of decisions with error in output
  decisions_per_hour: number;
}> {
  try {
    const stats = await query<any>(`
      SELECT
        COUNT(*)                                           AS total,
        AVG(latency_ms)::NUMERIC(8,2)                     AS avg_latency,
        COUNT(*) FILTER (WHERE output::TEXT LIKE '%error%') AS error_count,
        AVG((output->>'final_score')::NUMERIC)::NUMERIC(6,4) AS avg_intent,
        AVG((output->>'ml_score')::NUMERIC)::NUMERIC(6,4)    AS avg_ml,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last_hour
      FROM nolix_decision_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const row = (stats as any[])[0] || {};

    const cmdBreakdown: Record<string, number> = {};
    const cmds = await query<any>(`
      SELECT command, COUNT(*) as cnt
      FROM nolix_decision_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY command ORDER BY cnt DESC
    `).catch(() => []);
    for (const c of cmds as any[]) cmdBreakdown[c.command] = Number(c.cnt);

    const total       = Number(row.total) || 0;
    const avgIntent   = Number(row.avg_intent) || 0;
    const avgML       = Number(row.avg_ml) || 0;
    const failures    = Number(row.error_count) || 0;

    return {
      total_decisions:   total,
      avg_latency_ms:    Number(row.avg_latency) || 0,
      commands_breakdown: cmdBreakdown,
      avg_intent_score:  avgIntent,
      ml_vs_zeno_diff:   Math.abs(avgIntent - avgML),
      failure_rate:      total > 0 ? Math.round((failures / total) * 10000) / 10000 : 0,
      decisions_per_hour: Number(row.last_hour) || 0
    };
  } catch {
    return {
      total_decisions: 0, avg_latency_ms: 0, commands_breakdown: {},
      avg_intent_score: 0, ml_vs_zeno_diff: 0, failure_rate: 0, decisions_per_hour: 0
    };
  }
}
