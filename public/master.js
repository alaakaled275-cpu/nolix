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

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function initSession() {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const STORAGE_KEY = "nolix_session_id";
  const now = Date.now();
  
  let sessionData = null;
  const storedValue = localStorage.getItem(STORAGE_KEY);
  
  if (storedValue) {
    try {
      sessionData = JSON.parse(storedValue);
    } catch(e) {
      console.warn("NOLIX: Could not parse previous session data.");
    }
  }
  
  let isNewSession = false;
  
  // Check if session exists AND hasn't expired
  if (!sessionData || !sessionData.last_activity || (now - sessionData.last_activity > SESSION_TIMEOUT_MS)) {
    // Create new session
    sessionData = {
      id: generateUUID(),
      started_at: now,
      last_activity: now,
      page_views: 1
    };
    isNewSession = true;
  } else {
    // Reuse session
    sessionData.last_activity = now;
    sessionData.page_views += 1;
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  window.NOLIX.session = sessionData;
  
  if (window.NOLIX.debug) {
    if (isNewSession) {
      console.log("SESSION CREATED", sessionData);
    } else {
      console.log("SESSION UPDATED", sessionData);
    }
  }
  
  // Activity Tracker
  function updateActivity() {
    const timeNow = Date.now();
    window.NOLIX.session.last_activity = timeNow;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.NOLIX.session));
  }
  
  // Debounce to prevent blocking the main thread heavily
  let timeoutId = null;
  function debounceUpdate() {
    if (timeoutId) return;
    timeoutId = setTimeout(() => {
      updateActivity();
      timeoutId = null;
    }, 2000); 
  }
  
  document.addEventListener("click", debounceUpdate, { passive: true });
  document.addEventListener("scroll", debounceUpdate, { passive: true });
  document.addEventListener("mousemove", debounceUpdate, { passive: true });
}

function initNolix() {
  console.log("✅ NOLIX INIT");

  window.NOLIX.status = "initialized";
  window.NOLIX.initialized = true;
  window.NOLIX.loaded_at = Date.now();
  window.NOLIX.url = window.location.href;

  // Initialize Session Tracking
  initSession();

  // Proof of life
  window.NOLIX.ping = () => "alive";

  console.log("🧠 NOLIX READY:", window.NOLIX);
}
