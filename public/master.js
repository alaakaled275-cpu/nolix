console.log("🔥 NOLIX BOOT START");

window.NOLIX = {
  version: "1.0",
  status: "booting",
  debug: true,
  initialized: false
};

if (window.top !== window.self) {
  console.warn("⚠ Running inside iframe (Shopify safe mode)");
}

function safeInit() {
  try {
    if (window.NOLIX.initialized) return;
    initNolix();
  } catch (err) {
    console.error("❌ NOLIX CRASH:", err);
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  safeInit();
} else {
  document.addEventListener("DOMContentLoaded", safeInit);
}

function initNolix() {
  console.log("✅ NOLIX INIT");

  window.NOLIX.status = "initialized";
  window.NOLIX.initialized = true;
  window.NOLIX.loaded_at = Date.now();
  window.NOLIX.url = window.location.href;

  // Proof of life
  window.NOLIX.ping = () => "alive";

  console.log("🧠 NOLIX READY:", window.NOLIX);
}
