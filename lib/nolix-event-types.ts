/**
 * NOLIX — Structured Event Taxonomy (COMMAND 03 - Step 2)
 * lib/nolix-event-types.ts
 */

export type ZenoEventType =
  | "BEHAVIOR_ANALYZED"
  | "CONTEXT_APPLIED"
  | "ML_EVALUATED"
  | "DECISION_MADE"
  | "ECONOMIC_VALIDATED"
  | "REPLAY_EXECUTED"
  | "DRIFT_DETECTED"
  | "ERROR";

export type ZenoEvent = {
  id: string;
  trace_id: string;
  type: ZenoEventType;
  level: "INFO" | "WARN" | "ERROR";
  timestamp: number;
  payload: any;
};
