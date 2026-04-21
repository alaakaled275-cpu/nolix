/**
 * NOLIX — Signal Validator (Pre-Step 16 PART 2)
 * lib/nolix-signal-validator.ts
 *
 * STRICT validation layer — runs AFTER normalizer.
 * Throws on invalid signals (data contract enforcement).
 *
 * Three validation levels:
 *   - HARD (throws):  data will corrupt training or decision
 *   - SOFT (warns):   suspicious but processable
 *   - INFO:           logged only, no block
 */

import { NolixSignalV1, COMMAND_ALLOWED_FIELDS } from "./nolix-signal-schema";

export interface ValidationReport {
  valid:    boolean;
  level:    "ok" | "soft" | "hard";
  errors:   ValidationError[];
  warnings: string[];
  info:     string[];
}

export interface ValidationError {
  code:    string;
  field:   string;
  message: string;
}

// ── VALIDATE SIGNAL ───────────────────────────────────────────────────────────
export function validateSignal(s: NolixSignalV1): ValidationReport {
  const errors:   ValidationError[] = [];
  const warnings: string[] = [];
  const info:     string[] = [];

  // ── HARD ERRORS (throw-level) ─────────────────────────────────────────────
  if (!s.visitor_id || s.visitor_id.trim() === "") {
    errors.push({ code: "INVALID_VISITOR", field: "visitor_id", message: "visitor_id is required and must not be empty" });
  }
  if (!s.session_id || s.session_id.trim() === "") {
    errors.push({ code: "INVALID_SESSION", field: "session_id", message: "session_id is required" });
  }
  if (!s.store_domain || s.store_domain.trim() === "") {
    errors.push({ code: "INVALID_STORE", field: "store_domain", message: "store_domain is required" });
  }
  if (s.time_on_page < 0) {
    errors.push({ code: "INVALID_TIME", field: "time_on_page", message: `time_on_page must be >= 0. Got: ${s.time_on_page}` });
  }
  if (s.scroll_depth < 0 || s.scroll_depth > 1) {
    errors.push({ code: "INVALID_SCROLL", field: "scroll_depth", message: `scroll_depth must be 0-1. Got: ${s.scroll_depth}` });
  }
  if (s.page_views < 0) {
    errors.push({ code: "INVALID_PAGE_VIEWS", field: "page_views", message: `page_views must >= 0. Got: ${s.page_views}` });
  }
  if (!isFinite(s.timestamp) || s.timestamp <= 0) {
    errors.push({ code: "INVALID_TIMESTAMP", field: "timestamp", message: `timestamp must be valid Unix ms. Got: ${s.timestamp}` });
  }

  // ── SOFT WARNINGS (suspicious but not blocking) ────────────────────────────
  if (s.time_on_page > 3600) {
    warnings.push(`time_on_page=${s.time_on_page}s seems unrealistically high (>1h). Will be clamped.`);
  }
  if (s.page_views > 100) {
    warnings.push(`page_views=${s.page_views} seems high. Possible bot or tracker issue.`);
  }
  if (s.clicks > 200) {
    warnings.push(`clicks=${s.clicks} seems very high. Possible automation.`);
  }
  if (s.time_on_page < 1 && s.page_views > 5) {
    warnings.push("Bot signal: <1s time but >5 pages. Fraud score will be elevated.");
  }
  if (s.timestamp < Date.now() - 24 * 3600 * 1000) {
    warnings.push(`Stale event: timestamp=${new Date(s.timestamp).toISOString()} is >24h old.`);
  }
  if (s.timestamp > Date.now() + 5 * 60 * 1000) {
    warnings.push(`Future timestamp: ${new Date(s.timestamp).toISOString()}. Clock skew?`);
  }

  // ── INFO ──────────────────────────────────────────────────────────────────
  if (s.checkout_started) {
    info.push("checkout_started=true: high-intent visitor");
  }

  const level: ValidationReport["level"] =
    errors.length > 0   ? "hard" :
    warnings.length > 0 ? "soft" : "ok";

  return { valid: errors.length === 0, level, errors, warnings, info };
}

// ── THROWING VALIDATOR (for APIs that must reject) ─────────────────────────────
export function assertSignalValid(s: NolixSignalV1): void {
  const report = validateSignal(s);
  if (!report.valid) {
    const msg = report.errors.map(e => `[${e.code}] ${e.message}`).join("; ");
    throw new Error(`SIGNAL_INVALID: ${msg}`);
  }
}

// ── COMMAND PAYLOAD VALIDATOR (PART 6) ─────────────────────────────────────────
export function validateCommandPayload(
  cmd:     string,
  payload: Record<string, any>
): ValidationReport {
  const errors:   ValidationError[] = [];
  const warnings: string[] = [];

  // PART 6: visitor_id required in all commands
  if (!payload.visitor_id) {
    errors.push({ code: "INVALID_PAYLOAD", field: "visitor_id", message: "visitor_id is required in all commands" });
  }

  // PART 7: HARD REJECT UNKNOWN FIELDS
  const allowed = COMMAND_ALLOWED_FIELDS[cmd];
  if (allowed) {
    const unknown = Object.keys(payload).filter(k => !allowed.includes(k));
    if (unknown.length > 0) {
      errors.push({
        code:    "UNEXPECTED_FIELD",
        field:   unknown.join(", "),
        message: `Unknown fields in ${cmd}: [${unknown.join(", ")}]. Allowed: [${allowed.join(", ")}]`
      });
    }
  }

  // Command-specific validation
  if (cmd === "CMD_01_CLASSIFY_VISITOR" || cmd === "CMD_02_SCORE_INTENT" || cmd === "CMD_03_DECIDE_ACTION") {
    if (payload.time_on_page === undefined) {
      errors.push({ code: "MISSING_FIELD", field: "time_on_page", message: `${cmd} requires time_on_page` });
    }
    if (payload.scroll_depth !== undefined && (payload.scroll_depth < 0 || payload.scroll_depth > 1)) {
      errors.push({ code: "INVALID_SCROLL", field: "scroll_depth", message: "scroll_depth must be 0-1" });
    }
  }

  if (cmd === "CMD_05_UPDATE_LABEL") {
    if (payload.label === undefined || ![0, 1].includes(Number(payload.label))) {
      errors.push({ code: "INVALID_LABEL", field: "label", message: "label must be 0 or 1" });
    }
  }

  return { valid: errors.length === 0, level: errors.length > 0 ? "hard" : "ok", errors, warnings, info: [] };
}
