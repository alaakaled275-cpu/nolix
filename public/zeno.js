/**
 * ZENO CLIENT SCRIPT — V1.0.0 (Operator Core)
 * https://nolix.ai/zeno.js
 */

(function () {
  const currentScript = document.currentScript;
  if (!currentScript) return;

  const key = currentScript.getAttribute("data-key");
  if (!key) {
    console.error("[ZENO] Critical Error: Missing data-key. Tracking aborted.");
    return;
  }

  const endpoint = "http://localhost:3000/api/track"; // Dynamic later

  // Auto-track initial hit
  async function trackEvent(eventType, payload = {}) {
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          url: location.href,
          domain: location.hostname,
          event: eventType,
          data: payload,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      // Fail silently to prevent disrupting client storefront
    }
  }

  // Bind global commands
  window.ZenoClient = {
    identify: (userId) => trackEvent("identity", { userId }),
    sendDecision: (decision) => trackEvent("decision", decision),
    conversion: (revenue) => trackEvent("conversion", { revenue })
  };

  trackEvent("init");
  console.log("[ZENO] Connected. Intelligence active for key:", key.substring(0, 8) + "...");
})();
