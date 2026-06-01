import { sendEmail } from "./email"; // Fallback if Loops isn't configured

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

/**
 * System 8: Customer Success (Automations)
 * Sends targeted behavioral emails based on user actions to prevent churn
 * and guide them to their "First Result" (Activation).
 */

export async function triggerLoopsEvent(email: string, eventName: string, eventProperties: any = {}) {
  if (!LOOPS_API_KEY) {
    console.warn("[Customer Success] LOOPS_API_KEY missing. Falling back to simple email if critical.", eventName);
    return;
  }

  try {
    const res = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOOPS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        eventName,
        ...eventProperties
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Customer Success] Failed to trigger event in Loops:", err);
    }
  } catch (error) {
    console.error("[Customer Success] Error calling Loops API:", error);
  }
}

// ── Specific Drip Campaigns & Interventions ───────────────────────────────────

/**
 * Fired immediately after they install the script.
 */
export async function sendOnboardingSequence(email: string, storeDomain: string) {
  // In Loops, triggering "script_installed" starts a 3-day drip campaign
  await triggerLoopsEvent(email, "script_installed", { storeDomain });
  console.log(`[Customer Success] Started onboarding sequence for ${storeDomain}`);
}

/**
 * Fired when they get their first attributed conversion.
 * Highly boosts Activation & Trust.
 */
export async function sendFirstWinEmail(email: string, storeDomain: string, revenue: number) {
  await triggerLoopsEvent(email, "first_win", { storeDomain, revenue });
  
  // Fallback if no Loops configured
  if (!LOOPS_API_KEY) {
    await sendEmail(
      email,
      `🎉 Congratulations! Nolix just saved your first sale!`,
      `<h2>You just made $${revenue}!</h2>
       <p>Nolix AI detected a hesitating customer and successfully converted them.</p>
       <p><a href="https://nolix.ai/dashboard/audit">View the Audit Log</a></p>`
    );
  }
}

/**
 * Fired if 3 days pass and they haven't generated any revenue.
 * Prevents churn by offering manual help.
 */
export async function sendChurnPreventionEmail(email: string, storeDomain: string) {
  await triggerLoopsEvent(email, "churn_risk_3_days", { storeDomain });
}
