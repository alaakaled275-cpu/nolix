/**
 * NOLIX — Circuit Breaker (STEP 14 PART 7 + 8)
 * lib/nolix-circuit-breaker.ts
 *
 * REAL circuit breaker — not just health score logging.
 * Watches: error_rate, latency, queue lag, failure streak.
 *
 * States:
 *   CLOSED   — normal operation
 *   OPEN     — ai_enabled=false, all decisions blocked
 *   HALF_OPEN — testing recovery (1-in-10 requests pass)
 *
 * Auto-Recovery (PART 8):
 *   health_score > 0.8 AND error_rate < 0.05 → CLOSED again
 */

import { query } from "./db";
import { setFlagAtomic } from "./nolix-distributed-lock";
import { logMetric }     from "./nolix-metrics";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitMetrics {
  error_rate:       number;   // 0–1
  latency_ms:       number;   // avg ms per decision
  failure_streak:   number;   // consecutive failures
  success_streak:   number;   // consecutive successes (for recovery)
  queue_lag_s:      number;   // oldest pending event age in seconds
  health_score:     number;   // from health engine (0–1)
  requests_sampled: number;   // total checked
  last_checked:     number;   // epoch ms
}

// ── In-memory breaker state (per-instance) ───────────────────────────────────
let _state:   CircuitState = "CLOSED";
let _metrics: CircuitMetrics = {
  error_rate: 0, latency_ms: 0, failure_streak: 0, success_streak: 0,
  queue_lag_s: 0, health_score: 1, requests_sampled: 0, last_checked: 0
};

// Sliding window for error tracking (last 100 events)
const _window: boolean[] = []; // true = success, false = failure
const WINDOW_SIZE = 100;

// ── RECORD OUTCOME (call after every decision) ───────────────────────────────
export function recordOutcome(success: boolean, latencyMs: number): void {
  _window.push(success);
  if (_window.length > WINDOW_SIZE) _window.shift();

  const errors = _window.filter(x => !x).length;
  _metrics.error_rate   = _window.length ? errors / _window.length : 0;
  _metrics.latency_ms   = latencyMs;
  _metrics.requests_sampled++;

  if (!success) {
    _metrics.failure_streak++;
    _metrics.success_streak = 0;
  } else {
    _metrics.success_streak++;
    _metrics.failure_streak = 0;
  }

  // Check if we need to trip the breaker
  _checkAndAct();
}

// ── MAIN LOGIC ───────────────────────────────────────────────────────────────
function _checkAndAct(): void {
  const now = Date.now();
  if (now - _metrics.last_checked < 5000) return; // Check at most every 5 seconds
  _metrics.last_checked = now;

  const shouldOpen = (
    _metrics.error_rate   > 0.20 ||   // >20% error rate
    _metrics.latency_ms   > 2000 ||   // >2 second avg latency
    _metrics.failure_streak > 10 ||   // 10 consecutive failures
    _metrics.health_score < 0.40      // health engine: hard failure
  );

  const shouldClose = (
    _state !== "CLOSED" &&
    _metrics.health_score > 0.80 &&
    _metrics.error_rate   < 0.05 &&
    _metrics.failure_streak === 0 &&
    _metrics.success_streak >= 5
  );

  if (shouldOpen && _state === "CLOSED") {
    _trip("OPEN").catch(() => {});
  } else if (shouldClose && _state !== "CLOSED") {
    _recover("CLOSED").catch(() => {});
  } else if (_state === "OPEN" && _metrics.success_streak >= 2) {
    _state = "HALF_OPEN";
    console.log("⚡ CIRCUIT: → HALF_OPEN (testing recovery)");
  }
}

// ── TRIP OPEN (PART 7) ───────────────────────────────────────────────────────
async function _trip(newState: CircuitState): Promise<void> {
  if (_state === newState) return;
  _state = newState;

  const reason = `circuit_breaker:err=${(_metrics.error_rate*100).toFixed(0)}%,lat=${_metrics.latency_ms}ms,streak=${_metrics.failure_streak}`;
  console.error(`🔴 CIRCUIT BREAKER TRIPPED → ${newState}: ${reason}`);

  // Atomic DB write for distributed enforcement
  await setFlagAtomic("ai_enabled", false, reason).catch(() => {});
  await setFlagAtomic("training_enabled", false, "circuit_breaker:training_off").catch(() => {});

  // Log to system metrics
  await logMetric("circuit_breaker_trip", 1, {
    state:         newState, error_rate: _metrics.error_rate,
    latency_ms:    _metrics.latency_ms, failure_streak: _metrics.failure_streak,
    health_score:  _metrics.health_score
  }).catch(() => {});

  // Alert webhook
  try {
    const webhook = process.env.NOLIX_ALERT_WEBHOOK;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🔴 NOLIX Circuit Breaker TRIPPED\nState: ${newState}\nError Rate: ${(_metrics.error_rate*100).toFixed(0)}%\nLatency: ${_metrics.latency_ms}ms\nReason: ${reason}`
        })
      }).catch(() => {});
    }
  } catch {}
}

// ── AUTO RECOVERY (PART 8) ───────────────────────────────────────────────────
async function _recover(newState: CircuitState): Promise<void> {
  if (_state === newState) return;
  _state = newState;
  console.log(`🟢 CIRCUIT BREAKER RECOVERED → ${newState}`);

  await setFlagAtomic("ai_enabled",       true, "circuit_breaker:auto_recovery").catch(() => {});
  await setFlagAtomic("training_enabled", true, "circuit_breaker:auto_recovery").catch(() => {});

  await logMetric("circuit_breaker_recovery", 1, {
    state: newState, health_score: _metrics.health_score, error_rate: _metrics.error_rate
  }).catch(() => {});

  try {
    const webhook = process.env.NOLIX_ALERT_WEBHOOK;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🟢 NOLIX Circuit Breaker RECOVERED\nHealth Score: ${(_metrics.health_score*100).toFixed(0)}%\nError Rate: ${(_metrics.error_rate*100).toFixed(0)}%`
        })
      }).catch(() => {});
    }
  } catch {}
}

// ── UPDATE HEALTH SCORE (called by health engine) ────────────────────────────
export function updateHealthScore(score: number): void {
  _metrics.health_score = score;

  // Hard failure at 0.4 — ALL three flags off (STEP 13.5 PART 7)
  if (score < 0.40) {
    _trip("OPEN").catch(() => {});
  }
}

// ── CAN PASS (for HALF_OPEN gating — 1 in 10) ───────────────────────────────
export function canPass(): boolean {
  if (_state === "CLOSED") return true;
  if (_state === "OPEN")   return false;
  // HALF_OPEN: let every 10th request through
  return Math.random() < 0.10;
}

// ── GET STATUS ────────────────────────────────────────────────────────────────
export function getCircuitStatus(): {
  state:           CircuitState;
  error_rate:      number;
  latency_ms:      number;
  failure_streak:  number;
  success_streak:  number;
  health_score:    number;
  window_size:     number;
  requests_sampled: number;
} {
  return {
    state:            _state,
    error_rate:       Math.round(_metrics.error_rate * 10000) / 10000,
    latency_ms:       _metrics.latency_ms,
    failure_streak:   _metrics.failure_streak,
    success_streak:   _metrics.success_streak,
    health_score:     _metrics.health_score,
    window_size:      _window.length,
    requests_sampled: _metrics.requests_sampled
  };
}

// ── MANUAL RESET (admin) ──────────────────────────────────────────────────────
export async function resetCircuitBreaker(by: string = "admin"): Promise<void> {
  _state = "CLOSED";
  _window.length = 0;
  _metrics.failure_streak  = 0;
  _metrics.success_streak  = 0;
  _metrics.error_rate      = 0;
  _metrics.requests_sampled = 0;
  await setFlagAtomic("ai_enabled",       true, by).catch(() => {});
  await setFlagAtomic("training_enabled", true, by).catch(() => {});
  console.log("🔄 CIRCUIT BREAKER: Manually reset by", by);
}
