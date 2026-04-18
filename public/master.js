/**
 * NOLIX MASTER SCRIPT v1.2 — PRODUCTION HARDENED
 * PHASE 1: GLOBAL LOCK
 * If already loaded, STOP immediately. Prevents any double execution.
 */
if (window.__NOLIX_LOADED__) {
  console.warn("⚠ NOLIX: Already loaded. Skipping duplicate execution.");
} else {
  window.__NOLIX_LOADED__ = true;

  console.log("🔥 NOLIX BOOT START");

  // PHASE 1 — GUARANTEED GLOBAL ATTACH
  // window.NOLIX MUST exist before ANY logic runs.
  window.NOLIX = {
    version: "1.2",
    status: "booting",
    debug: true,
    initialized: false,
    session: null,
    ping: () => "alive"
  };

  if (window.top !== window.self) {
    console.warn("⚠ NOLIX: Running inside iframe (Shopify safe mode)");
  }

  // PHASE 2 — SAFE STORAGE LAYER
  // ALL localStorage access is wrapped. ZERO crashes guaranteed.
  var _storage = {
    get: function(key) {
      try {
        return localStorage.getItem(key);
      } catch(e) {
        console.error("❌ NOLIX STORAGE READ ERROR:", e);
        return null;
      }
    },
    set: function(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch(e) {
        console.error("❌ NOLIX STORAGE WRITE ERROR:", e);
        return false;
      }
    }
  };

  // PHASE 3 — SAFE SESSION ENGINE
  function initSession() {
    var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    var STORAGE_KEY = "nolix_session_id";
    var now = Date.now();

    // UUID generation with fallback
    function generateUUID() {
      try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
      } catch(e) {}
      // Fallback: timestamp + random
      return now.toString(36) + "-" + Math.random().toString(36).substring(2, 10);
    }

    var sessionData = null;
    var raw = _storage.get(STORAGE_KEY);

    if (raw) {
      try {
        sessionData = JSON.parse(raw);
      } catch(e) {
        console.warn("⚠ NOLIX: Corrupted session data. Resetting.");
        sessionData = null;
      }
    }

    var isNewSession = false;

    // Validate session or create new one
    if (!sessionData || !sessionData.id || !sessionData.last_activity || (now - sessionData.last_activity > SESSION_TIMEOUT_MS)) {
      sessionData = {
        id: generateUUID(),
        started_at: now,
        last_activity: now,
        page_views: 1
      };
      isNewSession = true;
    } else {
      sessionData.last_activity = now;
      sessionData.page_views = (sessionData.page_views || 0) + 1;
    }

    _storage.set(STORAGE_KEY, JSON.stringify(sessionData));
    window.NOLIX.session = sessionData;

    if (isNewSession) {
      console.log("SESSION CREATED", sessionData);
    } else {
      console.log("SESSION UPDATED", sessionData);
    }

    // Activity trackers — debounced to protect main thread
    var _debounceTimer = null;
    function updateActivity() {
      if (_debounceTimer) return;
      _debounceTimer = setTimeout(function() {
        var t = Date.now();
        window.NOLIX.session.last_activity = t;
        _storage.set(STORAGE_KEY, JSON.stringify(window.NOLIX.session));
        _debounceTimer = null;
      }, 2000);
    }

    try {
      document.addEventListener("click",     updateActivity, { passive: true });
      document.addEventListener("scroll",    updateActivity, { passive: true });
      document.addEventListener("mousemove", updateActivity, { passive: true });
    } catch(e) {
      console.warn("⚠ NOLIX: Could not attach activity listeners:", e);
    }
  }

  // PHASE 4 — CORE INIT
  function initNolix() {
    if (window.NOLIX.initialized) return; // Hard guard against double-run

    console.log("✅ NOLIX INIT");

    window.NOLIX.status = "initialized";
    window.NOLIX.initialized = true;
    window.NOLIX.loaded_at = Date.now();
    window.NOLIX.url = window.location.href;

    initSession();

    console.log("🧠 NOLIX READY:", window.NOLIX);
  }

  // PHASE 5 — FORCE SELF-BOOTSTRAP with RETRY LOOP
  // Works regardless of when the script is injected (async, defer, Tag Manager, iframe).
  // Tries immediately, then retries every 50ms for up to 5 seconds.
  var _retryCount = 0;
  var _maxRetries = 100; // 100 x 50ms = 5 seconds

  function attemptBoot() {
    try {
      if (document.body) {
        initNolix();
      } else if (_retryCount < _maxRetries) {
        _retryCount++;
        setTimeout(attemptBoot, 50);
      } else {
        console.error("❌ NOLIX: document.body never became available after 5s. Aborting.");
      }
    } catch(e) {
      console.error("❌ NOLIX CRASH during boot attempt:", e);
      if (_retryCount < _maxRetries) {
        _retryCount++;
        setTimeout(attemptBoot, 50);
      }
    }
  }

  // Execute immediately
  attemptBoot();
}
