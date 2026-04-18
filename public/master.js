/**
 * NOLIX MASTER SCRIPT v1.4 — DECISION ENGINE + EVENT PIPELINE
 * Step 2: Session System (Hardened)
 * Step 3: Behavioral Tracking Engine
 * Step 4: Decision Engine + Popup Action + Event Log
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
    version: "1.4",
    status: "booting",
    debug: true,
    initialized: false,
    store: _storeDomain,
    session: null,
    tracking: null,
    decision: null,
    events: [],
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
  // PHASE 4 — EVENT PIPELINE
  // All important actions are logged to window.NOLIX.events
  // ============================================================
  function pushEvent(type, data) {
    var event = Object.assign({ type: type, timestamp: Date.now() }, data || {});
    window.NOLIX.events.push(event);
    if (window.NOLIX.debug) {
      console.log("📡 NOLIX EVENT:", event);
    }
  }

  // ============================================================
  // PHASE 5 — SESSION ENGINE (Hardened)
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
      window.NOLIX.session = sessionData; // memory fallback
    } else {
      window.NOLIX.session = sessionData;
    }

    if (isNewSession) { console.log("SESSION CREATED", sessionData); }
    else              { console.log("SESSION UPDATED", sessionData); }

    // Activity update (click + scroll ONLY — no mousemove spam)
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
  // PHASE 6 — BEHAVIORAL TRACKING ENGINE
  // ============================================================
  function initTracking() {

    // SESSION INTEGRITY GUARD — ABORT if session is missing
    if (!window.NOLIX.session || !window.NOLIX.session.id) {
      console.error("❌ NOLIX: SESSION NOT INITIALIZED. Tracking aborted.");
      return;
    }

    var _startTime       = Date.now();
    var _lastActiveTime  = Date.now();
    var _idleThresholdMs = 5000;
    var _maxScrollDepth  = 0;
    var _clickCount      = 0;
    var _clickTimestamps = [];
    var _isIdle          = false;
    var _exitIntentFired = false;
    var _activeTimeMs    = 0;

    // Tracking started timestamp (mandatory fix)
    window.NOLIX.tracking_started_at = Date.now();

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
      if (_clickTimestamps.length > 20) { _clickTimestamps.shift(); }
      window.NOLIX.tracking.clicks = _clickTimestamps.slice();
      _lastActiveTime = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    // ---- Throttled MouseMove (200ms) for exit intent only ----
    var _lastMove = 0;
    function onMouseMove(e) {
      var now = Date.now();
      if (now - _lastMove < 200) return; // throttle: max 5x per second
      _lastMove = now;
      if (_exitIntentFired) return;
      if (e.clientY < 20) {
        triggerExitIntent();
      }
    }

    // ---- Exit Intent ----
    function triggerExitIntent() {
      if (_exitIntentFired) return;
      _exitIntentFired = true;
      window.NOLIX.tracking.exit_intent_triggered = true;
      console.log("🚨 NOLIX: EXIT INTENT DETECTED", {
        session_id: window.NOLIX.session.id,
        hesitation: window.NOLIX.tracking.hesitation_score,
        scroll:     window.NOLIX.tracking.scroll_depth
      });
      pushEvent("exit_intent", {
        hesitation_score: window.NOLIX.tracking.hesitation_score,
        scroll_depth:     window.NOLIX.tracking.scroll_depth
      });
      // Trigger decision engine immediately on exit intent
      runDecisionEngine();
    }

    // ---- Score Computation (deterministic) ----
    function computeScores() {
      var timeOnPage  = window.NOLIX.tracking.time_on_page;
      var activeTime  = window.NOLIX.tracking.active_time;
      var scrollDepth = window.NOLIX.tracking.scroll_depth;
      var clicks      = _clickCount;

      // --- Hesitation Score (0 → 1) ---
      // Tuned: triggers faster (20s instead of 30s)
      var hesitation = 0;
      if (timeOnPage > 20)  { hesitation += 0.3; }  // Fixed: was 30, now 20
      if (timeOnPage > 60)  { hesitation += 0.2; }
      if (clicks < 2 && timeOnPage > 20) { hesitation += 0.3; }
      if (scrollDepth < 30 && timeOnPage > 20) { hesitation += 0.2; }
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
      var now        = Date.now();
      var elapsedSec = Math.round((now - _startTime) / 1000);
      var idleElapsed = now - _lastActiveTime;

      window.NOLIX.tracking.time_on_page = elapsedSec;

      if (!_isIdle && idleElapsed > _idleThresholdMs) {
        _isIdle = true;
        window.NOLIX.tracking.idle = true;
        console.log("💤 NOLIX: USER IDLE", { idle_for_ms: idleElapsed });
      }

      if (!_isIdle) {
        _activeTimeMs += 1000;
        window.NOLIX.tracking.active_time = Math.round(_activeTimeMs / 1000);
      }

      computeScores();

      // Run decision engine every second (it self-guards against double firing)
      runDecisionEngine();

    }, 1000);

    window.addEventListener("beforeunload", function() {
      clearInterval(_loopInterval);
    });

    // Attach listeners — click + scroll + throttled mousemove
    try {
      document.addEventListener("scroll",    onScroll,    { passive: true });
      document.addEventListener("click",     onClick,     { passive: true });
      document.addEventListener("mousemove", onMouseMove, { passive: true });
      // visibilitychange + pagehide as fallback exit intent
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState === "hidden") { triggerExitIntent(); }
      });
      window.addEventListener("pagehide", triggerExitIntent, { passive: true });
    } catch(e) { console.warn("⚠ NOLIX: Could not attach tracking listeners:", e); }

    console.log("👁 NOLIX TRACKING ACTIVE", window.NOLIX.tracking);
  }

  // ============================================================
  // PHASE 7 — DECISION ENGINE
  // ============================================================
  function runDecisionEngine() {

    // SAFETY GUARD: session must exist
    if (!window.NOLIX.session || !window.NOLIX.session.id) return;
    // SAFETY GUARD: tracking must exist
    if (!window.NOLIX.tracking) return;
    // ONE decision per session — never override after firing
    if (window.NOLIX.decision && window.NOLIX.decision.fired) return;

    var t  = window.NOLIX.tracking;
    var hs = t.hesitation_score;
    var es = t.engagement_score;
    var tp = t.time_on_page;
    var cl = t.clicks.length;
    var ex = t.exit_intent_triggered;

    var userType = "cold";
    var action   = "none";
    var reason   = "insufficient_signals";

    // ---- Decision Logic (Strict Priority) ----

    // Priority 1: Exit intent with hesitation → immediate discount
    if (ex && hs >= 0.4) {
      userType = "hesitant";
      action   = "discount";
      reason   = "exit_intent_with_hesitation";
    }
    // Priority 2: High hesitation + time on page
    else if (hs >= 0.6 && tp > 25) {
      userType = "hesitant";
      action   = "discount";
      reason   = "high_hesitation_long_session";
    }
    // Priority 3: Ready to buy — do NOT interrupt
    else if (es >= 0.6 && cl >= 2) {
      userType = "ready";
      action   = "none";
      reason   = "high_engagement_active_user";
    }
    // Default: cold
    else {
      return; // Not enough signal yet — wait
    }

    // Lock decision — ONLY ONE per session
    window.NOLIX.decision = {
      user_type: userType,
      action:    action,
      reason:    reason,
      fired:     true,
      fired_at:  Date.now()
    };

    console.log("⚡ NOLIX DECISION:", window.NOLIX.decision);

    pushEvent("decision_fired", {
      user_type:        userType,
      action:           action,
      reason:           reason,
      hesitation_score: hs,
      engagement_score: es,
      time_on_page:     tp
    });

    // Execute the action
    if (action === "discount") {
      // Anti-spam: only show if user is not actively clicking
      if (cl >= 5 && !ex) {
        console.log("⚠ NOLIX: Skipping popup. User is actively engaged (anti-spam).");
        return;
      }
      showDiscountPopup();
    }
  }

  // ============================================================
  // PHASE 8 — ACTION ENGINE (Real Popup UI)
  // ============================================================
  function showDiscountPopup() {

    var POPUP_KEY = "nolix_popup_shown_" + window.NOLIX.session.id;

    // Anti-spam: only show once per session
    if (_storage.get(POPUP_KEY)) {
      console.log("⚠ NOLIX: Popup already shown this session. Skipping.");
      return;
    }

    _storage.set(POPUP_KEY, "1");
    pushEvent("popup_shown", { session_id: window.NOLIX.session.id });

    // ---- Build Popup DOM ----
    var overlay = document.createElement("div");
    overlay.id = "nolix-popup-overlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(0,0,0,0.55)",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:16px",
      "box-sizing:border-box",
      "opacity:0",
      "transition:opacity 0.3s ease"
    ].join(";");

    var popup = document.createElement("div");
    popup.id = "nolix-popup";
    popup.style.cssText = [
      "background:#fff",
      "border-radius:16px",
      "padding:32px 28px 28px",
      "max-width:420px",
      "width:100%",
      "box-shadow:0 20px 60px rgba(0,0,0,0.3)",
      "position:relative",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "text-align:center",
      "transform:translateY(20px)",
      "transition:transform 0.3s ease",
      "box-sizing:border-box"
    ].join(";");

    popup.innerHTML = [
      '<button id="nolix-close" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#999;line-height:1;">&#x2715;</button>',
      '<div style="font-size:42px;margin-bottom:12px;">👀</div>',
      '<h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111;">واضح إنك متردد</h2>',
      '<p style="margin:0 0 22px;font-size:15px;color:#555;line-height:1.6;">خد خصم <strong style="color:#e53e3e;">10%</strong> لو كملت الطلب خلال 5 دقائق</p>',
      '<div id="nolix-timer" style="font-size:28px;font-weight:700;color:#e53e3e;margin-bottom:20px;letter-spacing:2px;">05:00</div>',
      '<button id="nolix-cta" style="background:#e53e3e;color:#fff;border:none;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:700;cursor:pointer;width:100%;transition:background 0.2s;">استخدم الخصم الآن</button>',
      '<p style="margin:12px 0 0;font-size:12px;color:#aaa;">العرض ينتهي قريباً</p>'
    ].join("");

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });
    });

    // ---- Countdown Timer ----
    var _seconds = 5 * 60;
    var _timerEl = document.getElementById("nolix-timer");
    var _timerInterval = setInterval(function() {
      _seconds--;
      if (_seconds <= 0) {
        clearInterval(_timerInterval);
        closePopup();
        return;
      }
      var m = Math.floor(_seconds / 60);
      var s = _seconds % 60;
      if (_timerEl) {
        _timerEl.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
      }
    }, 1000);

    // ---- Close Logic ----
    function closePopup() {
      clearInterval(_timerInterval);
      overlay.style.opacity = "0";
      popup.style.transform = "translateY(20px)";
      setTimeout(function() {
        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      }, 300);
      pushEvent("popup_closed", { session_id: window.NOLIX.session.id });
    }

    // ---- Event Bindings ----
    var closeBtn = document.getElementById("nolix-close");
    var ctaBtn   = document.getElementById("nolix-cta");

    if (closeBtn) {
      closeBtn.addEventListener("click", function() {
        closePopup();
        pushEvent("popup_dismissed", { session_id: window.NOLIX.session.id });
      });
    }

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function() {
        pushEvent("popup_clicked", {
          session_id: window.NOLIX.session.id,
          action:     "cta_discount"
        });
        console.log("💰 NOLIX: CTA CLICKED — Discount accepted");
        closePopup();
        // Future: trigger attribution / API call here
      });
    }

    // Close on overlay click (outside popup)
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) {
        closePopup();
        pushEvent("popup_dismissed", { session_id: window.NOLIX.session.id });
      }
    });

    console.log("🎯 NOLIX POPUP SHOWN", { session: window.NOLIX.session.id });
  }

  // ============================================================
  // PHASE 9 — CORE BOOT
  // ============================================================
  function initNolix() {
    if (window.NOLIX.initialized) return;

    console.log("✅ NOLIX INIT");

    window.NOLIX.status      = "initialized";
    window.NOLIX.initialized = true;
    window.NOLIX.loaded_at   = Date.now();
    window.NOLIX.url         = window.location.href;
    window.NOLIX.decision    = { user_type: null, action: null, reason: null, fired: false };

    initSession();
    initTracking();

    console.log("🧠 NOLIX READY:", window.NOLIX);
  }

  // ============================================================
  // PHASE 10 — FORCE SELF-BOOTSTRAP RETRY LOOP
  // ============================================================
  var _retryCount = 0;
  var _maxRetries = 100;

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
