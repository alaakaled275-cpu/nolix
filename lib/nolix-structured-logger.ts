/**
 * NOLIX — Structured Logger (STEP 1: Event Foundation Layer)
 * lib/nolix-structured-logger.ts
 *
 * ⚔️ PURPOSE:
 * Production-grade structured observability for ZENO.
 * This replaces ad-hoc console.log() with a queryable, correlated log system.
 *
 * Levels:    DEBUG | INFO | WARN | ERROR | FATAL
 * Services:  zeno | ml | engine | db | queue | auth | system | webhook
 *
 * LAWS:
 *   1. All logs contain trace_id for cross-service correlation
 *   2. Logs are NEVER blocking — use .catch(() => {}) always
 *   3. ERROR + FATAL logs also trigger in-memory alert listeners
 *   4. No PII in logs (visitor_id OK, but no email / name / address)
 */

import { query }       from "./db";
import { emitSystemEvent } from "./nolix-event-system";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel   = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
export type LogService =
  | "zeno" | "ml" | "engine" | "db" | "queue"
  | "auth" | "system" | "webhook" | "replay" | "event";

export interface StructuredLog {
  id?:        string;
  level:      LogLevel;
  service:    LogService;
  message:    string;
  meta?:      Record<string, any>;
  trace_id?:  string;
  created_at?: Date;
}

// ── Alert listeners (for ERROR/FATAL) ─────────────────────────────────────────

type AlertListener = (log: StructuredLog) => void;
const _alertListeners: AlertListener[] = [];

export function onAlert(listener: AlertListener): () => void {
  _alertListeners.push(listener);
  return () => {
    const idx = _alertListeners.indexOf(listener);
    if (idx !== -1) _alertListeners.splice(idx, 1);
  };
}

function _triggerAlerts(log: StructuredLog): void {
  setImmediate(() => {
    for (const listener of _alertListeners) {
      try { listener(log); } catch { /* never crash */ }
    }
  });
}

// ── Core: Log ─────────────────────────────────────────────────────────────────

async function log(
  level: LogLevel,
  service: LogService,
  message: string,
  meta?: Record<string, any>,
  trace_id?: string
): Promise<void> {
  const entry: StructuredLog = { level, service, message, meta, trace_id, created_at: new Date() };

  // Console output (always — for Docker logs visibility)
  const prefix = `[${level}][${service}]${trace_id ? `[${trace_id.substring(0, 8)}]` : ""}`;
  if (level === "DEBUG") {
    if (process.env.NODE_ENV !== "production") console.debug(prefix, message, meta || "");
  } else if (level === "WARN")  { console.warn(prefix, message, meta || ""); }
  else if (level === "ERROR" || level === "FATAL") { console.error(prefix, message, meta || ""); }
  else { console.log(prefix, message, meta || ""); }

  // Trigger alert listeners for ERROR/FATAL
  if (level === "ERROR" || level === "FATAL") {
    _triggerAlerts(entry);
    // Also push system event (non-blocking, no await)
    emitSystemEvent({
      event:   "error",
      service,
      detail:  message,
      error:   meta?.error || message
    }).catch(() => {});
  }

  // Persist to DB (non-blocking — NEVER await in critical path)
  query(
    `INSERT INTO nolix_logs (level, service, message, meta)
     VALUES ($1, $2, $3, $4)`,
    [level, service, message.substring(0, 500), JSON.stringify(meta || {})]
  ).catch(() => { /* DB log failure must never surface */ });
}

// ── Public API: log.debug / log.info / log.warn / log.error / log.fatal ───────

export const logger = {
  debug: (service: LogService, msg: string, meta?: Record<string, any>, trace_id?: string) =>
    log("DEBUG", service, msg, meta, trace_id),

  info: (service: LogService, msg: string, meta?: Record<string, any>, trace_id?: string) =>
    log("INFO", service, msg, meta, trace_id),

  warn: (service: LogService, msg: string, meta?: Record<string, any>, trace_id?: string) =>
    log("WARN", service, msg, meta, trace_id),

  error: (service: LogService, msg: string, meta?: Record<string, any>, trace_id?: string) =>
    log("ERROR", service, msg, meta, trace_id),

  fatal: (service: LogService, msg: string, meta?: Record<string, any>, trace_id?: string) =>
    log("FATAL", service, msg, meta, trace_id),

  /** Convenience: log decision outcome */
  decision: (trace_id: string, action: string, intent: string, latency_ms: number) =>
    log("INFO", "zeno",
      `Decision: ${action} | intent=${intent} | ${latency_ms}ms`,
      { action, intent, latency_ms },
      trace_id
    ),

  /** Convenience: log ML signal */
  mlSignal: (trace_id: string, boost: number, skipped: boolean) =>
    log("INFO", "ml",
      skipped ? "ML signal skipped" : `ML signal: boost=+${(boost*100).toFixed(1)}%`,
      { boost, skipped },
      trace_id
    ),

  /** Convenience: log system error with full error object */
  systemError: (service: LogService, error: Error, meta?: Record<string, any>) =>
    log("ERROR", service, error.message,
      { ...meta, stack: error.stack?.substring(0, 400), error: error.message }
    ),
};

// ── Query Helpers ─────────────────────────────────────────────────────────────

export interface LogQueryOptions {
  level?:    LogLevel;
  service?:  LogService;
  limit?:    number;
  hours?:    number;
}

/** Fetch recent structured logs for dashboard / monitoring */
export async function getRecentLogs(opts: LogQueryOptions = {}): Promise<StructuredLog[]> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts.level) {
      params.push(opts.level);
      conditions.push(`level = $${params.length}`);
    }
    if (opts.service) {
      params.push(opts.service);
      conditions.push(`service = $${params.length}`);
    }
    const hours = Math.min(opts.hours || 24, 168);
    const where = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")} AND created_at > NOW() - INTERVAL '${hours} hours'`
      : `WHERE created_at > NOW() - INTERVAL '${hours} hours'`;

    const limit = Math.min(opts.limit || 100, 500);
    params.push(limit);

    const rows = await query<any>(
      `SELECT id, level, service, message, meta, created_at
       FROM nolix_logs ${where}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return (rows as any[]).map(r => ({
      id:         r.id,
      level:      r.level as LogLevel,
      service:    r.service as LogService,
      message:    r.message,
      meta:       typeof r.meta === "string" ? JSON.parse(r.meta) : (r.meta || {}),
      created_at: r.created_at
    }));
  } catch { return []; }
}

/** Log error stats grouped by service (last N hours) */
export async function getErrorStats(hours = 24): Promise<Record<string, number>> {
  try {
    const rows = await query<any>(
      `SELECT service, COUNT(*) as cnt
       FROM nolix_logs
       WHERE level IN ('ERROR','FATAL')
         AND created_at > NOW() - INTERVAL '${Math.min(hours, 168)} hours'
       GROUP BY service ORDER BY cnt DESC`,
      []
    );
    const stats: Record<string, number> = {};
    for (const row of rows as any[]) stats[row.service] = Number(row.cnt);
    return stats;
  } catch { return {}; }
}
