/**
 * NOLIX MASTER SCRIPT v1.3 — TRACKING CORE
 * Step 2: Session System (Hardened)
 * Step 3: Behavioral Tracking Engine
 */

// ============================================================
// PHASE 1 — GLOBAL LOCK (Prevents double execution)
// ============================================================
if (window.__NOLIX_LOADED__) {
  console.warn("⚠ NOLIX: Already loaded. Duplicate execution blocked.");
} else {
  window.__NOLIX_LOADED__ = true;

  console.log("🔥 NOLIX BOOT START");

  // Read store domain from script tag attribute
  var _scriptTag = document.currentScript ||
    (function() {
      var tags = document.querySelectorAll('script[data-site]');
      return tags[tags.length - 1];
    })();
  var _storeDomain = (_scriptTag && _scriptTag.getAttribute("data-site")) || "unknown";

  // ============================================================
  // PHASE 2 — GUARANTEED GLOBAL ATTACH
  // window.NOLIX exists ALWAYS from this point forward
  // ============================================================
  window.NOLIX = {
    version: "1.3",
    status: "booting",
    debug: true,
    initialized: false,
    store: _storeDomain,
    session: null,
    tracking: null,
    ping: function() { return "alive"; }
  };

  if (window.top !== window.self) {
    console.warn("⚠ NOLIX: Running inside iframe (Shopify safe mode)");
  }

  // ============================================================
  // PHASE 3 — SAFE STORAGE LAYER (zero crash guarantee)
  // ============================================================
  var _storage = {
    get: function(key) {
      try { return localStorage.getItem(key); }
      catch(e) { console.error("❌ NOLIX STORAGE READ ERROR:", e); return null; }
    },
    set: function(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch(e) { console.error("❌ NOLIX STORAGE WRITE ERROR:", e); return false; }
    }
  };

  // ============================================================
  // PHASE 4 — SESSION ENGINE (Hardened)
  // ============================================================
  function initSession() {
    var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
    var STORAGE_KEY        = "nolix_session_id";
    var now                = Date.now();

    function generateUUID() {
      try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
      } catch(e) {}
      return now.toString(36) + "-" + Math.random().toString(36).substring(2, 10);
    }

    var sessionData = null;
    var raw = _storage.get(STORAGE_KEY);
    if (raw) {
      try { sessionData = JSON.parse(raw); }
      catch(e) { console.warn("⚠ NOLIX: Corrupted session. Resetting."); sessionData = null; }
    }

    var isNewSession = false;
    if (!sessionData || !sessionData.id || !sessionData.last_activity ||
        (now - sessionData.last_activity > SESSION_TIMEOUT_MS)) {
      sessionData = {
        id:            generateUUID(),
        started_at:    now,
        last_activity: now,
        page_views:    1,
        store:         _storeDomain
      };
      isNewSession = true;
    } else {
      sessionData.last_activity = now;
      sessionData.page_views    = (sessionData.page_views || 0) + 1;
    }

    // Memory fallback if localStorage fails
    var saved = _storage.set(STORAGE_KEY, JSON.stringify(sessionData));
    if (!saved) {
      console.warn("⚠ NOLIX: localStorage unavailable. Using memory-only session.");
    }

    window.NOLIX.session = sessionData;

    if (isNewSession) { console.log("SESSION CREATED", sessionData); }
    else              { console.log("SESSION UPDATED", sessionData); }

    // Activity update (click + scroll only — no mousemove spam)
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
      document.addEventListener("click",  updateActivity, { passive: true });
      document.addEventListener("scroll", updateActivity, { passive: true });
    } catch(e) { console.warn("⚠ NOLIX: Could not attach activity listeners:", e); }
  }

  // ============================================================
  // PHASE 5 — BEHAVIORAL TRACKING ENGINE (The Eyes)
  // ============================================================
  function initTracking() {

    // SESSION INTEGRITY GUARD (mandatory fix)
    if (!window.NOLIX.session || !window.NOLIX.session.id) {
      console.error("❌ NOLIX: SESSION NOT INITIALIZED. Tracking aborted.");
      return;
    }

    var _startTime         = Date.now();
    var _lastActiveTime    = Date.now();
    var _idleThresholdMs   = 5000;  // 5 seconds idle = idle state
    var _maxScrollDepth    = 0;
    var _clickCount        = 0;
    var _clickTimestamps   = [];
    var _isIdle            = false;
    var _exitIntentFired   = false;
    var _activeTimeMs      = 0;
    var _idleStartTime     = null;

    // Initialise the tracking object on the global
    window.NOLIX.tracking = {
      time_on_page:          0,
      active_time:           0,
      scroll_depth:          0,
      clicks:                [],
      idle:                  false,
      hesitation_score:      0,
      engagement_score:      0,
      exit_intent_triggered: false
    };

    // ---- Scroll Depth ----
    function onScroll() {
      try {
        var docH      = Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        );
        var viewH     = window.innerHeight;
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var depth     = docH > viewH ? Math.round(((scrollTop + viewH) / docH) * 100) : 100;
        if (depth > _maxScrollDepth) {
          _maxScrollDepth = depth;
          window.NOLIX.tracking.scroll_depth = _maxScrollDepth;
        }
      } catch(e) { /* silent */ }
      _lastActiveTime = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    // ---- Click Tracking ----
    function onClick() {
      _clickCount++;
      var ts = Date.now();
      _clickTimestamps.push(ts);
      // keep last 20 only
      if (_clickTimestamps.length > 20) { _clickTimestamps.shift(); }
      window.NOLIX.tracking.clicks = _clickTimestamps.slice();
      _lastActiveTime = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    // ---- Exit Intent (DESKTOP ONLY) fires ONCE per session ----
    function onMouseMove(e) {
      if (_exitIntentFired) return;
      if (e.clientY < 20) { // top 20px of viewport
        _exitIntentFired = true;
        window.NOLIX.tracking.exit_intent_triggered = true;
        console.log("🚨 NOLIX: EXIT INTENT DETECTED", {
          session_id: window.NOLIX.session.id,
          hesitation: window.NOLIX.tracking.hesitation_score,
          scroll:     window.NOLIX.tracking.scroll_depth
        });
        document.removeEventListener("mousemove", onMouseMove);
      }
      _lastActiveTime = Date.now();
    }

    // ---- Score Computation (deterministic) ----
    function computeScores() {
      var timeOnPage  = window.NOLIX.tracking.time_on_page;
      var activeTime  = window.NOLIX.tracking.active_time;
      var scrollDepth = window.NOLIX.tracking.scroll_depth;
      var clicks      = _clickCount;

      // --- Hesitation Score (0 → 1) ---
      // High hesitation = long time + few clicks + no deep scroll
      var hesitation = 0;
      if (timeOnPage > 30)  { hesitation += 0.3; }  // on page more than 30s
      if (timeOnPage > 60)  { hesitation += 0.2; }  // on page more than 60s
      if (clicks < 2 && timeOnPage > 20) { hesitation += 0.3; } // no engagement
      if (scrollDepth < 30 && timeOnPage > 30) { hesitation += 0.2; } // barely scrolled
      hesitation = Math.min(1, Math.round(hesitation * 100) / 100);

      // --- Engagement Score (0 → 1) ---
      var engagement = 0;
      if (scrollDepth >= 25) { engagement += 0.2; }
      if (scrollDepth >= 50) { engagement += 0.2; }
      if (scrollDepth >= 75) { engagement += 0.2; }
      if (clicks >= 1)       { engagement += 0.2; }
      if (clicks >= 3)       { engagement += 0.1; }
      if (activeTime > 30)   { engagement += 0.1; }
      engagement = Math.min(1, Math.round(engagement * 100) / 100);

      window.NOLIX.tracking.hesitation_score = hesitation;
      window.NOLIX.tracking.engagement_score = engagement;
    }

    // ---- 1-Second Update Loop ----
    var _loopInterval = setInterval(function() {
      var now         = Date.now();
      var elapsedSec  = Math.round((now - _startTime) / 1000);
      var idleElapsed = now - _lastActiveTime;

      window.NOLIX.tracking.time_on_page = elapsedSec;

      // Idle detection
      if (!_isIdle && idleElapsed > _idleThresholdMs) {
        _isIdle  = true;
        window.NOLIX.tracking.idle = true;
        if (!_idleStartTime) { _idleStartTime = now; }
        console.log("💤 NOLIX: USER IDLE", { idle_for_ms: idleElapsed });
      }

      // Active time accrual (only when not idle)
      if (!_isIdle) {
        _activeTimeMs += 1000;
        window.NOLIX.tracking.active_time = Math.round(_activeTimeMs / 1000);
      }

      // Recompute scores every second
      computeScores();

    }, 1000);

    // Clean up on page unload
    window.addEventListener("beforeunload", function() {
      clearInterval(_loopInterval);
    });

    // Attach listeners
    try {
      document.addEventListener("scroll",    onScroll,    { passive: true });
      document.addEventListener("click",     onClick,     { passive: true });
      document.addEventListener("mousemove", onMouseMove, { passive: true });
    } catch(e) { console.warn("⚠ NOLIX: Could not attach tracking listeners:", e); }

    console.log("👁 NOLIX TRACKING ACTIVE", window.NOLIX.tracking);
  }

  // ============================================================
  // PHASE 6 — CORE BOOT (session → tracking → ready)
  // ============================================================
  function initNolix() {
    if (window.NOLIX.initialized) return;

    console.log("✅ NOLIX INIT");

    window.NOLIX.status      = "initialized";
    window.NOLIX.initialized = true;
    window.NOLIX.loaded_at   = Date.now();
    window.NOLIX.url         = window.location.href;

    initSession();
    initTracking();

    console.log("🧠 NOLIX READY:", window.NOLIX);
  }

  // ============================================================
  // PHASE 7 — FORCE SELF-BOOTSTRAP RETRY LOOP
  // Works regardless of async/defer/Tag Manager/iframe timing
  // ============================================================
  var _retryCount = 0;
  var _maxRetries = 100; // 100 × 50ms = 5 seconds max

  function attemptBoot() {
    try {
      if (document.readyState === "complete" || document.readyState === "interactive") {
        initNolix();
      } else if (_retryCount < _maxRetries) {
        _retryCount++;
        setTimeout(attemptBoot, 50);
      } else {
        console.error("❌ NOLIX: document never became ready after 5s. Aborting.");
      }
    } catch(e) {
      console.error("❌ NOLIX CRASH during boot:", e);
      if (_retryCount < _maxRetries) {
        _retryCount++;
        setTimeout(attemptBoot, 50);
      }
    }
  }

  attemptBoot();
}
