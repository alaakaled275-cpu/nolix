/**
 * NOLIX — Alerts & Automation Engine (COMMAND 11)
 * lib/nolix-alert-system.ts
 */

import { query } from "@/lib/db";
import { redis } from "@/lib/redis";

export interface SystemAlert {
  severity: "critical" | "warning" | "info";
  type: string;
  root_cause: string;
  recommended_action: string;
}

export async function triggerAlert(alert: SystemAlert) {
  try {
    await query(
      `INSERT INTO nolix_system_alerts (severity, type, root_cause, recommended_action, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())`,
      [alert.severity, alert.type, alert.root_cause, alert.recommended_action]
    );

    // If critical, broadcast via SSE or external webhook
    if (alert.severity === "critical") {
      console.error(`[🚨 CRITICAL ALERT] ${alert.type}: ${alert.root_cause} -> Action: ${alert.recommended_action}`);
      // Send webhook / Slack message here if integrated.
    }
  } catch (e) {
    console.error("Alert System Failed:", e);
  }
}

export async function runHealthChecks() {
  console.log("[Alert Engine] Running health diagnostics...");
  
  // 1. Revenue Drop Alert (Compared to identical previous period)
  try {
    const revStats = await query(`
      SELECT 
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN actual_revenue ELSE 0 END) as rev_24h,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours' THEN actual_revenue ELSE 0 END) as rev_48h
      FROM nolix_pricing_decisions
    `) as any[];
    
    if (revStats[0]) {
      const r24 = Number(revStats[0].rev_24h) || 0;
      const r48 = Number(revStats[0].rev_48h) || 0;
      
      if (r48 > 100 && r24 < r48 * 0.8) { // 20% drop
         await triggerAlert({
           severity: "critical",
           type: "REVENUE_DROP",
           root_cause: `Revenue dropped by ${(((r48 - r24) / r48) * 100).toFixed(1)}% in the last 24h.`,
           recommended_action: "Check traffic quality, or pause active aggressive experiments immediately."
         });
      }
    }
  } catch (e) {}

  // 2. ML Drift Warning
  try {
    const mlPerfStr = await redis.get("nolix:learning:ml_success_rate");
    if (mlPerfStr && parseFloat(mlPerfStr) < 0.2) {
       await triggerAlert({
         severity: "warning",
         type: "ML_DRIFT",
         root_cause: `ML prediction success rate is severely low (${(parseFloat(mlPerfStr) * 100).toFixed(1)}%). Context has changed.`,
         recommended_action: "Allow ZENO to rely heavier on base behavior rules until more data is learned."
       });
    }
  } catch (e) {}

  // 3. System Health Alert
  try {
    const latStats = await query(`
      SELECT AVG(latency_ms) as avg_lat
      FROM nolix_decision_outcomes
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `) as any[];

    if (latStats[0] && Number(latStats[0].avg_lat) > 500) {
       await triggerAlert({
         severity: "warning",
         type: "SYSTEM_LATENCY",
         root_cause: `Average decision latency is ${Number(latStats[0].avg_lat).toFixed(0)}ms.`,
         recommended_action: "Check Redis connection or consider scaling Edge functions."
       });
    }
  } catch(e) {}
}

export async function getActiveAlerts(): Promise<SystemAlert[]> {
  return await query(`SELECT * FROM nolix_system_alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 10`) as SystemAlert[];
}

export async function resolveAlert(id: number) {
  await query(`UPDATE nolix_system_alerts SET status = 'resolved' WHERE id = $1`, [id]);
}
