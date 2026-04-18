/**
 * NOLIX MASTER SCRIPT v1.6 — AI DECISION FEEDBACK LOOP
 * Step 2: Session System
 * Step 3: Behavioral Tracking Engine
 * Step 4: Decision Engine + Popup + Event Log
 * Step 5: API Layer + Coupon Engine + Attribution
 * Step 6: AI Learning Engine + Per-Visitor Identity + Feedback Loop
 */

// ============================================================
// PHASE 1 — GLOBAL LOCK
// ============================================================
if (window.__NOLIX_LOADED__) {
  console.warn("⚠ NOLIX: Already loaded. Duplicate execution blocked.");
} else {
  window.__NOLIX_LOADED__ = true;

  console.log("🔥 NOLIX BOOT START");

  var _scriptTag = document.currentScript ||
    (function() {
      var tags = document.querySelectorAll('script[data-site]');
      return tags[tags.length - 1];
    })();
  var _storeDomain = (_scriptTag && _scriptTag.getAttribute("data-site")) || "unknown";

  // ============================================================
  // PHASE 2 — GUARANTEED GLOBAL ATTACH
  // ============================================================
  window.NOLIX = {
    version: "1.6",
    status: "booting",
    debug: true,
    initialized: false,
    store: _storeDomain,
    visitor: null,   // STEP 6: Persistent visitor identity (survives 30min timeout)
    session: null,   // Session (resets after 30min inactivity)
    tracking: null,
    decision: null,
    events: [],
    ping: function() { return "alive"; }
  };

  if (window.top !== window.self) {
    console.warn("⚠ NOLIX: Running inside iframe (Shopify safe mode)");
  }

  // ============================================================
  // PHASE 3 — SAFE STORAGE LAYER
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
  // ============================================================
  function pushEvent(type, data) {
    var event = Object.assign({ type: type, timestamp: Date.now() }, data || {});
    window.NOLIX.events.push(event);
    if (window.NOLIX.debug) { console.log("📡 NOLIX EVENT:", event); }
  }

  // ============================================================
  // PHASE 5 — API LAYER
  // ============================================================
  window.NOLIX.api = {
    endpoint: "https://nolix-koe6.vercel.app/api/track",

    send: async function(eventType, payload) {
      try {
        await fetch(this.endpoint, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event:    eventType,
            visitor:  window.NOLIX.visitor,
            session:  window.NOLIX.session,
            tracking: window.NOLIX.tracking,
            decision: window.NOLIX.decision,
            payload:  payload || {},
            timestamp: Date.now()
          })
        });
        console.log("✅ NOLIX API SENT:", eventType);
      } catch(e) {
        console.warn("⚠ NOLIX API FAIL (offline fallback):", e);
      }
    }
  };

  // ============================================================
  // PHASE 6 — STEP 6: VISITOR IDENTITY ENGINE
  // Persists FOREVER (not reset after 30min like session)
  // Tracks: all visits, all conversions, coupon abuse patterns
  // ============================================================
  function initVisitor() {
    var VISITOR_KEY = "nolix_visitor_id";
    var VISITOR_DATA_KEY = "nolix_visitor_data";

    function generateUUID() {
      try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
      } catch(e) {}
      return Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 10);
    }

    // Get or create permanent visitor_id
    var visitorId = _storage.get(VISITOR_KEY);
    if (!visitorId) {
      visitorId = generateUUID();
      _storage.set(VISITOR_KEY, visitorId);
    }

    // Load or init visitor persistent data
    var visitorData = null;
    var raw = _storage.get(VISITOR_DATA_KEY + "_" + visitorId);
    if (raw) {
      try { visitorData = JSON.parse(raw); }
      catch(e) { visitorData = null; }
    }

    var now = Date.now();
    var today = new Date().toISOString().split("T")[0];

    if (!visitorData) {
      visitorData = {
        id:                  visitorId,
        store:               _storeDomain,
        first_seen:          now,
        visit_count:         1,
        visits_today:        1,
        last_visit:          now,
        last_visit_date:     today,
        total_sessions:      1,
        coupons_issued:      [],
        conversion_attempts: 0,
        rejections:          0,
        coupon_abuse_flag:   false,
        discount_history:    []
      };
    } else {
      // Update visit stats
      visitorData.visit_count++;
      visitorData.total_sessions++;

      if (visitorData.last_visit_date === today) {
        visitorData.visits_today++;
      } else {
        visitorData.visits_today = 1;
        visitorData.last_visit_date = today;
      }

      visitorData.last_visit = now;

      // 🧠 DETECT COUPON ABUSE: Visitor came back after taking a discount
      if (visitorData.coupons_issued.length > 0) {
        var lastCoupon = visitorData.coupons_issued[visitorData.coupons_issued.length - 1];
        var timeSinceCoupon = now - lastCoupon.issued_at;
        var thirtyMinutes = 30 * 60 * 1000;

        if (timeSinceCoupon < thirtyMinutes) {
          visitorData.coupon_abuse_flag = true;
          console.warn("⚠ NOLIX: COUPON ABUSE DETECTED. Visitor returned within 30min of discount.", {
            visitor_id: visitorId,
            last_coupon: lastCoupon.code,
            time_since_coupon_ms: timeSinceCoupon
          });
        } else {
          // Reset abuse flag if enough time has passed
          visitorData.coupon_abuse_flag = false;
        }
      }
    }

    _storage.set(VISITOR_DATA_KEY + "_" + visitorId, JSON.stringify(visitorData));
    window.NOLIX.visitor = visitorData;

    console.log("👤 NOLIX VISITOR:", {
      id:            visitorData.id,
      visit_count:   visitorData.visit_count,
      visits_today:  visitorData.visits_today,
      coupon_abuse:  visitorData.coupon_abuse_flag,
      coupons_issued: visitorData.coupons_issued.length
    });
  }

  // Helper to save updated visitor data
  function saveVisitor() {
    if (!window.NOLIX.visitor) return;
    var VISITOR_DATA_KEY = "nolix_visitor_data";
    _storage.set(VISITOR_DATA_KEY + "_" + window.NOLIX.visitor.id, JSON.stringify(window.NOLIX.visitor));
  }

  // ============================================================
  // PHASE 7 — STEP 6: FEEDBACK STORAGE ENGINE
  // Per-visitor, never mixed with other visitors' data
  // ============================================================
  window.NOLIX.feedback = {
    _key: function() {
      return "nolix_feedback_" + (window.NOLIX.visitor ? window.NOLIX.visitor.id : "unknown");
    },

    save: function(data) {
      var key      = this._key();
      var existing = [];
      var raw      = _storage.get(key);
      if (raw) { try { existing = JSON.parse(raw); } catch(e) {} }
      existing.push(data);
      _storage.set(key, JSON.stringify(existing));
    },

    getAll: function() {
      var key = this._key();
      var raw = _storage.get(key);
      if (!raw) return [];
      try { return JSON.parse(raw); } catch(e) { return []; }
    }
  };

  // ============================================================
  // PHASE 8 — STEP 6: AI LEARNING ENGINE
  // Learns from per-visitor conversion history
  // ============================================================
  window.NOLIX.learning = {
    // Weights are per-visitor, loaded/saved from visitor data
    weights: {
      hesitation_threshold: 0.5,
      engagement_threshold: 0.6
    },

    load: function() {
      if (window.NOLIX.visitor && window.NOLIX.visitor.learning_weights) {
        this.weights = window.NOLIX.visitor.learning_weights;
        console.log("🧠 NOLIX: Loaded visitor learning weights:", this.weights);
      }
    },

    save: function() {
      if (window.NOLIX.visitor) {
        window.NOLIX.visitor.learning_weights = this.weights;
        saveVisitor();
      }
    },

    adjust: function() {
      var data        = window.NOLIX.feedback.getAll();
      var conversions = data.filter(function(d) { return d.event === "conversion_attempt"; }).length;
      var rejections  = data.filter(function(d) { return d.event === "conversion_rejected"; }).length;
      var total       = conversions + rejections;

      if (total < 5) {
        console.log("🧠 NOLIX LEARNING: Not enough data yet (" + total + "/5)");
        return;
      }

      var conversionRate = conversions / total;

      console.log("📊 NOLIX LEARNING:", {
        conversions:    conversions,
        rejections:     rejections,
        conversionRate: Math.round(conversionRate * 100) + "%",
        visitor_id:     window.NOLIX.visitor ? window.NOLIX.visitor.id : "unknown"
      });

      // Too many irrelevant popups → become less aggressive
      if (conversionRate < 0.3) {
        this.weights.hesitation_threshold += 0.05;
        this.weights.engagement_threshold += 0.05;
        console.log("⬆ NOLIX: Increasing thresholds (less aggressive):", this.weights);
      }

      // Strong conversions → become more aggressive
      if (conversionRate > 0.6) {
        this.weights.hesitation_threshold -= 0.05;
        this.weights.engagement_threshold -= 0.05;
        console.log("⬇ NOLIX: Decreasing thresholds (more aggressive):", this.weights);
      }

      // Clamp to safe bounds
      this.weights.hesitation_threshold = Math.max(0.2, Math.min(0.9, this.weights.hesitation_threshold));
      this.weights.engagement_threshold = Math.max(0.2, Math.min(0.9, this.weights.engagement_threshold));

      // Save updated weights to visitor profile
      this.save();
    }
  };

  // ============================================================
  // PHASE 9 — COUPON ENGINE
  // ============================================================
  window.NOLIX.coupon = {
    generate: function(type) {
      // Block coupon abuse (visitor returned too soon for another discount)
      if (window.NOLIX.visitor && window.NOLIX.visitor.coupon_abuse_flag) {
        console.warn("🚫 NOLIX: Coupon blocked — abuse pattern detected for visitor:", window.NOLIX.visitor.id);
        return null;
      }

      var visitorSegment = window.NOLIX.visitor
        ? window.NOLIX.visitor.id.substring(0, 6).toUpperCase()
        : window.NOLIX.session.id.substring(0, 6).toUpperCase();

      var discountCode = "NOLIX-" + visitorSegment;
      var expiry       = Date.now() + (5 * 60 * 1000);

      var coupon = {
        code:       discountCode,
        type:       type || "discount_10",
        expires_at: expiry,
        used:       false,
        store:      _storeDomain,
        session_id: window.NOLIX.session ? window.NOLIX.session.id : null,
        visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
        issued_at:  Date.now()
      };

      // Save in session storage
      _storage.set("nolix_coupon_" + window.NOLIX.session.id, JSON.stringify(coupon));

      // Record in visitor profile history
      if (window.NOLIX.visitor) {
        window.NOLIX.visitor.coupons_issued.push({
          code:      coupon.code,
          issued_at: coupon.issued_at,
          expires_at: coupon.expires_at
        });
        saveVisitor();
      }

      console.log("🎟 NOLIX COUPON GENERATED:", coupon);
      return coupon;
    },

    get: function() {
      try {
        var raw = _storage.get("nolix_coupon_" + (window.NOLIX.session ? window.NOLIX.session.id : ""));
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    }
  };

  // ============================================================
  // PHASE 10 — SESSION ENGINE (Hardened)
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
      catch(e) { sessionData = null; }
    }

    var isNewSession = false;
    if (!sessionData || !sessionData.id || !sessionData.last_activity ||
        (now - sessionData.last_activity > SESSION_TIMEOUT_MS)) {
      sessionData = {
        id:            generateUUID(),
        visitor_id:    window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
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

    var saved = _storage.set(STORAGE_KEY, JSON.stringify(sessionData));
    if (!saved) { console.warn("⚠ NOLIX: localStorage unavailable. Memory-only session."); }
    window.NOLIX.session = sessionData;

    if (isNewSession) { console.log("SESSION CREATED", sessionData); }
    else              { console.log("SESSION UPDATED", sessionData); }

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
    } catch(e) {}
  }

  // ============================================================
  // PHASE 11 — BEHAVIORAL TRACKING ENGINE
  // ============================================================
  function initTracking() {
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

    function onScroll() {
      try {
        var docH      = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
        var viewH     = window.innerHeight;
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var depth     = docH > viewH ? Math.round(((scrollTop + viewH) / docH) * 100) : 100;
        if (depth > _maxScrollDepth) {
          _maxScrollDepth = depth;
          window.NOLIX.tracking.scroll_depth = _maxScrollDepth;
        }
      } catch(e) {}
      _lastActiveTime = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    function onClick() {
      _clickCount++;
      var ts = Date.now();
      _clickTimestamps.push(ts);
      if (_clickTimestamps.length > 20) { _clickTimestamps.shift(); }
      window.NOLIX.tracking.clicks = _clickTimestamps.slice();
      _lastActiveTime = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    var _lastMove = 0;
    function onMouseMove(e) {
      var now = Date.now();
      if (now - _lastMove < 200) return;
      _lastMove = now;
      if (_exitIntentFired) return;
      if (e.clientY < 20) { triggerExitIntent(); }
    }

    function triggerExitIntent() {
      if (_exitIntentFired) return;
      _exitIntentFired = true;
      window.NOLIX.tracking.exit_intent_triggered = true;
      console.log("🚨 NOLIX: EXIT INTENT DETECTED", {
        visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
        session_id: window.NOLIX.session.id,
        hesitation: window.NOLIX.tracking.hesitation_score
      });
      pushEvent("exit_intent", { hesitation_score: window.NOLIX.tracking.hesitation_score });
      window.NOLIX.api.send("exit_intent", { hesitation_score: window.NOLIX.tracking.hesitation_score });
      runDecisionEngine();
    }

    function computeScores() {
      var timeOnPage  = window.NOLIX.tracking.time_on_page;
      var activeTime  = window.NOLIX.tracking.active_time;
      var scrollDepth = window.NOLIX.tracking.scroll_depth;
      var clicks      = _clickCount;

      // UPGRADED HESITATION SCORING (STEP 5 formula)
      var scrollFactor = scrollDepth < 20 ? 0.3 : 0;
      var intentBoost  = (scrollDepth > 60 && clicks === 0) ? 0.2 : 0;
      var hesitation   =
        (timeOnPage > 25 ? 0.3 : 0) +
        scrollFactor +
        (clicks === 0 && timeOnPage > 25 ? 0.3 : 0) +
        intentBoost;
      hesitation = Math.min(1, Math.round(hesitation * 100) / 100);

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

    var _loopInterval = setInterval(function() {
      var now         = Date.now();
      var elapsedSec  = Math.round((now - _startTime) / 1000);
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
      runDecisionEngine();
    }, 1000);

    window.addEventListener("beforeunload", function() { clearInterval(_loopInterval); });

    try {
      document.addEventListener("scroll",    onScroll,    { passive: true });
      document.addEventListener("click",     onClick,     { passive: true });
      document.addEventListener("mousemove", onMouseMove, { passive: true });
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState === "hidden" && window.scrollY < 50) { triggerExitIntent(); }
      });
      window.addEventListener("pagehide", function() {
        if (window.scrollY < 50) { triggerExitIntent(); }
      }, { passive: true });
    } catch(e) { console.warn("⚠ NOLIX: Could not attach tracking listeners:", e); }

    console.log("👁 NOLIX TRACKING ACTIVE", window.NOLIX.tracking);
  }

  // ============================================================
  // PHASE 12 — DECISION ENGINE (AI-Linked Thresholds)
  // ============================================================
  function runDecisionEngine() {
    if (!window.NOLIX.session || !window.NOLIX.session.id) return;
    if (!window.NOLIX.tracking) return;
    if (window.NOLIX.decision && window.NOLIX.decision.fired) return;

    // Block discounts for coupon abusers
    if (window.NOLIX.visitor && window.NOLIX.visitor.coupon_abuse_flag) {
      console.warn("🚫 NOLIX: Decision suppressed — coupon abuse detected.");
      return;
    }

    var t  = window.NOLIX.tracking;
    var hs = t.hesitation_score;
    var es = t.engagement_score;
    var tp = t.time_on_page;
    var cl = t.clicks.length;
    var ex = t.exit_intent_triggered;

    // Use AI-adjusted thresholds from learning engine
    var hesThreshold = window.NOLIX.learning.weights.hesitation_threshold;
    var engThreshold = window.NOLIX.learning.weights.engagement_threshold;

    var userType = "cold";
    var action   = "none";
    var reason   = "insufficient_signals";

    if (ex && hs >= 0.4) {
      userType = "hesitant";
      action   = "discount";
      reason   = "exit_intent_with_hesitation";
    } else if (hs >= hesThreshold && tp > 25) {
      userType = "hesitant";
      action   = "discount";
      reason   = "high_hesitation_long_session";
    } else if (es >= engThreshold && cl >= 2) {
      userType = "ready";
      action   = "none";
      reason   = "high_engagement_active_user";
    } else {
      return;
    }

    window.NOLIX.decision = {
      user_type:         userType,
      action:            action,
      reason:            reason,
      fired:             true,
      fired_at:          Date.now(),
      visitor_id:        window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
      thresholds_used: {
        hesitation: hesThreshold,
        engagement: engThreshold
      }
    };

    console.log("⚡ NOLIX DECISION:", window.NOLIX.decision);

    pushEvent("decision_fired", {
      user_type:        userType,
      action:           action,
      reason:           reason,
      hesitation_score: hs,
      engagement_score: es,
      time_on_page:     tp,
      visitor_visit_count: window.NOLIX.visitor ? window.NOLIX.visitor.visit_count : 1
    });

    window.NOLIX.api.send("decision_fired", window.NOLIX.decision);

    if (action === "discount") {
      if (cl >= 5 && !ex) {
        console.log("⚠ NOLIX: Skipping popup. User actively engaged (anti-spam).");
        return;
      }
      showDiscountPopup();
    }
  }

  // ============================================================
  // PHASE 13 — ACTION ENGINE (Popup UI + Coupon + Feedback)
  // ============================================================
  function showDiscountPopup() {
    var POPUP_KEY = "nolix_popup_shown_" + window.NOLIX.session.id;

    if (_storage.get(POPUP_KEY)) {
      console.log("⚠ NOLIX: Popup already shown this session.");
      return;
    }

    _storage.set(POPUP_KEY, "1");
    pushEvent("popup_shown", { session_id: window.NOLIX.session.id });
    window.NOLIX.api.send("popup_shown", {
      session_id:  window.NOLIX.session.id,
      visitor_id:  window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
      visit_count: window.NOLIX.visitor ? window.NOLIX.visitor.visit_count : 1
    });

    // Build popup
    var overlay = document.createElement("div");
    overlay.id = "nolix-popup-overlay";
    overlay.style.cssText = [
      "position:fixed","inset:0","background:rgba(0,0,0,0.55)",
      "z-index:2147483647","display:flex","align-items:center",
      "justify-content:center","padding:16px","box-sizing:border-box",
      "opacity:0","transition:opacity 0.3s ease"
    ].join(";");

    var popup = document.createElement("div");
    popup.id = "nolix-popup";
    popup.style.cssText = [
      "background:#fff","border-radius:16px","padding:32px 28px 28px",
      "max-width:420px","width:100%","box-shadow:0 20px 60px rgba(0,0,0,0.3)",
      "position:relative","font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "text-align:center","transform:translateY(20px)",
      "transition:transform 0.3s ease","box-sizing:border-box"
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

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });
    });

    var _seconds = 5 * 60;
    var _timerEl = document.getElementById("nolix-timer");
    var _timerInterval = setInterval(function() {
      _seconds--;
      if (_seconds <= 0) { clearInterval(_timerInterval); closePopup(); return; }
      var m = Math.floor(_seconds / 60);
      var s = _seconds % 60;
      if (_timerEl) {
        _timerEl.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
      }
    }, 1000);

    var _popupClosed = false;
    function closePopup(fromCTA) {
      if (_popupClosed) return;
      _popupClosed = true;
      clearInterval(_timerInterval);
      overlay.style.opacity = "0";
      popup.style.transform = "translateY(20px)";
      setTimeout(function() {
        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
      }, 300);

      if (!fromCTA) {
        // STEP 6: Save negative feedback signal
        window.NOLIX.feedback.save({
          event:            "conversion_rejected",
          visitor_id:       window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
          session_id:       window.NOLIX.session.id,
          hesitation_score: window.NOLIX.tracking.hesitation_score,
          engagement_score: window.NOLIX.tracking.engagement_score,
          action:           "dismissed_discount",
          timestamp:        Date.now()
        });
        if (window.NOLIX.visitor) {
          window.NOLIX.visitor.rejections++;
          saveVisitor();
        }
        window.NOLIX.api.send("conversion_rejected", { session: window.NOLIX.session });
        pushEvent("popup_dismissed", { session_id: window.NOLIX.session.id });
      }
    }

    var closeBtn = document.getElementById("nolix-close");
    var ctaBtn   = document.getElementById("nolix-cta");

    if (closeBtn) {
      closeBtn.addEventListener("click", function() { closePopup(false); });
    }

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function() {
        var coupon = window.NOLIX.coupon.generate("discount_10");

        if (!coupon) {
          // Abuse blocked
          alert("عذراً، هذا العرض غير متاح حالياً.");
          closePopup(false);
          return;
        }

        // STEP 6: Save positive feedback signal
        window.NOLIX.feedback.save({
          event:            "conversion_attempt",
          visitor_id:       window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
          session_id:       window.NOLIX.session.id,
          hesitation_score: window.NOLIX.tracking.hesitation_score,
          engagement_score: window.NOLIX.tracking.engagement_score,
          action:           "accepted_discount",
          coupon:           coupon.code,
          timestamp:        Date.now()
        });
        if (window.NOLIX.visitor) {
          window.NOLIX.visitor.conversion_attempts++;
          saveVisitor();
        }

        pushEvent("popup_clicked", {
          session_id: window.NOLIX.session.id,
          action:     "cta_discount",
          coupon:     coupon.code
        });

        window.NOLIX.api.send("conversion_attempt", {
          coupon:  coupon,
          session: window.NOLIX.session,
          visitor: window.NOLIX.visitor
        });

        console.log("💰 NOLIX: COUPON ISSUED —", coupon.code);
        alert("🎉 كود الخصم بتاعك: " + coupon.code + "\n\nالكود صالح لـ 5 دقائق فقط!");

        closePopup(true);
      });
    }

    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) { closePopup(false); }
    });

    console.log("🎯 NOLIX POPUP SHOWN", { session: window.NOLIX.session.id });
  }

  // ============================================================
  // PHASE 14 — CORE BOOT
  // ============================================================
  function initNolix() {
    if (window.NOLIX.initialized) return;
    console.log("✅ NOLIX INIT");

    window.NOLIX.status      = "initialized";
    window.NOLIX.initialized = true;
    window.NOLIX.loaded_at   = Date.now();
    window.NOLIX.url         = window.location.href;
    window.NOLIX.decision    = { user_type: null, action: null, reason: null, fired: false };

    // Order matters: visitor → session → learning → tracking
    initVisitor();
    initSession();

    // Load per-visitor AI weights
    window.NOLIX.learning.load();

    // Auto learning loop: runs every 15 seconds
    setInterval(function() {
      window.NOLIX.learning.adjust();
    }, 15000);

    initTracking();

    console.log("🧠 NOLIX READY:", window.NOLIX);
  }

  // ============================================================
  // PHASE 15 — FORCE SELF-BOOTSTRAP RETRY LOOP
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
      if (_retryCount < _maxRetries) { _retryCount++; setTimeout(attemptBoot, 50); }
    }
  }

  attemptBoot();
}
