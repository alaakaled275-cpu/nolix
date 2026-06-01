/**
 * NOLIX MASTER SCRIPT v3.0 — SECURE REVENUE BRAIN
 * STEP 12: Security + Observability + Runtime Control
 * Boot: License → Runtime Flags → Session → ML → Decision Engine V5
 */

if (window.__NOLIX_LOADED__) {
  console.warn("⚠ NOLIX: Already loaded. Duplicate execution blocked.");
} else {
  window.__NOLIX_LOADED__ = true;

  console.log("🔥 NOLIX BOOT START v3.0 (Secure Revenue Brain)");

  var _scriptTag = document.currentScript ||
    (function() {
      var tags = document.querySelectorAll('script[data-site]');
      return tags[tags.length - 1];
    })();
  var _storeDomain = (_scriptTag && _scriptTag.getAttribute("data-site")) || "unknown";
  var _licenseKey  = (window.NOLIX_CONFIG && window.NOLIX_CONFIG.key) ||
                     (_scriptTag && _scriptTag.getAttribute("data-nolix-key")) || "";

  // ============================================================
  // GLOBAL OBJECT
  // ============================================================
  window.NOLIX = {
    version: "2.0",
    status:  "booting",
    debug:   true,
    initialized: false,
    store:   _storeDomain,
    visitor: null,
    session: null,
    tracking: null,
    decision: null,
    events:  [],
    ping: function() { return "alive"; }
  };

  if (window.top !== window.self) {
    console.warn("⚠ NOLIX: Running inside iframe (Shopify safe mode)");
  }

  // ============================================================
  // SAFE STORAGE
  // ============================================================
  var _storage = {
    get: function(key) {
      try { return localStorage.getItem(key); }
      catch(e) { console.error("❌ NOLIX STORAGE READ:", e); return null; }
    },
    set: function(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch(e) { console.error("❌ NOLIX STORAGE WRITE:", e); return false; }
    }
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ============================================================
  // EVENT PIPELINE
  // ============================================================
  function pushEvent(type, data) {
    var event = Object.assign({ type: type, timestamp: Date.now() }, data || {});
    window.NOLIX.events.push(event);
    if (window.NOLIX.debug) { console.log("📡 NOLIX EVENT:", event); }
  }

  // ============================================================
  // API LAYER
  // ============================================================
  var _API_BASE = (window.NOLIX_CONFIG && window.NOLIX_CONFIG.api) ||
                  (_scriptTag && _scriptTag.getAttribute("data-api")) ||
                  "https://nolix-koe6.vercel.app";

  // ============================================================
  // STEP 12 PART 1 — LICENSE VERIFICATION (HARD BLOCK)
  // Called FIRST on boot. If license is invalid → script halts.
  // Stolen scripts are useless: server checks domain on every request.
  // ============================================================
  async function verifyLicense() {
    // Dev mode: skip license check if no key configured
    if (!_licenseKey) {
      console.warn("⚠ NOLIX: No license key configured. Running in dev mode (no protection).");
      return true;
    }
    try {
      var res = await fetch(_API_BASE + "/api/license/verify", {
        method:  "GET",
        mode:    "cors",
        headers: {
          "x-nolix-key": _licenseKey,
          "x-domain":    location.hostname
        }
      });

      if (res.status === 403) {
        console.error("🚫 NOLIX: LICENSE DENIED — script blocked on this domain.");
        return false;
      }
      if (!res.ok) {
        console.warn("⚠ NOLIX: License server unreachable (HTTP " + res.status + "). Proceeding with caution.");
        return true; // Fail-open on network error (UX protection)
      }

      var data = await res.json();
      if (!data.valid) {
        console.error("🚫 NOLIX: Invalid license →", data.reason);
        return false;
      }

      console.log("✅ NOLIX LICENSE OK:", { plan: data.plan, shop: data.shop_domain });
      return true;
    } catch(e) {
      console.warn("⚠ NOLIX: License check network error. Proceeding.", e);
      return true; // Fail-open on network error
    }
  }

  // ============================================================
  // STEP 13 PART 7 — DISTRIBUTED RUNTIME FLAGS (HARD KILL-SWITCH)
  // Fetches LIVE flags from server DB on every boot.
  // NOT cached — always fresh from DB (distributed-safe).
  // If ai_enabled=false → all AI decisions blocked immediately.
  // If maintenance_mode → nothing runs.
  // ============================================================
  async function fetchRuntimeFlags() {
    window.NOLIX.runtime = {
      ai_enabled:        true,
      training_enabled:  true,
      embedding_enabled: true,
      ab_test_enabled:   true,
      coupons_enabled:   true,
      maintenance_mode:  false,
      fetched:           false
    };

    try {
      var res = await fetch(_API_BASE + "/api/runtime/flags", {
        method:  "GET",
        mode:    "cors",
        headers: _licenseKey ? { "x-nolix-key": _licenseKey } : {}
      });

      if (res.ok) {
        var data = await res.json();
        window.NOLIX.runtime = Object.assign(window.NOLIX.runtime, data, { fetched: true });
        console.log("⚙ NOLIX RUNTIME FLAGS:", window.NOLIX.runtime);
      } else {
        console.warn("⚠ NOLIX: Runtime flags fetch failed (HTTP " + res.status + "). Using defaults.");
      }
    } catch(e) {
      console.warn("⚠ NOLIX: Runtime flags network error. Using defaults.", e);
    }

    // HARD GATE: if maintenance mode → log and return false
    if (window.NOLIX.runtime.maintenance_mode) {
      console.warn("🔴 NOLIX: System in maintenance mode. All features disabled.");
      window.NOLIX.status = "maintenance";
      return false;
    }

    return true;
  }

  window.NOLIX.api = {
    endpoint: _API_BASE + "/api/track",

    send: async function(eventType, payload) {
      try {
        await fetch(this.endpoint, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: eventType, visitor: window.NOLIX.visitor,
            session: window.NOLIX.session, tracking: window.NOLIX.tracking,
            decision: window.NOLIX.decision, payload: payload || {},
            timestamp: Date.now()
          })
        });
        console.log("✅ NOLIX API SENT:", eventType);
      } catch(e) { console.warn("⚠ NOLIX API FAIL:", e); }
    }
  };

  // ============================================================
  // PHASE 1 §3 — safeFetch: retry wrapper with exponential backoff
  // Prevents data loss on transient network failures.
  // Retries: 3 attempts, 500ms → 1000ms → 2000ms delays
  // ============================================================
  function safeFetch(url, options, retries) {
    retries = retries !== undefined ? retries : 3;
    return fetch(url, options).catch(function(e) {
      if (retries > 0) {
        var delay = 500 * (4 - retries); // 500ms, 1000ms, 1500ms
        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            safeFetch(url, options, retries - 1).then(resolve).catch(reject);
          }, delay);
        });
      }
      console.error("[NOLIX] safeFetch FINAL FAIL after 3 retries:", e);
      return Promise.reject(e);
    });
  }

  var _sendEventLock = false; // prevent concurrent overlapping calls

  function sendEvent(eventType, payload) {
    if (!window.NOLIX.session || !window.NOLIX.session.id) return;
    if (_sendEventLock) return; // only one request in-flight at a time
    _sendEventLock = true;

    var features   = window.NOLIX.model.currentFeatures();
    var prediction = features ? window.NOLIX.model.predict(features) : { score: 0 };

    // PHASE 1 §1: include x-api-key for Store Auth System
    var storeApiKey = (window.NOLIX.store_key) || (window.NOLIX_CONFIG && window.NOLIX_CONFIG.store_key) || "";

    try {
      safeFetch(_API_BASE + "/api/bridge/decide", {
        method:  "POST",
        mode:    "cors",
        headers: {
          "Content-Type":   "application/json",
          "x-store-domain": _storeDomain,
          "x-api-key":      storeApiKey        // PHASE 1: Store API key auth
        },
        body: JSON.stringify({
          session_id:  window.NOLIX.session.id,
          visitor_id:  window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
          store:       _storeDomain,
          event:       eventType,
          type:        eventType,
          key:         _licenseKey || "",
          context:     payload || {},
          features: {
            time_on_page:     window.NOLIX.tracking ? window.NOLIX.tracking.time_on_page     : 0,
            scroll_depth:     window.NOLIX.tracking ? window.NOLIX.tracking.scroll_depth     : 0,
            clicks:           window.NOLIX.tracking ? window.NOLIX.tracking.clicks.length    : 0,
            hesitation_score: window.NOLIX.tracking ? window.NOLIX.tracking.hesitation_score : 0,
            engagement_score: window.NOLIX.tracking ? window.NOLIX.tracking.engagement_score : 0,
            exit_intent:      window.NOLIX.tracking ? window.NOLIX.tracking.exit_intent_triggered : false,
            cart_status:      window.NOLIX_CONFIG  ? (window.NOLIX_CONFIG.cart_status || "unknown") : "unknown",
            model_score:      prediction.score,
            model_confidence: prediction.confidence || 0
          },
          timestamp: Date.now()
        })
      })
      .then(function(res) {
        _sendEventLock = false;
        return res.ok ? res.json() : null;
      })
      .then(function(response) {
        if (!response) return;
        var decision = response.decision || response;
        if (decision && decision.action && decision.action !== "none" && decision.action !== "do_nothing") {
          handleDecision(decision);
        }
      })
      .catch(function(e) {
        _sendEventLock = false;
        console.warn("[NOLIX] sendEvent failed after retries:", e);
      });
    } catch(e) {
      _sendEventLock = false;
      console.warn("[NOLIX] sendEvent error:", e);
    }
  }

  // handleDecision() — translates a server decision into a visible client action
  // Called automatically when sendEvent() receives a non-null decision from server.
  function handleDecision(decision) {
    if (!decision || !decision.action) return;
    // Gate: do not act again if we already fired a decision this session
    if (window.NOLIX.decision && window.NOLIX.decision.fired) return;

    console.log("🧠 NOLIX SERVER DECISION RECEIVED:", decision);
    pushEvent("server_decision", decision);

    // Emit to SSE stream for live dashboard updates (via server broadcast)
    // (The server emits automatically after deciding; this is client-side logging only)
    window.NOLIX.lastServerDecision = decision;

    var action = decision.action;
    if (action === "discount" || action === "discount_5" || action === "discount_10" || action === "discount_15") {
      var pct = decision.value || parseInt(action.replace("discount_", "")) || 10;
      showDiscountPopup(pct, decision.tier || "standard");
    } else if (action === "urgency") {
      showUrgencyBanner(decision.message || "⏰ هذا المنتج مطلوب بشدة! كميات محدودة متبقية.");
    } else if (action === "free_shipping") {
      showUrgencyBanner("🚚 احصل على شحن مجاني الآن!");
    } else if (action === "bundle") {
      showUrgencyBanner("🎁 عرض Bundle خاص متاح فقط لوقت محدود!");
    } else if (action === "popup_info") {
      showUrgencyBanner(decision.message || "❤️ يثق بنا آلاف العملاء. انضم إليهم اليوم!");
    }
  }

  // showUrgencyBanner() — shows a sticky bottom banner (no discount required)
  // Used for urgency, free_shipping, bundle, and popup_info actions.
  function showUrgencyBanner(message) {
    if (document.getElementById("nolix-urgency-banner")) return; // already shown

    var banner = document.createElement("div");
    banner.id = "nolix-urgency-banner";
    banner.setAttribute("role", "alert");
    banner.style.cssText = [
      "position:fixed;bottom:0;left:0;right:0;z-index:2147483646;",
      "background:linear-gradient(90deg,#1a1a2e,#16213e);",
      "color:#fff;padding:14px 20px;",
      "display:flex;align-items:center;justify-content:space-between;",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",
      "font-size:15px;font-weight:600;",
      "transform:translateY(100%);transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);",
      "box-shadow:0 -4px 24px rgba(0,0,0,0.35);border-top:2px solid #e53e3e;"
    ].join("");

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = "background:rgba(255,255,255,0.15);border:none;color:#fff;" +
      "width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;" +
      "display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:12px;";

    var msgSpan = document.createElement("span");
    msgSpan.textContent = message || "⏰ هذا المنتج مطلوب بشدة!";

    banner.appendChild(msgSpan);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { banner.style.transform = "translateY(0)"; });
    });

    function removeBanner() {
      banner.style.transform = "translateY(100%)";
      setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
    }

    closeBtn.addEventListener("click", removeBanner);
    // Auto-dismiss after 9 seconds
    setTimeout(removeBanner, 9000);

    pushEvent("urgency_banner_shown", { message: message });
    console.log("🚨 NOLIX URGENCY BANNER:", message);
  }

  // ============================================================
  // STEP 10 — HYBRID ML MODEL (v3.0)
  // Online learning (per visit) + Server weights (globally trained).
  // 8-dimensional feature space matching server feature store.
  // Eliminates cold start: server weights loaded on every boot.
  // ============================================================
  window.NOLIX.model = {
    type:           "logistic_regression_hybrid_v3",
    server_version: 0,    // version of global weights from server
    model_id:       "local_boot",  // set after server sync
    ai_enabled:     true, // STEP 11.1 PART 9 FAIL-SAFE: set to false if AUC < 0.55

    // 8D weights — [scroll, clicks, dwell, hesitation, engagement, recency, loyalty, trust]
    weights: [0.25, 0.20, 0.15, -0.35, 0.25, 0.10, 0.10, 0.15],
    bias:    0,
    lr:      0.01,
    lambda:  0.001,  // L2 regularization (matches server)

    // Key names for localStorage (per-visitor)
    _storageKey: function() {
      return "nolix_model_weights_v3_" +
        (window.NOLIX.visitor ? window.NOLIX.visitor.id : "anon");
    },

    // Load locally-trained weights from localStorage
    loadWeights: function() {
      var raw = _storage.get(this._storageKey());
      if (!raw) return;
      try {
        var saved = JSON.parse(raw);
        if (Array.isArray(saved.weights) && saved.weights.length === 8) {
          this.weights = saved.weights;
        }
        this.bias           = typeof saved.bias === "number"   ? saved.bias : 0;
        this.lr             = typeof saved.lr   === "number"   ? saved.lr   : 0.01;
        this.server_version = saved.server_version || 0;
        console.log("🧠 MODEL: Local weights loaded (v" + this.server_version + "):", this.weights);
      } catch(e) { console.warn("⚠ MODEL: Could not load local weights."); }
    },

    // Persist locally-trained weights to localStorage
    saveWeights: function() {
      _storage.set(this._storageKey(), JSON.stringify({
        weights:        this.weights,
        bias:           this.bias,
        lr:             this.lr,
        server_version: this.server_version,
        updated:        Date.now()
      }));
    },

    // Load globally-trained weights from server (Layer 7 + STEP 11.1)
    // GOVERNOR CHECK + AI FAIL-SAFE: only apply if allow_sync=true AND ai_enabled=true
    loadServerWeights: async function() {
      try {
        var res = await fetch(_API_BASE + "/api/model/sync", {
          method: "GET", mode: "cors"
        });

        // 503 = AI disabled by fail-safe on server
        if (res.status === 503) {
          console.error("🛑 MODEL SYNC: Server AI DISABLED (fail-safe). Disabling client AI.");
          this.ai_enabled = false;
          return;
        }

        if (!res.ok) { throw new Error("HTTP " + res.status); }
        var data = await res.json();

        // GOVERNOR CHECK: server says weights are below quality threshold
        if (data.allow_sync === false) {
          console.warn("🔒 MODEL SYNC BLOCKED:", data.reason,
            "| auc:", data.auc, "| drift:", data.drift_score);
          return; // keep local weights — do NOT apply bad server weights
        }

        // STEP 11.1 PART 9 FAIL-SAFE: server says AI is disabled
        if (data.ai_enabled === false) {
          console.error("🛑 MODEL SYNC: Server ai_enabled=false. Disabling client interventions.");
          this.ai_enabled = false;
          return;
        }

        // Only apply if server version is newer, and weights pass quality
        if (data.version > this.server_version) {
          var sw = data.weights;
          this.weights = [
            sw.scroll     || 0.25,
            sw.clicks     || 0.20,
            sw.dwell      || 0.15,
            sw.hesitation || -0.35,
            sw.engagement || 0.25,
            sw.recency    || 0.10,
            sw.loyalty    || 0.10,
            sw.trust      || 0.15
          ];
          this.bias           = typeof data.bias    === "number" ? data.bias    : 0;
          this.lr             = typeof data.lr      === "number" ? data.lr      : 0.01;
          this.server_version = data.version;
          this.model_id       = data.model_id || data.version;
          this.ai_enabled     = true;
          this.saveWeights();

          console.log("🌐 MODEL SYNC APPLIED (v" + data.version + "):", {
            model_id:    data.model_id,
            weights:     this.weights,
            bias:        this.bias,
            metrics:     data.metrics,  // train_loss, val_loss, precision, recall, f1, auc
            trained:     (data.online_trained || 0) + (data.batch_trained || 0)
          });
        } else {
          console.log("ℹ MODEL SYNC: Local weights current (v" + this.server_version + ").");
        }
      } catch(e) {
        console.warn("⚠ MODEL SYNC: Server unreachable. Using local weights:", e);
      }
    },

    // PREDICT: z = w·x + b → sigmoid(z) → [0, 1]
    // Accepts either 8D array or named object (backward compat)
    predict: function(vector) {
      if (!vector) return { score: 0.5, confidence: 0, level: "unknown", model_type: this.type };

      var x = Array.isArray(vector)
        ? vector
        : [
            vector.scroll     || 0,
            vector.clicks     || 0,
            vector.time       || vector.dwell || 0,
            vector.hesitation || 0,
            vector.engagement || 0,
            vector.recency    || 0,
            vector.loyalty    || 0,
            vector.trust      !== undefined ? vector.trust : 1
          ];

      var z = this.bias;
      for (var i = 0; i < Math.min(this.weights.length, x.length); i++) {
        z += this.weights[i] * (x[i] || 0);
      }
      var score      = 1 / (1 + Math.exp(-z)); // sigmoid
      score          = Math.round(score * 1000) / 1000;
      var confidence = clamp(Math.abs(score - 0.5) * 2, 0, 1);

      return {
        score:          score,
        probability:    score,
        confidence:     confidence,
        z:              Math.round(z * 1000) / 1000,
        level:          score > 0.7 ? "high_intent" : score > 0.4 ? "medium_intent" : "low_intent",
        model_type:     this.type,
        server_version: this.server_version
      };
    },

    // TRAIN: Online gradient descent — 8D update
    train: function(vector, label) {
      if (!vector) return;
      var x = Array.isArray(vector)
        ? vector
        : [
            vector.scroll || 0, vector.clicks || 0,
            vector.time || vector.dwell || 0, vector.hesitation || 0,
            vector.engagement || 0, vector.recency || 0,
            vector.loyalty || 0, vector.trust !== undefined ? vector.trust : 1
          ];

      var pred  = this.predict(x).score;
      var error = label - pred;

      for (var i = 0; i < this.weights.length; i++) {
        this.weights[i] = clamp(this.weights[i] + this.lr * error * (x[i] || 0), -3, 3);
      }
      this.bias = clamp(this.bias + this.lr * error, -3, 3);
      this.saveWeights();

      console.log("🔁 MODEL TRAINED:", {
        label:  label,
        pred:   Math.round(pred * 1000) / 1000,
        error:  Math.round(error * 1000) / 1000,
        bias:   this.bias
      });
    },

    // Build 8D feature vector from current tracking + visitor state
    currentFeatures: function() {
      if (!window.NOLIX.tracking) return null;
      var t   = window.NOLIX.tracking;
      var v   = window.NOLIX.visitor || {};
      var now = Date.now();
      var daysSince = v.last_visit ? Math.min((now - v.last_visit) / (86400000), 30) : 30;
      return [
        clamp((t.scroll_depth    || 0) / 100),
        clamp((t.clicks.length   || 0) / 5),
        clamp((t.time_on_page    || 0) / 120),
        clamp(t.hesitation_score || 0),
        clamp(t.engagement_score || 0),
        clamp(1 - daysSince / 30),
        clamp((v.visit_count     || 0) / 10),
        (v.coupon_abuse_severity || 0) >= 2 ? 0 : 1
      ];
    }
  };

  // ============================================================
  // STEP 9 — FIX 2: GLOBAL IDENTITY GRAPH
  // Sends vectors to server — the ONLY source of cross-device truth.
  // localStorage remains local fallback ONLY.
  // ============================================================
  window.NOLIX.identity = {
    endpoint: "https://nolix-koe6.vercel.app/api/track/embedding",

    sync: async function(vector) {
      if (!window.NOLIX.visitor || !window.NOLIX.session) { return; }
      try {
        var res = await fetch(this.endpoint, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_id: window.NOLIX.visitor.id,
            session_id: window.NOLIX.session.id,
            store:      _storeDomain,
            vector:     vector,
            timestamp:  Date.now()
          })
        });

        if (res.ok) {
          var data = await res.json();
          // If server returns updated centroid, update local global memory
          if (data && data.centroid) {
            var global = window.NOLIX.globalMemory.get(window.NOLIX.visitor.id) || { vectors: [], centroid: null, session_count: 0 };
            global.centroid      = data.centroid;
            global.session_count = data.session_count || global.session_count;
            global.last_updated  = Date.now();
            window.NOLIX.globalMemory.save(window.NOLIX.visitor.id, global);
            console.log("🔄 NOLIX: Centroid synced from server:", data.centroid);
          }
        }
      } catch(e) {
        console.warn("⚠ NOLIX: Identity sync failed (offline mode). localStorage only.");
      }
    },

    // Called when a real purchase is confirmed (from webhook → localStorage flag)
    onPurchaseConfirmed: function() {
      var features = window.NOLIX.model.currentFeatures();
      if (!features) return;
      var label = window.NOLIX.truth.label("purchase_confirmed");
      window.NOLIX.model.train(features, label);
      console.log("🏆 NOLIX: REAL PURCHASE — training model with truth label:", label);
      pushEvent("purchase_confirmed_training", { label: label, features: features });
      window.NOLIX.api.send("purchase_confirmed_training", { visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, label: label });
    }
  };

  // ============================================================
  // CHECK PURCHASE FLAG — STEP 9.1 (Server DB Primary, localStorage Fallback)
  //
  // Flow:
  //   1. Poll /api/webhooks/shopify/purchase?visitor_id=X
  //   2. Server returns {confirmed: true, truth_label: 1.0} if Shopify paid webhook fired
  //   3. Train model with truth_label = 1.0 (THE ONLY GROUND TRUTH)
  //   4. Server marks signal as trained=true (prevents double-training)
  //   5. Fallback: if server unreachable → check localStorage flag
  // ============================================================
  function checkPurchaseFlag() {
    if (!window.NOLIX.visitor || !window.NOLIX.visitor.id) return;
    var vid = window.NOLIX.visitor.id;

    // PRIMARY: Server DB poll (persistent — survives server restart)
    ;(async function() {
      try {
        var res = await fetch(
          _API_BASE + "/api/webhooks/shopify/purchase?visitor_id=" + encodeURIComponent(vid),
          { method: "GET", mode: "cors" }
        );

        if (!res.ok) {
          console.warn("⚠ NOLIX: Purchase signal poll returned", res.status, "— using localStorage fallback");
          _checkLocalStoragePurchaseFlag(vid);
          return;
        }

        var data = await res.json();

        if (data && data.confirmed === true) {
          console.log("🏆 NOLIX: REAL PURCHASE CONFIRMED (server DB):", {
            visitor_id:  data.visitor_id,
            order_id:    data.order_id,
            truth_label: data.truth_label
          });

          // Train with server-confirmed truth label (always 1.0)
          var features = window.NOLIX.model.currentFeatures();
          if (features) {
            var label = typeof data.truth_label === "number" ? data.truth_label : 1.0;
            window.NOLIX.model.train(features, label);
            console.log("🔁 MODEL TRAINED — purchase_confirmed. label:", label);
          }

          pushEvent("purchase_confirmed_training", {
            visitor_id:  vid,
            order_id:    data.order_id || null,
            truth_label: data.truth_label,
            source:      "server_db"
          });

          window.NOLIX.api.send("purchase_confirmed_training", {
            visitor_id:  vid,
            truth_label: data.truth_label,
            source:      "server_db"
          });

          // Clear localStorage flag if it exists (cleanup)
          _storage.set("nolix_purchase_confirmed_" + vid, "");
        } else {
          console.log("ℹ NOLIX: No pending purchase signal for visitor:", vid);
        }

      } catch(e) {
        console.warn("⚠ NOLIX: Server purchase poll failed (offline). Checking localStorage:", e);
        _checkLocalStoragePurchaseFlag(vid);
      }
    })();
  }

  // FALLBACK: localStorage flag check (set by Shopify webhook in some integrations)
  function _checkLocalStoragePurchaseFlag(vid) {
    var flag = _storage.get("nolix_purchase_confirmed_" + vid);
    if (flag && flag !== "") {
      console.log("🏆 NOLIX: Purchase flag found in localStorage. Training model.");
      var features = window.NOLIX.model.currentFeatures();
      if (features) {
        window.NOLIX.model.train(features, 1.0);
        console.log("🔁 MODEL TRAINED — localStorage flag. label: 1.0");
      }
      pushEvent("purchase_confirmed_training", { visitor_id: vid, truth_label: 1.0, source: "localStorage_fallback" });
      window.NOLIX.api.send("purchase_confirmed_training", { visitor_id: vid, truth_label: 1.0, source: "localStorage_fallback" });
      // Clear flag after training (prevent double-training)
      _storage.set("nolix_purchase_confirmed_" + vid, "");
    }
  }

  // ============================================================
  // STEP 9 — FIX 3: TRUTH SYSTEM (REAL — ONLY purchase = 1.0)
  // CTA click is a WEAK signal. Only server-confirmed purchase = truth.
  // ============================================================
  window.NOLIX.truth = {
    label: function(event) {
      var labels = {
        impression:          0.0,   // saw something, zero commitment
        scroll_depth_25:     0.05,
        scroll_depth_50:     0.1,
        scroll_depth_75:     0.15,
        click:               0.15,
        exit_intent:         0.0,   // exiting ≠ intent to buy
        popup_shown:         0.0,   // we showed — doesn't mean they want
        cta_click:           0.2,   // clicked BUT not purchased
        popup_dismissed:     0.0,   // explicitly rejected
        checkout_started:    0.6,   // strong signal — but still not purchase
        purchase_confirmed:  1.0    // THE ONLY GROUND TRUTH
      };
      return typeof labels[event] !== "undefined" ? labels[event] : 0;
    },

    // Returns training label for a given outcome
    // Used internally by train() calls
    getLabelForOutcome: function(outcome) {
      return this.label(outcome);
    }
  };

  // ============================================================
  // GLOBAL MEMORY ENGINE (Cross-Session, localStorage primary)
  // ============================================================
  window.NOLIX.globalMemory = {
    _key: function(vid) { return "nolix_global_" + vid; },
    get: function(vid) {
      var raw = _storage.get(this._key(vid));
      if (!raw) return null;
      try { return JSON.parse(raw); } catch(e) { return null; }
    },
    save: function(vid, data) { _storage.set(this._key(vid), JSON.stringify(data)); }
  };

  function computeCentroid(vectors) {
    if (!vectors || !vectors.length) return null;
    var len = vectors[0].length;
    var result = [], i, j;
    for (i = 0; i < len; i++) { result[i] = 0; }
    for (j = 0; j < vectors.length; j++) {
      for (i = 0; i < len; i++) { result[i] += (vectors[j][i] || 0); }
    }
    for (i = 0; i < len; i++) {
      result[i] = Math.round((result[i] / vectors.length) * 10000) / 10000;
    }
    return result;
  }

  // ============================================================
  // SIMILARITY ENGINE
  // ============================================================
  window.NOLIX.similarity = {
    cosine: function(a, b) {
      if (!a || !b || a.length !== b.length) return 0;
      var dot = 0, magA = 0, magB = 0;
      for (var i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
      }
      var mag = Math.sqrt(magA) * Math.sqrt(magB);
      return mag < 0.0001 ? 0 : Math.round((dot / (mag + 0.0001)) * 10000) / 10000;
    }
  };

  // ============================================================
  // BEHAVIORAL EMBEDDING ENGINE (7D vector)
  // ============================================================
  window.NOLIX.embedding = {
    version: "2.0",

    generate: function(tracking, visitor) {
      if (!tracking || !visitor) return null;
      return [
        clamp(tracking.time_on_page    / 120, 0, 1),
        clamp(tracking.scroll_depth    / 100, 0, 1),
        clamp(tracking.engagement_score,      0, 1),
        clamp(1 - tracking.hesitation_score,  0, 1),
        clamp((visitor.visit_count     || 0) / 10, 0, 1),
        clamp((visitor.conversion_attempts || 0) / 5, 0, 1),
        visitor.coupon_abuse_severity >= 2 ? 0 : 1
      ];
    },

    updateGlobal: function() {
      var v = window.NOLIX.visitor;
      var t = window.NOLIX.tracking;
      if (!v || !v.id || !t) return;

      var vec = this.generate(t, v);
      if (!vec) return;

      var global = window.NOLIX.globalMemory.get(v.id) || { visitor_id: v.id, vectors: [], centroid: null, last_updated: null, session_count: 0 };
      global.vectors.push(vec);
      if (global.vectors.length > 20) { global.vectors.shift(); }
      global.centroid      = computeCentroid(global.vectors);
      global.last_updated  = Date.now();
      global.session_count = global.vectors.length;
      window.NOLIX.globalMemory.save(v.id, global);

      // FIX 2: Sync to server (non-blocking)
      window.NOLIX.identity.sync(vec);

      if (window.NOLIX.debug) {
        console.log("🧠 EMBEDDING UPDATED:", { vector: vec, centroid: global.centroid, sessions: global.session_count });
      }
    },

    snapshot: function() {
      var v = window.NOLIX.visitor, t = window.NOLIX.tracking;
      if (!v || !t) return;
      _storage.set("nolix_embedding_" + v.id, JSON.stringify({ vector: this.generate(t, v), updated_at: Date.now() }));
    },

    classify: function() {
      var v = window.NOLIX.visitor, t = window.NOLIX.tracking;
      if (!v || !t) return "unknown";
      var current = this.generate(t, v);
      if (!current) return "unknown";
      var global = window.NOLIX.globalMemory.get(v.id);
      if (!global || !global.centroid) {
        var p = window.NOLIX.model.predict(window.NOLIX.model.currentFeatures());
        return p.score > 0.65 ? "high_intent_cluster" : p.score > 0.40 ? "mid_intent_cluster" : "cold_cluster";
      }
      var sim = window.NOLIX.similarity.cosine(current, global.centroid);
      console.log("📐 CLUSTER SIM:", sim);
      if (sim > 0.85) return "high_intent_cluster";
      if (sim > 0.65) return "mid_intent_cluster";
      return "cold_cluster";
    }
  };

  // ============================================================
  // BEHAVIOR MEMORY LAYER
  // ============================================================
  window.NOLIX.memory = {
    _key: function() { return "nolix_memory_" + (window.NOLIX.visitor ? window.NOLIX.visitor.id : "anon"); },
    store: function(key, value) {
      var raw = _storage.get(this._key());
      var data = raw ? (function(){ try { return JSON.parse(raw); } catch(e) { return {}; } })() : {};
      data[key] = value; data._updated_at = Date.now();
      _storage.set(this._key(), JSON.stringify(data));
    },
    get: function(key) {
      var raw = _storage.get(this._key());
      var data = raw ? (function(){ try { return JSON.parse(raw); } catch(e) { return {}; } })() : {};
      return key ? data[key] : data;
    },
    recordStory: function() {
      if (!window.NOLIX.tracking) return;
      var features = window.NOLIX.model.currentFeatures();
      var p       = features ? window.NOLIX.model.predict(features) : null;
      var cluster = window.NOLIX.embedding.classify();
      this.store("last_behavior", {
        scroll: window.NOLIX.tracking.scroll_depth, time: window.NOLIX.tracking.time_on_page,
        active_time: window.NOLIX.tracking.active_time, clicks: window.NOLIX.tracking.clicks.length,
        idle: window.NOLIX.tracking.idle, hesitation: window.NOLIX.tracking.hesitation_score,
        engagement: window.NOLIX.tracking.engagement_score,
        model_score: p ? p.score : null, model_confidence: p ? p.confidence : null,
        model_type: "logistic_regression_online",
        cluster: cluster, referrer: document.referrer || "direct",
        page: window.location.pathname, store: _storeDomain, timestamp: Date.now()
      });
      var histKey = this._key() + "_history";
      var hRaw = _storage.get(histKey);
      var history = hRaw ? (function(){ try { return JSON.parse(hRaw); } catch(e) { return []; } })() : [];
      history.push({ page: window.location.pathname, score: p ? p.score : null, cluster: cluster, session_id: window.NOLIX.session ? window.NOLIX.session.id : null, timestamp: Date.now() });
      if (history.length > 10) { history.shift(); }
      _storage.set(histKey, JSON.stringify(history));
    },
    getHistory: function() {
      var raw = _storage.get(this._key() + "_history");
      return raw ? (function(){ try { return JSON.parse(raw); } catch(e) { return []; } })() : [];
    }
  };

  // ============================================================
  // FEEDBACK ENGINE (Truth-Anchored Storage)
  // ============================================================
  window.NOLIX.feedback = {
    _key: function() { return "nolix_feedback_" + (window.NOLIX.visitor ? window.NOLIX.visitor.id : "unknown"); },
    save: function(data) {
      data.truth_label = window.NOLIX.truth.label(data.event);
      data._saved_at   = Date.now();
      var key = this._key(), existing = [], raw = _storage.get(key);
      if (raw) { try { existing = JSON.parse(raw); } catch(e) {} }
      existing.push(data);
      _storage.set(key, JSON.stringify(existing));
    },
    getAll: function() {
      var raw = _storage.get(this._key());
      if (!raw) return [];
      try { return JSON.parse(raw); } catch(e) { return []; }
    }
  };

  // ============================================================
  // COUPON ENGINE — STEP 11 PART 3: UNIQUE ATTRIBUTION
  // Format: NOLIX-{VID4}-{TS_B36}-{RAND4}
  // Guarantees unique attribution even for same visitor.
  // ============================================================
  window.NOLIX.coupon = {
    generate: function(type) {
      if (window.NOLIX.visitor && window.NOLIX.visitor.coupon_abuse_severity >= 2) {
        console.warn("🚫 NOLIX: Coupon blocked. Severity:", window.NOLIX.visitor.coupon_abuse_severity);
        return null;
      }
      var vid  = window.NOLIX.visitor ? window.NOLIX.visitor.id : window.NOLIX.session.id;

      // STEP 11 FIX: unique suffix = timestamp (base36) + random 4-char
      var ts   = Date.now().toString(36).toUpperCase();
      var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      var code = "NOLIX-" + vid.substring(0, 4).toUpperCase() + "-" + ts + "-" + rand;

      var coupon = {
        code: code, type: type || "discount_10",
        expires_at: Date.now() + (5 * 60 * 1000), used: false,
        store: _storeDomain, session_id: window.NOLIX.session ? window.NOLIX.session.id : null,
        visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, issued_at: Date.now()
      };
      _storage.set("nolix_coupon_" + window.NOLIX.session.id, JSON.stringify(coupon));
      if (window.NOLIX.visitor) {
        window.NOLIX.visitor.coupons_issued.push({ code: coupon.code, issued_at: coupon.issued_at, expires_at: coupon.expires_at });
        saveVisitor();
      }
      console.log("🎟 COUPON GENERATED (UNIQUE):", coupon.code);

      // Register in DB: coupon_code → visitor_id (for webhook attribution)
      ;(async function() {
        try {
          await fetch(_API_BASE + "/api/track/coupon", {
            method: "POST", mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coupon_code: coupon.code, visitor_id: coupon.visitor_id,
              session_id:  coupon.session_id, store: coupon.store
            })
          });
          console.log("🎟 COUPON REGISTERED IN DB:", coupon.code, "→", coupon.visitor_id);
        } catch(e) { console.warn("⚠ COUPON REGISTRY SYNC FAILED (local only):", e); }
      })();

      return coupon;
    }
  };

  // ============================================================
  // VISITOR IDENTITY ENGINE
  // ============================================================
  function saveVisitor() {
    if (!window.NOLIX.visitor) return;
    _storage.set("nolix_visitor_data_" + window.NOLIX.visitor.id, JSON.stringify(window.NOLIX.visitor));
  }

  function initVisitor() {
    var VISITOR_KEY = "nolix_visitor_id";
    var now = Date.now(), today = new Date().toISOString().split("T")[0];
    function generateUUID() {
      try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { return crypto.randomUUID(); } } catch(e) {}
      return now.toString(36) + "-" + Math.random().toString(36).substring(2, 10);
    }
    var visitorId = _storage.get(VISITOR_KEY);
    if (!visitorId) { visitorId = generateUUID(); _storage.set(VISITOR_KEY, visitorId); }
    var visitorData = null;
    var raw = _storage.get("nolix_visitor_data_" + visitorId);
    if (raw) { try { visitorData = JSON.parse(raw); } catch(e) { visitorData = null; } }
    if (!visitorData) {
      visitorData = {
        id: visitorId, store: _storeDomain, first_seen: now,
        visit_count: 1, visits_today: 1, last_visit: now, last_visit_date: today,
        total_sessions: 1, coupons_issued: [], conversion_attempts: 0, rejections: 0,
        coupon_abuse_severity: 0, coupon_abuse_flag: false,
        cta_history: [], referrer_history: [], discount_history: [], learning_weights: null
      };
    } else {
      visitorData.visit_count++;
      visitorData.total_sessions++;
      visitorData.visits_today = visitorData.last_visit_date === today ? (visitorData.visits_today || 0) + 1 : 1;
      visitorData.last_visit_date = today;
      visitorData.last_visit = now;
      if (visitorData.coupons_issued && visitorData.coupons_issued.length > 0) {
        var last = visitorData.coupons_issued[visitorData.coupons_issued.length - 1];
        var ts   = now - last.issued_at;
        if      (ts < 10 * 60 * 1000)  { visitorData.coupon_abuse_severity = 3; visitorData.coupon_abuse_flag = true; }
        else if (ts < 30 * 60 * 1000)  { visitorData.coupon_abuse_severity = 2; visitorData.coupon_abuse_flag = true; }
        else if (ts < 120 * 60 * 1000 && visitorData.coupons_issued.length >= 3) { visitorData.coupon_abuse_severity = 1; visitorData.coupon_abuse_flag = false; }
        else    { visitorData.coupon_abuse_severity = 0; visitorData.coupon_abuse_flag = false; }
      }
      if (document.referrer) {
        visitorData.referrer_history = visitorData.referrer_history || [];
        visitorData.referrer_history.push({ referrer: document.referrer, page: window.location.pathname, timestamp: now });
        if (visitorData.referrer_history.length > 10) { visitorData.referrer_history.shift(); }
      }
    }
    _storage.set("nolix_visitor_data_" + visitorId, JSON.stringify(visitorData));
    window.NOLIX.visitor = visitorData;
    console.log("👤 NOLIX VISITOR:", { id: visitorData.id, visit_count: visitorData.visit_count, abuse_severity: visitorData.coupon_abuse_severity });
  }

  // ============================================================
  // SESSION ENGINE
  // ============================================================
  function initSession() {
    var SESSION_KEY = "nolix_session_id", TIMEOUT = 30 * 60 * 1000, now = Date.now();
    function generateUUID() {
      try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { return crypto.randomUUID(); } } catch(e) {}
      return now.toString(36) + "-" + Math.random().toString(36).substring(2, 10);
    }
    var sd = null, rw = _storage.get(SESSION_KEY);
    if (rw) { try { sd = JSON.parse(rw); } catch(e) { sd = null; } }
    var isNew = false;
    if (!sd || !sd.id || !sd.last_activity || (now - sd.last_activity > TIMEOUT)) {
      sd = { id: generateUUID(), visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, started_at: now, last_activity: now, page_views: 1, store: _storeDomain };
      isNew = true;
    } else { sd.last_activity = now; sd.page_views = (sd.page_views || 0) + 1; }
    _storage.set(SESSION_KEY, JSON.stringify(sd));
    window.NOLIX.session = sd;
    if (isNew) { console.log("SESSION CREATED", sd); } else { console.log("SESSION UPDATED", sd); }
    var _deb = null;
    function updateActivity() {
      if (_deb) return;
      _deb = setTimeout(function() {
        window.NOLIX.session.last_activity = Date.now();
        _storage.set(SESSION_KEY, JSON.stringify(window.NOLIX.session));
        _deb = null;
      }, 2000);
    }
    try {
      document.addEventListener("click",  updateActivity, { passive: true });
      document.addEventListener("scroll", updateActivity, { passive: true });
    } catch(e) {}
  }

  // ============================================================
  // BEHAVIORAL TRACKING ENGINE
  // ============================================================
  function initTracking() {
    if (!window.NOLIX.session || !window.NOLIX.session.id) {
      console.error("❌ NOLIX: SESSION NOT INITIALIZED."); return;
    }
    var _start = Date.now(), _lastActive = Date.now(), _idleMs = 5000;
    var _maxScroll = 0, _clickCount = 0, _clickTs = [], _isIdle = false;
    var _exitFired = false, _activeMs = 0;
    window.NOLIX.tracking_started_at = Date.now();
    window.NOLIX.tracking = {
      time_on_page: 0, active_time: 0, scroll_depth: 0, clicks: [],
      idle: false, hesitation_score: 0, engagement_score: 0, exit_intent_triggered: false
    };

    function onScroll() {
      try {
        var docH  = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
        var depth = docH > window.innerHeight ? Math.round((((window.scrollY || document.documentElement.scrollTop) + window.innerHeight) / docH) * 100) : 100;
        if (depth > _maxScroll) { _maxScroll = depth; window.NOLIX.tracking.scroll_depth = depth; }
      } catch(e) {}
      _lastActive = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    function onClick() {
      _clickCount++;
      var ts = Date.now();
      _clickTs.push(ts);
      if (_clickTs.length > 20) { _clickTs.shift(); }
      window.NOLIX.tracking.clicks = _clickTs.slice();
      _lastActive = Date.now();
      if (_isIdle) { _isIdle = false; window.NOLIX.tracking.idle = false; }
    }

    var _lastMove = 0;
    function onMouseMove(e) {
      var now = Date.now();
      if (now - _lastMove < 200) return;
      _lastMove = now;
      if (_exitFired) return;
      if (e.clientY < 20) { triggerExitIntent(); }
    }

    function triggerExitIntent() {
      if (_exitFired) return;
      _exitFired = true;
      window.NOLIX.tracking.exit_intent_triggered = true;
      var features = window.NOLIX.model.currentFeatures();
      var p        = features ? window.NOLIX.model.predict(features) : null;
      var cluster  = window.NOLIX.embedding.classify();
      console.log("🚨 NOLIX: EXIT INTENT", { score: p ? p.score : null, cluster: cluster });
      pushEvent("exit_intent", { score: p ? p.score : null, cluster: cluster });
      window.NOLIX.api.send("exit_intent", { score: p ? p.score : null, cluster: cluster });
      window.NOLIX.feedback.save({ event: "exit_intent", session_id: window.NOLIX.session.id, visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, timestamp: Date.now() });
      runDecisionEngine();
    }

    function computeScores() {
      var tp = window.NOLIX.tracking.time_on_page, at = window.NOLIX.tracking.active_time;
      var sd = window.NOLIX.tracking.scroll_depth, cl = _clickCount;
      var hesitation = (tp > 25 ? 0.3 : 0) + (sd < 20 ? 0.3 : 0) + (cl === 0 && tp > 25 ? 0.3 : 0) + (sd > 60 && cl === 0 ? 0.2 : 0);
      hesitation = clamp(Math.round(hesitation * 100) / 100, 0, 1);
      var engagement = 0;
      if (sd >= 25) { engagement += 0.2; } if (sd >= 50) { engagement += 0.2; }
      if (sd >= 75) { engagement += 0.2; } if (cl >= 1)  { engagement += 0.2; }
      if (cl >= 3)  { engagement += 0.1; } if (at > 30)  { engagement += 0.1; }
      engagement = clamp(Math.round(engagement * 100) / 100, 0, 1);
      window.NOLIX.tracking.hesitation_score = hesitation;
      window.NOLIX.tracking.engagement_score = engagement;
    }

    var _loop = setInterval(function() {
      var now = Date.now(), sec = Math.round((now - _start) / 1000);
      window.NOLIX.tracking.time_on_page = sec;
      if (!_isIdle && (now - _lastActive) > _idleMs) {
        _isIdle = true; window.NOLIX.tracking.idle = true;
        console.log("💤 NOLIX: USER IDLE");
      }
      if (!_isIdle) { _activeMs += 1000; window.NOLIX.tracking.active_time = Math.round(_activeMs / 1000); }
      computeScores();
      runDecisionEngine();
      if (sec > 0 && sec % 10 === 0) {
        window.NOLIX.memory.recordStory();
        window.NOLIX.embedding.updateGlobal();
        window.NOLIX.embedding.snapshot();
      }
    }, 1000);

    window.addEventListener("beforeunload", function() { clearInterval(_loop); });
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
    } catch(e) { console.warn("⚠ NOLIX: Listener error:", e); }
    // ── NEURAL BRIDGE — HEARTBEAT + EVENT BINDINGS ─────────────────────────
    // Every 5s: send heartbeat → server evaluates → returns decision if warranted
    // onClick: send click event immediately → get instant decision
    // onScroll (throttled): send scroll depth update every 3s max
    var _heartbeatInterval = setInterval(function() {
      if (!window.NOLIX.decision || !window.NOLIX.decision.fired) {
        sendEvent("heartbeat", {
          scroll_depth:     window.NOLIX.tracking.scroll_depth,
          time_on_page:     window.NOLIX.tracking.time_on_page,
          hesitation_score: window.NOLIX.tracking.hesitation_score,
          engagement_score: window.NOLIX.tracking.engagement_score,
          idle:             window.NOLIX.tracking.idle
        });
      }
    }, 5000);

    var _lastScrollSend = 0;
    document.addEventListener("scroll", function() {
      var now = Date.now();
      if (now - _lastScrollSend < 3000) return; // throttle: max 1 per 3s
      _lastScrollSend = now;
      if (!window.NOLIX.decision || !window.NOLIX.decision.fired) {
        sendEvent("scroll", { scroll_depth: window.NOLIX.tracking.scroll_depth });
      }
    }, { passive: true });

    document.addEventListener("click", function(e) {
      if (!window.NOLIX.decision || !window.NOLIX.decision.fired) {
        sendEvent("click", {
          target: e.target ? e.target.tagName : "unknown",
          x: e.clientX, y: e.clientY
        });
      }
    }, { passive: true });

    window.addEventListener("beforeunload", function() { clearInterval(_heartbeatInterval); });
    // ─────────────────────────────────────────────────────────────────────────

    console.log("👁 NOLIX TRACKING ACTIVE", window.NOLIX.tracking);
  }

  // ============================================================
  // DECISION ENGINE V4 (ML-Scored + Embedding-Classified)
  // ============================================================
  // ============================================================
  // DECISION ENGINE V5 (STEP 11 — Revenue Brain)
  // final_score = ml_score + similarity_boost - fraud_penalty + revenue_weight
  // GATE 0: A/B group — control group = zero intervention
  // ============================================================
  function runDecisionEngine() {
    if (!window.NOLIX.session || !window.NOLIX.session.id) return;
    if (!window.NOLIX.tracking) return;
    if (window.NOLIX.decision && window.NOLIX.decision.fired) return;

    // ── GATE -1A: DISTRIBUTED RUNTIME FLAG (STEP 13 PART 7) ─────────────────
    // Reads from window.NOLIX.runtime — fetched LIVE from server DB on boot.
    // This is the distributed kill-switch: admin sets ai_enabled=false in DB
    // → health engine auto-sets it → ALL instances see it on next boot.
    if (window.NOLIX.runtime) {
      if (window.NOLIX.runtime.maintenance_mode === true) {
        console.warn("🔴 DECISION ENGINE: MAINTENANCE MODE. All decisions blocked.");
        return;
      }
      if (window.NOLIX.runtime.ai_enabled === false) {
        console.warn("🛑 DECISION ENGINE: ai_enabled=false (server runtime flag). No popup will show.");
        return;
      }
    }

    // ── GATE -1B: MODEL FAIL-SAFE (STEP 11.1 PART 9) ────────────────────────
    // If server has disabled AI (AUC < 0.55), block all interventions.
    if (window.NOLIX.model && window.NOLIX.model.ai_enabled === false) {
      console.warn("🛑 DECISION ENGINE: AI DISABLED by model fail-safe (AUC < 0.55). No popup.");
      return;
    }

    var vid = window.NOLIX.visitor ? window.NOLIX.visitor.id : null;

    // ── GATE 0: A/B BUCKET CHECK (STEP 11 PART 1) ──────────────────────────
    // Deterministic hash → 0-99 bucket. Bucket < 50 = ML group.
    // Control group gets ZERO popup, ZERO coupon, ZERO intervention.
    if (vid) {
      var bucket = (function(id) {
        var hash = 5381;
        for (var i = 0; i < id.length; i++) {
          hash = ((hash << 5) + hash) + id.charCodeAt(i);
          hash = hash & 0x7fffffff;
        }
        return hash % 100;
      })(vid);

      window.NOLIX.decision._ab_bucket = bucket;
      window.NOLIX.decision._ab_group  = bucket < 50 ? "ml" : "control";

      if (bucket >= 50) {
        // Control group: observe silently only — no ML, no popup
        console.log("📊 NOLIX A/B: CONTROL GROUP (bucket " + bucket + ") — observing only.");
        pushEvent("ab_control_observe", { visitor_id: vid, bucket: bucket });
        return;
      }
      console.log("🤖 NOLIX A/B: ML GROUP (bucket " + bucket + ") — running intelligence pipeline.");
    }

    // ── GATE 1: FRAUD CHECK ─────────────────────────────────────────────────
    var abuseSeverity = window.NOLIX.visitor ? (window.NOLIX.visitor.coupon_abuse_severity || 0) : 0;
    if (abuseSeverity >= 3) {
      console.warn("🚫 NOLIX: Hard fraud block. severity:", abuseSeverity);
      return;
    }

    // ── STEP 1: ML BASE SCORE ───────────────────────────────────────────────
    var features = window.NOLIX.model.currentFeatures();
    if (!features) return;
    var p        = window.NOLIX.model.predict(features);
    var mlScore  = p.score;
    var cluster  = window.NOLIX.embedding.classify();
    var ex       = window.NOLIX.tracking.exit_intent_triggered;

    // ── STEP 2: SIMILARITY BOOST ────────────────────────────────────────────
    var simBoost = 0;
    if (window.NOLIX.visitor) {
      var globalMem = window.NOLIX.globalMemory.get(window.NOLIX.visitor.id);
      if (globalMem && globalMem.centroid) {
        var vec = window.NOLIX.embedding.generate(window.NOLIX.tracking, window.NOLIX.visitor);
        if (vec) {
          var sim = window.NOLIX.similarity.cosine(vec, globalMem.centroid);
          if (sim > 0.75) { simBoost = 0.10; }
          else if (sim > 0.60) { simBoost = 0.05; }
        }
      }
    }

    // ── STEP 3: FRAUD PENALTY ───────────────────────────────────────────────
    var fraudPenalty = 0;
    if (abuseSeverity >= 2)     { fraudPenalty = 0.15; }
    else if (abuseSeverity >= 1){ fraudPenalty = 0.075; }

    // ── STEP 4: REVENUE WEIGHT (loyalty boost) ──────────────────────────────
    var revenueWeight = 0;
    var visitCount    = window.NOLIX.visitor ? (window.NOLIX.visitor.visit_count || 0) : 0;
    if (visitCount >= 3 && abuseSeverity === 0) { revenueWeight = 0.05; }

    // ── STEP 5: FINAL SCORE (Revenue Brain formula) ─────────────────────────
    // final_score = model_probability + similarity_boost - fraud_penalty + revenue_weight
    var finalScore = clamp(
      Math.round((mlScore + simBoost - fraudPenalty + revenueWeight) * 1000) / 1000,
      0, 1
    );

    // ── STEP 6: DISCOUNT TIER ───────────────────────────────────────────────
    var discountPct  = 0;
    var discountTier = "none";
    if      (finalScore >= 0.80) { discountPct = 15; discountTier = "aggressive"; }
    else if (finalScore >= 0.65) { discountPct = 10; discountTier = "standard";   }
    else if (finalScore >= 0.50) { discountPct =  5; discountTier = "soft";       }

    // ── STEP 7: ACTION DECISION ─────────────────────────────────────────────
    var THRESHOLD = 0.65;
    var action    = "none";
    var reason    = "observing";

    if (finalScore >= THRESHOLD || (ex && finalScore >= 0.45)) {
      action = "discount";
      reason = ex
        ? "exit_intent_score_" + finalScore
        : "high_intent_score_" + finalScore + "_cluster_" + cluster;
    } else { return; }

    // ── RECORD DECISION ─────────────────────────────────────────────────────
    window.NOLIX.decision = {
      fired:            true,
      ab_group:         window.NOLIX.decision._ab_group || "ml",
      ab_bucket:        window.NOLIX.decision._ab_bucket || 0,
      ml_score:         mlScore,
      similarity_boost: simBoost,
      fraud_penalty:    fraudPenalty,
      revenue_weight:   revenueWeight,
      final_score:      finalScore,
      discount_pct:     discountPct,
      discount_tier:    discountTier,
      confidence:       p.confidence,
      model_type:       p.model_type,
      server_version:   window.NOLIX.model.server_version,
      cluster:          cluster,
      action:           action,
      reason:           reason,
      fired_at:         Date.now(),
      visitor_id:       vid
    };

    console.log("🧠 NOLIX DECISION V5 (Revenue Brain):", window.NOLIX.decision);
    pushEvent("prediction_decision", window.NOLIX.decision);
    window.NOLIX.api.send("prediction_decision", window.NOLIX.decision);

    if (action === "discount") { showDiscountPopup(discountPct, discountTier); }
  }

  // ============================================================
  // ACTION ENGINE (Popup + Coupon + Truth-Anchored Training)
  // ============================================================
  function showDiscountPopup(discountPct, discountTier) {
    discountPct  = discountPct  || 10;
    discountTier = discountTier || "standard";

    var POPUP_KEY = "nolix_popup_shown_" + window.NOLIX.session.id;
    if (_storage.get(POPUP_KEY)) { return; }
    _storage.set(POPUP_KEY, "1");

    window.NOLIX.feedback.save({ event: "popup_shown", session_id: window.NOLIX.session.id, visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, timestamp: Date.now() });
    pushEvent("popup_shown", { session_id: window.NOLIX.session.id, score: window.NOLIX.decision ? window.NOLIX.decision.final_score : null, discount_pct: discountPct, discount_tier: discountTier });
    window.NOLIX.api.send("popup_shown", { session_id: window.NOLIX.session.id, discount_pct: discountPct, ab_group: window.NOLIX.decision ? window.NOLIX.decision.ab_group : "ml" });

    // Server-side recording (non-blocking)
    ;(async function() {
      try {
        var vid = window.NOLIX.visitor ? window.NOLIX.visitor.id : null;
        var sid = window.NOLIX.session ? window.NOLIX.session.id : null;
        if (vid && sid) {
          await fetch(_API_BASE + "/api/track", {
            method: "POST", mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "ab_ml_popup_shown", visitor: window.NOLIX.visitor,
              session: window.NOLIX.session, payload: {
                ab_group: "ml", discount_pct: discountPct, discount_tier: discountTier,
                final_score: window.NOLIX.decision ? window.NOLIX.decision.final_score : null
              }
            })
          });
        }
      } catch(e) { /* non-critical */ }
    })();

    // Premium UI Copy
    var headline = discountTier === "aggressive"
      ? "لا تفوت هذه الفرصة الاستثنائية!"
      : discountTier === "soft"
      ? "هدية خاصة تقديراً لزيارتك"
      : "عرض حصري لفترة محدودة";

    var overlay = document.createElement("div");
    overlay.id = "nolix-premium-overlay";
    overlay.style.cssText = [
      "position:fixed;inset:0;z-index:2147483647;",
      "background:rgba(15,23,42,0.65);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);",
      "display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;",
      "opacity:0;transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1);"
    ].join("");

    var popup = document.createElement("div");
    popup.id = "nolix-premium-popup";
    popup.dir = "rtl";
    popup.style.cssText = [
      "background:linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%);",
      "border:1px solid rgba(255,255,255,0.8);border-radius:24px;",
      "padding:40px 32px 32px;max-width:440px;width:100%;",
      "box-shadow:0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);",
      "position:relative;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
      "text-align:center;transform:translateY(30px) scale(0.95);transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1);box-sizing:border-box;"
    ].join("");

    popup.innerHTML = [
      '<button id="nolix-close" style="position:absolute;top:16px;left:16px;background:rgba(241,245,249,0.8);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;color:#64748b;transition:all 0.2s;">&#x2715;</button>',
      '<div style="font-size:48px;margin-bottom:16px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.1));">' + (discountTier === "aggressive" ? "🔥" : discountTier === "soft" ? "🎁" : "✨") + '</div>',
      '<h2 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">' + headline + '</h2>',
      '<p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.6;">لقد قمنا بتفعيل خصم <span style="display:inline-block;padding:2px 8px;background:linear-gradient(135deg, #ef4444, #b91c1c);color:#fff;border-radius:6px;font-weight:800;margin:0 4px;box-shadow:0 4px 12px rgba(239,68,68,0.3);">' + discountPct + '%</span> على طلبك الحالي. استخدمه قبل انتهاء الوقت!</p>',
      '<div id="nolix-timer-container" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:24px;display:flex;flex-direction:column;align-items:center;">',
        '<span style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px;">ينتهي العرض خلال</span>',
        '<div id="nolix-timer" style="font-size:36px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;letter-spacing:2px;background:linear-gradient(to right, #0f172a, #334155);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">05:00</div>',
      '</div>',
      '<button id="nolix-cta" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#fff;border:none;border-radius:14px;padding:16px 32px;font-size:16px;font-weight:700;cursor:pointer;width:100%;box-shadow:0 10px 15px -3px rgba(15,23,42,0.3);transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;">',
        '<span>تفعيل الخصم الآن</span>',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
      '</button>',
      '<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;display:flex;align-items:center;justify-content:center;gap:4px;">',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        'تسوق آمن ومضمون 100%',
      '</p>'
    ].join("");
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Add hover effects for buttons dynamically
    var closeBtn = document.getElementById("nolix-close");
    var ctaB = document.getElementById("nolix-cta");
    if(closeBtn) {
      closeBtn.onmouseenter = function() { this.style.background = "rgba(226,232,240,1)"; this.style.color = "#0f172a"; };
      closeBtn.onmouseleave = function() { this.style.background = "rgba(241,245,249,0.8)"; this.style.color = "#64748b"; };
    }
    if(ctaB) {
      ctaB.onmouseenter = function() { this.style.transform = "translateY(-2px)"; this.style.boxShadow = "0 14px 20px -3px rgba(15,23,42,0.4)"; };
      ctaB.onmouseleave = function() { this.style.transform = "translateY(0)"; this.style.boxShadow = "0 10px 15px -3px rgba(15,23,42,0.3)"; };
    }

    // Trigger Animation
    requestAnimationFrame(function() { 
      requestAnimationFrame(function() { 
        overlay.style.opacity = "1"; 
        popup.style.transform = "translateY(0) scale(1)"; 
      }); 
    });

    var _sec = 300, _tel = document.getElementById("nolix-timer");
    var _ti  = setInterval(function() {
      _sec--;
      if (_sec <= 0) { clearInterval(_ti); closePopup(false); return; }
      var m = Math.floor(_sec / 60), s = _sec % 60;
      if (_tel) { _tel.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s); }
      // Red pulse when under 30 seconds
      if (_sec === 30 && _tel) {
        _tel.style.background = "linear-gradient(to right, #ef4444, #b91c1c)";
        _tel.style.webkitBackgroundClip = "text";
        document.getElementById("nolix-timer-container").style.borderColor = "#fecaca";
        document.getElementById("nolix-timer-container").style.background = "#fef2f2";
      }
    }, 1000);

    var _closed = false;
    function closePopup(fromCTA) {
      if (_closed) return;
      _closed = true;
      clearInterval(_ti);
      overlay.style.opacity = "0"; 
      popup.style.transform = "translateY(20px) scale(0.95)";
      setTimeout(function() { if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); } }, 400);
      
      if (!fromCTA) {
        var features = window.NOLIX.model.currentFeatures();
        var label    = window.NOLIX.truth.label("popup_dismissed");
        window.NOLIX.model.train(features, label);
        console.log("❌ TRAINED ON DISMISSAL — label:", label);
        window.NOLIX.feedback.save({ event: "popup_dismissed", visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, session_id: window.NOLIX.session.id, status: "rejected", timestamp: Date.now() });
        if (window.NOLIX.visitor) { window.NOLIX.visitor.rejections++; saveVisitor(); }
        window.NOLIX.api.send("popup_dismissed", { session: window.NOLIX.session });
        pushEvent("popup_dismissed", { session_id: window.NOLIX.session.id });
      }
    }

    if (closeBtn) { closeBtn.addEventListener("click", function() { closePopup(false); }); }

    if (ctaB) {
      ctaB.addEventListener("click", function() {
        var coupon = window.NOLIX.coupon.generate("discount_10");
        if (!coupon) { alert("عذراً، لا يمكن إصدار الكوبون حالياً."); closePopup(false); return; }

        if (window.NOLIX.visitor) {
          window.NOLIX.visitor.cta_history = window.NOLIX.visitor.cta_history || [];
          window.NOLIX.visitor.cta_history.push({ action: "accepted_discount", coupon: coupon.code, timestamp: Date.now() });
          window.NOLIX.visitor.conversion_attempts++;
          saveVisitor();
        }

        var features = window.NOLIX.model.currentFeatures();
        var ctaLabel = window.NOLIX.truth.label("cta_click");
        window.NOLIX.model.train(features, ctaLabel);
        console.log("🎯 TRAINED ON CTA CLICK — label:", ctaLabel, "(weak — awaiting purchase confirmation)");

        window.NOLIX.feedback.save({ event: "cta_click", visitor_id: window.NOLIX.visitor ? window.NOLIX.visitor.id : null, session_id: window.NOLIX.session.id, hesitation_score: window.NOLIX.tracking.hesitation_score, coupon: coupon.code, status: "pending_purchase_confirmation", timestamp: Date.now() });

        pushEvent("popup_clicked", { session_id: window.NOLIX.session.id, coupon: coupon.code, truth_label: ctaLabel });
        window.NOLIX.api.send("cta_click", { coupon: coupon, session: window.NOLIX.session, visitor: window.NOLIX.visitor, status: "pending_purchase_confirmation" });

        window.NOLIX.memory.store("last_cta_action", { action: "accepted_discount", coupon: coupon.code, timestamp: Date.now() });
        window.NOLIX.embedding.updateGlobal();

        console.log("💎 NOLIX: COUPON ISSUED —", coupon.code);
        alert("🎉 مبروك! كود الخصم الخاص بك: " + coupon.code + "\n\nتم نسخ الكود تلقائياً. استمتع بتسوقك!");
        navigator.clipboard.writeText(coupon.code).catch(function(){}); // Auto copy to clipboard
        closePopup(true);
      });
    }

    overlay.addEventListener("click", function(e) { if (e.target === overlay) { closePopup(false); } });
  }

  // ============================================================
  // CORE BOOT v3.0 — Self-Learning Revenue Brain
  // 5-step ordered boot sequence.
  // ============================================================
  function initNolix() {
    if (window.NOLIX.initialized) return;

    console.log("🔥 NOLIX BOOT v3.0 — Self-Learning Revenue Brain");
    window.NOLIX.status      = "initialized";
    window.NOLIX.initialized = true;
    window.NOLIX.version     = "3.0";
    window.NOLIX.loaded_at   = Date.now();
    window.NOLIX.url         = window.location.href;
    window.NOLIX.decision    = { user_type: null, action: null, reason: null, fired: false };

    // ── STEP 1: Identity + Session (synchronous — required before everything) ──
    initVisitor();
    initSession();

    // ── STEP 2: Local weights (localStorage — instant, per-visitor fine-tuning) ──
    window.NOLIX.model.loadWeights();

    // ── STEP 3: Global server weights (LAYER 7 — eliminates cold start) ──────
    // Server holds weights trained on ALL visitors' confirmed purchases.
    // Runs async — tracking starts without waiting for server response.
    // If server version > local version → overwrites with better baseline.
    window.NOLIX.model.loadServerWeights().then(function() {
      console.log("🌐 NOLIX: Global model synced. Server version:", window.NOLIX.model.server_version);
    }).catch(function(e) {
      console.warn("⚠ NOLIX: Server sync failed — using local weights only.");
    });

    // ── STEP 4: Purchase signal poll (LAYER 6 Truth System) ─────────────────
    // Polls /api/webhooks/shopify/purchase?visitor_id=X
    // If Shopify confirmed payment since last visit → train(features, 1.0)
    checkPurchaseFlag();

    // ── STEP 5: Behavioral tracking + decision engine (main runtime loop) ───
    initTracking();

    console.log("🧠 NOLIX v3.0 READY:", {
      version:        "3.0",
      model_type:     window.NOLIX.model.type,
      weights_8d:     window.NOLIX.model.weights,
      server_version: window.NOLIX.model.server_version,
      store:          window.NOLIX.store,
      visitor_id:     window.NOLIX.visitor ? window.NOLIX.visitor.id : null,
      visit_count:    window.NOLIX.visitor ? window.NOLIX.visitor.visit_count : 0
    });
  }

  var _retries = 0;
  function attemptBoot() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      // BOOT SEQUENCE:
      // 1. Verify license (hard block if invalid domain)
      // 2. Fetch runtime flags from server (distributed kill-switch)
      // 3. Initialize NOLIX if allowed
      verifyLicense().then(function(licensed) {
        if (!licensed) {
          console.error("🚫 NOLIX: BOOT HALTED — Invalid license for domain: " + location.hostname);
          window.NOLIX.status = "license_denied";
          return;
        }

        // STEP 13: fetch live runtime flags from server DB
        return fetchRuntimeFlags().then(function(flagsOk) {
          if (flagsOk === false) {
            // maintenance_mode=true: do not initialize
            console.warn("🔴 NOLIX: Halted — maintenance mode active.");
            return;
          }
          initNolix();
        });

      }).catch(function(e) {
        console.warn("⚠ NOLIX: Boot error. Proceeding in fallback.", e);
        initNolix();
      });
    } else if (_retries < 100) {
      _retries++;
      setTimeout(attemptBoot, 50);
    } else {
      console.error("❌ NOLIX: Boot timeout after 5 seconds.");
    }
  }

  attemptBoot();
}
