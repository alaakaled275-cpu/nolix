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

document.addEventListener("DOMContentLoaded", () => {
  try {
    initNolix();
  } catch (err) {
    console.error("❌ NOLIX CRASH:", err);
  }
});

function initNolix() {
  console.log("✅ NOLIX INIT");

  window.NOLIX.status = "initialized";
  window.NOLIX.initialized = true;

  // Proof of life
  window.NOLIX.ping = () => "alive";

  console.log("🧠 NOLIX READY:", window.NOLIX);
}
