/**
 * NOLIX — Model Monitoring (STEP 15 PART 12)
 * lib/nolix-model-monitor.ts
 *
 * Enterprise ML monitoring:
 *   - AUC tracking over time
 *   - Feature drift detection (PSI — Population Stability Index)
 *   - Prediction distribution shift
 *   - Data drift alerts (Slack/webhook)
 *   - Automated rollback trigger on severe drift
 */

import { query }                     from "./db";
import { getFeatureDistribution }    from "./nolix-feature-store-v2";
import { rollbackModel }             from "./nolix-model-registry";
import { logMetric }                 from "./nolix-metrics";

export interface MonitorReport {
  model_version:       number;
  auc_current:         number;
  auc_baseline:        number;
  auc_delta:           number;
  feature_drift:       Record<string, number>;   // PSI per feature
  prediction_drift:    number;                    // prediction distribution shift
  data_volume:         number;                    // events in last 24h
  alert_level:         "green" | "yellow" | "red";
  alerts:              string[];
  auto_action_taken:   string | null;
  computed_at:         number;
}

// ── PSI (Population Stability Index) ─────────────────────────────────────────
// PSI < 0.10: no drift
// PSI 0.10-0.25: moderate drift — monitor
// PSI > 0.25: significant drift — alert
function computePSI(
  expectedDist: { mean: number; std: number },
  actualDist:   { mean: number; std: number }
): number {
  if (expectedDist.std === 0 && actualDist.std === 0) return 0;
  if (expectedDist.mean === 0) return 0;

  // Approximate PSI using mean shift in std-deviation units
  const shift   = Math.abs(actualDist.mean - expectedDist.mean);
  const poolStd = Math.sqrt((expectedDist.std ** 2 + actualDist.std ** 2) / 2) || 1;
  const psi     = Math.min(1, (shift / poolStd) * 0.1); // scale to 0–1 range

  return Math.round(psi * 10000) / 10000;
}

// ── Monitor prediction distribution ──────────────────────────────────────────
async function monitorPredictions(): Promise<number> {
  try {
    const rows = await query<any>(`
      SELECT
        AVG(predicted_probability)  AS cur_mean,
        STDDEV(predicted_probability) AS cur_std
      FROM nolix_calibration_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const curRow = (rows as any[])[0];
    if (!curRow || !curRow.cur_mean) return 0;

    const baseRows = await query<any>(`
      SELECT
        AVG(predicted_probability)   AS base_mean,
        STDDEV(predicted_probability) AS base_std
      FROM nolix_calibration_log
      WHERE created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '24 hours'
    `);
    const baseRow = (baseRows as any[])[0];
    if (!baseRow || !baseRow.base_mean) return 0;

    return computePSI(
      { mean: Number(baseRow.base_mean), std: Number(baseRow.base_std) || 0.1 },
      { mean: Number(curRow.cur_mean),   std: Number(curRow.cur_std)   || 0.1 }
    );
  } catch { return 0; }
}

// ── Full monitor run ──────────────────────────────────────────────────────────
export async function runMonitor(): Promise<MonitorReport> {
  const alerts:     string[] = [];

  // Get current model version
  let modelVersion  = 0;
  let aucCurrent    = 0.5;
  let aucBaseline   = 0.5;
  try {
    const rows = await query<any>(
      "SELECT version, auc FROM nolix_model_registry WHERE status='production' LIMIT 1"
    );
    const row = (rows as any[])[0];
    if (row) { modelVersion = Number(row.version); aucCurrent = Number(row.auc); }

    // Baseline AUC = first production model
    const baseRows = await query<any>(
      "SELECT auc FROM nolix_model_registry WHERE status='production' ORDER BY version ASC LIMIT 1"
    );
    const baseRow = (baseRows as any[])[0];
    if (baseRow) aucBaseline = Number(baseRow.auc);
  } catch {}

  const aucDelta = aucCurrent - aucBaseline;

  // Feature drift
  const last24h      = new Date(Date.now() - 24 * 60 * 60_000);
  const baselineSince = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const TRACKED_FEATURES = ["time_on_site", "pages_viewed", "scroll_depth", "hesitations"];
  const featureDrift: Record<string, number> = {};

  for (const feat of TRACKED_FEATURES) {
    try {
      const [cur, base] = await Promise.all([
        getFeatureDistribution(feat, last24h),
        getFeatureDistribution(feat, baselineSince)
      ]);
      const psi = computePSI(base, cur);
      featureDrift[feat] = psi;
      if (psi > 0.25) alerts.push(`FEATURE DRIFT: ${feat} PSI=${psi} > 0.25`);
      else if (psi > 0.10) alerts.push(`WARNING: ${feat} PSI=${psi} moderate drift`);
    } catch {}
  }

  // Prediction distribution drift
  const predictionDrift = await monitorPredictions();
  if (predictionDrift > 0.25) alerts.push(`PREDICTION DRIFT: PSI=${predictionDrift} > 0.25`);

  // Data volume check
  let dataVolume = 0;
  try {
    const r = await query<any>(
      "SELECT COUNT(*) as cnt FROM nolix_feature_snapshots WHERE created_at > NOW() - INTERVAL '24 hours'"
    );
    dataVolume = Number((r as any[])[0]?.cnt) || 0;
    if (dataVolume < 10) alerts.push(`LOW DATA VOLUME: only ${dataVolume} events in last 24h`);
  } catch {}

  // AUC degradation
  if (aucDelta < -0.05) alerts.push(`AUC DEGRADED: current=${aucCurrent.toFixed(3)} baseline=${aucBaseline.toFixed(3)}`);

  // Determine alert level
  const hasSevere  = alerts.some(a => a.includes("DRIFT") && !a.includes("WARNING"));
  const hasWarning = alerts.length > 0;

  const alertLevel: MonitorReport["alert_level"] =
    hasSevere   ? "red" :
    hasWarning  ? "yellow" : "green";

  // Auto-action on red
  let autoActionTaken: string | null = null;
  if (alertLevel === "red" && aucDelta < -0.08) {
    const rollback = await rollbackModel("auto_monitor_severe_drift").catch(() => null);
    if (rollback) {
      autoActionTaken = `AUTO_ROLLBACK to v${rollback.rolled_back_to} (AUC delta=${aucDelta.toFixed(3)})`;
      alerts.push(autoActionTaken);
    }
  }

  // Send webhook alert
  if (alertLevel !== "green") {
    const webhook = process.env.NOLIX_ALERT_WEBHOOK;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text: `🔬 NOLIX MONITOR [${alertLevel.toUpperCase()}]\n` + alerts.join("\n"),
          alert_level: alertLevel, alerts, model_version: modelVersion, auc_current: aucCurrent
        })
      }).catch(() => {});
    }
  }

  // Persist report
  const report: MonitorReport = {
    model_version: modelVersion, auc_current: aucCurrent, auc_baseline: aucBaseline,
    auc_delta: Math.round(aucDelta * 10000) / 10000,
    feature_drift: featureDrift, prediction_drift: predictionDrift, data_volume: dataVolume,
    alert_level: alertLevel, alerts, auto_action_taken: autoActionTaken, computed_at: Date.now()
  };

  await query(
    "INSERT INTO nolix_monitor_reports (report_json, alert_level, model_version, computed_at) VALUES ($1,$2,$3,NOW())",
    [JSON.stringify(report), alertLevel, modelVersion]
  ).catch(() => {});

  await logMetric("monitor_auc", aucCurrent, { alert_level: alertLevel }).catch(() => {});
  return report;
}

// ── Get latest monitor report ─────────────────────────────────────────────────
export async function getLatestMonitorReport(): Promise<MonitorReport | null> {
  try {
    const rows = await query<any>(
      "SELECT report_json FROM nolix_monitor_reports ORDER BY computed_at DESC LIMIT 1"
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    return typeof row.report_json === "string" ? JSON.parse(row.report_json) : row.report_json;
  } catch { return null; }
}
