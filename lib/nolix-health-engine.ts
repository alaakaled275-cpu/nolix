/**
 * NOLIX — System Health Engine (STEP 12 PART 2)
 * lib/nolix-health-engine.ts
 *
 * Computes a composite health score (0–1) for the entire system.
 * Automatically disables AI and sends alerts if score falls below thresholds.
 *
 * Health Score Formula:
 *   score = 1.0
 *   - 0.30 if AUC < 0.60         (model not separating buyers from non-buyers)
 *   - 0.25 if drift > 0.30       (model behavior changed from baseline)
 *   - 0.20 if conv_rate < 0.01   (popup showing but nobody buying)
 *   - 0.15 if training_failures > 5 (pipeline broken)
 *   - 0.10 if no events in 2h    (script may be down)
 *
 * Thresholds:
 *   score >= 0.8 → HEALTHY  (green)
 *   score >= 0.5 → DEGRADED (yellow) — still operational
 *   score >= 0.4 → CRITICAL (orange) — AI auto-disabled
 *   score <  0.4 → FAILED   (red)    — alert sent + AI blocked
 */

import { query } from "./db";
import { getModelState } from "./nolix-ml-engine";
import { setFlag } from "./nolix-runtime";
import { setFlagAtomic } from "./nolix-distributed-lock";
import { updateHealthScore } from "./nolix-circuit-breaker";
import { logMetric } from "./nolix-metrics";

export type HealthStatus = "healthy" | "degraded" | "critical" | "failed";

export interface SystemHealth {
  score:             number;
  status:            HealthStatus;
  auc:               number;
  drift:             number;
  conversion_rate:   number;
  training_failures: number;
  events_last_2h:    number;
  ai_enabled:        boolean;
  training_blocked:  boolean;
  issues:            string[];
  actions_taken:     string[];  // NEW: what the engine did automatically
  computed_at:       number;
}

// ============================================================
// COMPUTE SYSTEM HEALTH SCORE
// ============================================================
export async function computeSystemHealth(): Promise<SystemHealth> {
  const model   = getModelState();
  const issues:       string[] = [];
  const actionsTaken: string[] = [];
  let score = 1.0;

  // 1. AUC check
  const auc = model.last_auc;
  if (auc < 0.60) {
    score -= 0.30;
    issues.push(`AUC=${auc} < 0.60 (model not separating buyers)`);
  }

  // 2. Drift check
  const drift = model.drift_score;
  if (drift > 0.30) {
    score -= 0.25;
    issues.push(`drift=${drift} > 0.30 (model behavior shifted from baseline)`);
  }

  // 3. Conversion rate check (last 24h)
  let convRate = 0;
  try {
    const convRows = await query<any>(`
      SELECT
        COUNT(DISTINCT s.session_id)::FLOAT AS sessions,
        COUNT(DISTINCT c.order_id)::FLOAT   AS conversions
      FROM nolix_ab_sessions s
      LEFT JOIN nolix_ab_conversions c ON c.visitor_id = s.visitor_id
      WHERE s.recorded_at > NOW() - INTERVAL '24 hours'
        AND s.ab_group = 'ml'
    `);
    const r = (convRows as any[])[0];
    convRate = r && r.sessions > 0 ? r.conversions / r.sessions : 0;
    if (convRate < 0.01 && r && r.sessions > 50) {
      score -= 0.20;
      issues.push(`conversion_rate=${convRate.toFixed(4)} < 1% (popup not converting)`);
    }
  } catch { /* non-blocking */ }

  // 4. Training failures check (last 24h)
  let trainingFailures = 0;
  try {
    const failRows = await query<any>(`
      SELECT COUNT(*) as cnt FROM nolix_training_logs
      WHERE logged_at > NOW() - INTERVAL '24 hours'
        AND (auc < 0.50 OR drift_detected = true)
    `);
    trainingFailures = Number((failRows as any[])[0]?.cnt) || 0;
    if (trainingFailures > 5) {
      score -= 0.15;
      issues.push(`training_failures=${trainingFailures} > 5 (pipeline instability)`);
    }
  } catch { /* non-blocking */ }

  // 5. Event activity check (last 2h)
  let events2h = 0;
  try {
    const evRows = await query<any>(
      `SELECT COUNT(*) as cnt FROM nolix_events WHERE created_at > NOW() - INTERVAL '2 hours'`
    );
    events2h = Number((evRows as any[])[0]?.cnt) || 0;
    if (events2h === 0) {
      score -= 0.10;
      issues.push(`events_last_2h=0 — script may be down or no traffic`);
    }
  } catch { /* non-blocking */ }

  score = Math.max(0, Math.round(score * 1000) / 1000);

  // ── STEP 14: Update circuit breaker with health score ─────────────────────
  // This triggers auto-trip if score < 0.40 (hard failure)
  updateHealthScore(score);

  // Map score to status
  let status: HealthStatus;
  if      (score >= 0.80) status = "healthy";
  else if (score >= 0.50) status = "degraded";
  else if (score >= 0.40) status = "critical";
  else                    status = "failed";

  // STEP 13.5 PART 7: HARD FAILURE MODE
  // score < 0.40 → disable ai + training + embedding
  if (score < 0.40) {
    try {
      await setFlagAtomic("ai_enabled",       false, "auto_health_shutdown");
      await setFlagAtomic("training_enabled", false, "auto_health_training_block");
      await setFlagAtomic("embedding_enabled",false, "auto_health_embedding_block");
      actionsTaken.push(`HARD FAILURE: all 3 flags OFF (score=${score}<0.40)`);
      await logMetric("health_hard_failure", score, { status: "failed" }).catch(() => {});
      console.error("🚨 HEALTH ENGINE HARD FAILURE: score=" + score + " → ai+training+embedding DISABLED");
    } catch(e) { console.warn("⚠ HEALTH ENGINE: Hard failure setFlag failed:", e); }
  } else if (status === "critical") {
    // CRITICAL → disable AI + training (not embedding)
    try {
      await setFlagAtomic("ai_enabled",       false, "auto_health_shutdown");
      await setFlagAtomic("training_enabled", false, "auto_health_training_block");
      actionsTaken.push("ai_enabled=false, training_enabled=false (auto_health_shutdown)");
      console.error("🚨 HEALTH ENGINE AUTO-SHUTDOWN: ai_enabled=false | status=" + status + " | score=" + score);
    } catch(e) { console.warn("⚠ HEALTH ENGINE: Could not setFlag ai_enabled:", e); }
  } else if (score < 0.50 && status === "degraded") {
    // DEGRADED with low score → disable training only
    try {
      await setFlagAtomic("training_enabled", false, "auto_health_training_block");
      actionsTaken.push("training_enabled=false (score=" + score + " < 0.50)");
      console.error("🚨 HEALTH ENGINE: training_enabled=false | score=" + score);
    } catch(e) { console.warn("⚠ HEALTH ENGINE: Could not setFlag training_enabled:", e); }
  }

  // HEALTHY → re-enable everything
  if (status === "healthy") {
    try {
      await setFlagAtomic("ai_enabled",       true, "auto_health_recovery");
      await setFlagAtomic("training_enabled", true, "auto_health_recovery");
      await setFlagAtomic("embedding_enabled",true, "auto_health_recovery");
      actionsTaken.push("ai_enabled=true, training_enabled=true, embedding_enabled=true (healthy recovery)");
      await logMetric("health_recovery", score, { status: "healthy" }).catch(() => {});
    } catch { /* non-blocking */ }
  }

  // Log health score to metrics
  await logMetric("health_score", score, { status }).catch(() => {});

  const result: SystemHealth = {
    score, status, auc, drift: model.drift_score,
    conversion_rate:   Math.round(convRate  * 10000) / 10000,
    training_failures: trainingFailures,
    events_last_2h:    events2h,
    ai_enabled:        status !== "critical" && status !== "failed",
    training_blocked:  score < 0.50,
    issues,
    actions_taken:     actionsTaken,
    computed_at:       Date.now()
  };

  // Persist health snapshot
  await _persistHealth(result);

  // Send alert if critical/failed
  if (status === "critical" || status === "failed") {
    await _sendAlert(result);
  }

  return result;
}

// ============================================================
// PERSIST TO DB
// ============================================================
async function _persistHealth(h: SystemHealth): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_system_health
       (auc, drift, conversion_rate, training_failures, events_last_2h,
        health_score, status, issues, ai_enabled, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [h.auc, h.drift, h.conversion_rate, h.training_failures, h.events_last_2h,
       h.score, h.status, JSON.stringify(h.issues), h.ai_enabled]
    );
  } catch { /* silent */ }
}

// ============================================================
// ALERT SYSTEM (STEP 12 PART 2)
// Sends to: console (always) + Webhook URL if configured
// ============================================================
async function _sendAlert(h: SystemHealth): Promise<void> {
  const msg = [
    `🚨 NOLIX SYSTEM ALERT`,
    `Status: ${h.status.toUpperCase()} | Score: ${h.score}`,
    `AUC: ${h.auc} | Drift: ${h.drift} | Conv: ${h.conversion_rate}`,
    `Issues:`,
    ...h.issues.map(i => `  - ${i}`)
  ].join("\n");

  console.error(msg);

  // Webhooks: Slack / Telegram / custom
  const alertUrl = process.env.NOLIX_ALERT_WEBHOOK;
  if (alertUrl) {
    try {
      await fetch(alertUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text:    msg,
          health:  h,
          channel: process.env.NOLIX_ALERT_CHANNEL || "#nolix-alerts"
        })
      });
      console.log("📢 HEALTH ALERT SENT to webhook.");
    } catch(e) { console.warn("⚠ HEALTH ALERT: Webhook failed:", e); }
  }
}

// ============================================================
// GET HEALTH HISTORY
// ============================================================
export async function getHealthHistory(limit = 48): Promise<any[]> {
  try {
    return await query(
      `SELECT * FROM nolix_system_health ORDER BY created_at DESC LIMIT $1`, [limit]
    );
  } catch { return []; }
}
