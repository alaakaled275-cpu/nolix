import { query } from "./db";
import { redis } from "./redis";

export interface OnboardingSession {
  id: string;
  workspace_id: string;
  status: string;
  steps_completed: Record<string, boolean>;
  is_demo: boolean;
  started_at: number;
}

export interface NextActionHint {
  next_step: string;
  ui_hint: string;
  blocked_reason: string | null;
  fix_suggestion?: string;
}

const STEPS_ORDER = ["install_script", "send_event", "first_decision", "view_dashboard"];

const HINTS: Record<string, { ui_hint: string; }> = {
  install_script: { ui_hint: "Copy this script into your site header" },
  send_event: { ui_hint: "Open your site to trigger the first event check" },
  first_decision: { ui_hint: "Click 'Simulate Live Decision' to see ZENO's logic" },
  view_dashboard: { ui_hint: "Navigate to the Analyst Dashboard to view real-time data" }
};

export async function startOnboarding(workspace_id: string, options?: { demo: boolean }) {
  const session_id = crypto.randomUUID();
  const is_demo = options?.demo || false;
  
  await query(
    `INSERT INTO nolix_onboarding_sessions (id, workspace_id, status, steps_completed)
     VALUES ($1, $2, $3, $4)`,
    [session_id, workspace_id, "started", JSON.stringify({ is_demo })]
  );
  
  return { session_id, workspace_id, is_demo, next_action: await getNextAction(session_id) };
}

export async function markStepCompleted(session_id: string | null, workspace_id: string | null, step_id: string) {
  try {
    let session: any = null;

    if (session_id) {
      session = (await query(`SELECT * FROM nolix_onboarding_sessions WHERE id = $1`, [session_id]))[0];
    } else if (workspace_id) {
      session = (await query(`SELECT * FROM nolix_onboarding_sessions WHERE workspace_id = $1 ORDER BY started_at DESC LIMIT 1`, [workspace_id]))[0];
    }

    if (!session) return;
    
    const steps = session.steps_completed || {};
    if (steps[step_id]) return; // Already done

    // Enforce Sequential Flow if NOT demo mode
    if (!steps.is_demo) {
      const idx = STEPS_ORDER.indexOf(step_id);
      if (idx > 0 && !steps[STEPS_ORDER[idx - 1]]) {
        throw new Error(`Strict flow enforced: Cannot complete '${step_id}' before '${STEPS_ORDER[idx - 1]}'`);
      }
    }

    steps[step_id] = true;
    const newStatus = step_id === "view_dashboard" ? "completed" : step_id;
    
    await query(
      `UPDATE nolix_onboarding_sessions SET steps_completed = $1, status = $2, completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END WHERE id = $3`,
      [JSON.stringify(steps), newStatus, session.id]
    );

    // If completed, metric tracking
    if (newStatus === "completed") {
       await query(
         `INSERT INTO nolix_onboarding_metrics (session_id, time_to_first_event, time_to_first_decision, completion_rate)
          VALUES ($1, $2, $3, $4)`,
         [
           session.id, 
           session.steps_completed?.time_to_first_event || 0,
           session.steps_completed?.time_to_first_decision || 0,
           1.0
         ]
       );
    }

    // Emit Real-time SSE Pulse
    if (redis) {
      await redis.publish("zeno_onboarding", JSON.stringify({ session_id: session.id, step: step_id, status: "completed" }));
    }

    return true;
  } catch (e: any) {
    console.warn("[Onboarding] Error marking step:", e.message);
    return false;
  }
}

export async function getNextAction(session_id: string): Promise<NextActionHint> {
  const session = (await query(`SELECT * FROM nolix_onboarding_sessions WHERE id = $1`, [session_id]))[0] as any;
  if (!session) return { next_step: "none", ui_hint: "Session not found", blocked_reason: "Invalid Session" };

  const steps = session.steps_completed || {};
  if (session.status === "completed") return { next_step: "completed", ui_hint: "Setup successful!", blocked_reason: null };

  let next_step = STEPS_ORDER[0];
  for (const s of STEPS_ORDER) {
    if (!steps[s]) { next_step = s; break; }
  }

  const failures = detectFailures(session);

  return {
    next_step,
    ui_hint: HINTS[next_step]?.ui_hint || "Proceed with next step",
    blocked_reason: failures?.reason || null,
    fix_suggestion: failures?.fix || undefined
  };
}

export async function evaluateOnboardingProgress(session_id: string) {
  const session = (await query(`SELECT * FROM nolix_onboarding_sessions WHERE id = $1`, [session_id]))[0] as any;
  if (!session) throw new Error("Not found");

  const steps = session.steps_completed || {};
  const completedCount = STEPS_ORDER.filter(s => steps[s]).length;

  return {
    completion_pct: Math.round((completedCount / STEPS_ORDER.length) * 100),
    missing_steps: STEPS_ORDER.filter(s => !steps[s]),
    next_action: await getNextAction(session_id),
    status: session.status
  };
}

// Internal failure detection
function detectFailures(session: any) {
  const timeActive = Date.now() - new Date(session.started_at).getTime();
  const steps = session.steps_completed || {};

  if (!steps["send_event"] && timeActive > 5 * 60 * 1000) { // 5 mins waiting for event
    return { reason: "No events detected from script", fix: "Make sure script is installed correctly and ad-blockers are disabled" };
  }

  if (steps["send_event"] && !steps["first_decision"] && timeActive > 10 * 60 * 1000) {
    return { reason: "No valid decisions triggered", fix: "Traffic might be too low. Use 'Simulate' or trigger rules." };
  }

  return null;
}
