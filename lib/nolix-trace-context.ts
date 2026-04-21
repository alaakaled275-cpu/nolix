/**
 * NOLIX — Unified Trace System (COMMAND 03 - Step 1)
 * lib/nolix-trace-context.ts
 */

export type ZenoTraceContext = {
  trace_id: string;
  visitor_id?: string;
  session_id?: string;
  decision_id?: string;
  source: "decide" | "replay" | "reconcile" | "system";
  timestamp: number;
};

export function createTraceContext(input?: Partial<ZenoTraceContext>): ZenoTraceContext {
  return {
    trace_id: crypto.randomUUID(),
    source: input?.source || "system",
    visitor_id: input?.visitor_id,
    session_id: input?.session_id,
    decision_id: input?.decision_id,
    timestamp: Date.now()
  };
}
