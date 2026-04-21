/**
 * NOLIX — Zeno Activation State Machine (COMMAND 11)
 * lib/zeno-state-machine.ts
 */

import { query } from "@/lib/db";

export enum ZenoState {
  NEW = "NEW",
  INSTALLED = "INSTALLED",
  ACTIVE = "ACTIVE",
  LIVE = "LIVE"
}

export async function getZenoState(workspaceId: string): Promise<ZenoState> {
  // In production, we read this from user/tenant profile.
  // Mocking transition based on active events for rapid prototyping:
  const events = await query(`SELECT COUNT(*) as count FROM nolix_decision_outcomes WHERE workspace_id = $1`, [workspaceId]) as any[];
  const revenue = await query(`SELECT SUM(actual_revenue) as rev FROM nolix_decision_outcomes WHERE workspace_id = $1`, [workspaceId]) as any[];
  
  const count = Number(events[0]?.count || 0);
  const rev = Number(revenue[0]?.rev || 0);

  if (rev > 0) return ZenoState.LIVE;
  if (count > 0) return ZenoState.ACTIVE;
  if (workspaceId.startsWith("ws_")) return ZenoState.INSTALLED;
  
  return ZenoState.NEW;
}

export async function updateZenoState(workspaceId: string, state: ZenoState) {
  // Update state in DB
  await query(`UPDATE nolix_tenants SET zeno_state = $1 WHERE id = $2`, [state, workspaceId]);
}
