/**
 * NOLIX × ZENO Tracking Engine v4.0 — Causal Intelligence Edition
 *
 * ARCHITECTURE LAW:
 * ─────────────────
 * This file = NOLIX (Executor). It has ZERO decision logic.
 * It collects signals, sends them to Zeno, and executes exactly
 * what Zeno returns. Nothing more. Any fallback action = BUG.
 *
 * Usage:
 *   <script src="https://yourapp.com/engine.js"
 *           data-key="YOUR_EMBED_KEY"
 *           data-store="yourstore.com"></script>
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript || (function () {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  const STORE_DOMAIN = scriptTag.getAttribute("data-store") || location.hostname.replace(/^www\./, "");
  const EMBED_KEY    = scriptTag.getAttribute("data-key") || STORE_DOMAIN;
  const API_BASE     = scriptTag.src.replace("/engine.js", "").replace("/popup.js", "");
  const SESSION_KEY  = "zeno_session_v4_" + EMBED_KEY;
  const LOCK_KEY     = "zeno_action_lock_" + EMBED_KEY; // 1 action per session, hard lock

  // ── 1. Session State ──────────────────────────────────────────────────────
  function loadSession() {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      sessionId:       "z_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      startTime:       Date.now(),
      pagesViewed:     [],
      scrollDepth:     0,
      cartStatus:      "empty",
      hesitations:     0,
      ctaHoverCount:   0,
      mouseLeaveCount: 0,
      tabHiddenCount:  0,
      returnVisitor:   !!localStorage.getItem("zeno_returning_" + EMBED_KEY),
    };
  }

  let session = loadSession();

  // Mark return visitor for future sessions
  localStorage.setItem("zeno_returning_" + EMBED_KEY, "1");

  // Track current page
  const currentPage = location.pathname;
  if (!session.pagesViewed.includes(currentPage)) {
    session.pagesViewed.push(currentPage);
  }

  function save() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {}
  }
  save();

  function signals(trigger) {
    return {
      session_id:       session.sessionId,
      trigger:          trigger,
      time_on_site:     Math.round((Date.now() - session.startTime) / 1000),
      pages_viewed:     session.pagesViewed.length,
      scroll_depth:     session.scrollDepth,
      cart_status:      session.cartStatus,
      hesitations:      session.hesitations,
      cta_hover_count:  session.ctaHoverCount,
      mouse_leave_count: session.mouseLeaveCount,
      tab_hidden_count: session.tabHiddenCount,
      return_visitor:   session.returnVisitor,
      current_url:      window.location.href,
      device:           /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    };
  }

  // ── 2. Signal Collection ─────────────────────────────────────────────────

  // A. Scroll depth
  let maxScroll = 0;
  window.addEventListener("scroll", function () {
    const h = document.documentElement, b = document.body;
    const pct = Math.round((h.scrollTop || b.scrollTop) / ((h.scrollHeight || b.scrollHeight) - h.clientHeight) * 100);
    if (pct > maxScroll) {
      maxScroll = Math.min(pct, 100);
      if (maxScroll > session.scrollDepth) {
        session.scrollDepth = maxScroll;
        save();
      }
    }
  }, { passive: true });

  // B. Cart tracking
  document.addEventListener("click", function (e) {
    const el = e.target;
    if (!el) return;
    const text = (el.innerText || "").toLowerCase();
    if (el.matches("[data-action='add-to-cart'], .add-to-cart, [data-testid='add-to-cart']") ||
        /add to cart|add to bag|añadir al carrito/i.test(text)) {
      session.cartStatus = "added";
      save();
      sendToZeno("cart_added");
    }
    if (el.matches("[data-action='checkout'], .checkout-button, [data-testid='checkout']") ||
        /checkout|buy now|place order/i.test(text)) {
      session.cartStatus = "checkout";
      save();
      sendToZeno("checkout_intent");
    }
    // CTA hover deduped tracking via click proximity
  }, true);

  // C. CTA hover counting
  document.addEventListener("mouseover", function (e) {
    const el = e.target;
    if (!el) return;
    const text = (el.innerText || el.getAttribute("aria-label") || "").toLowerCase();
    if (/add to cart|buy now|checkout|add to bag/i.test(text)) {
      session.ctaHoverCount = (session.ctaHoverCount || 0) + 1;
      save();
    }
  }, { passive: true });

  // D. Exit intent (mouse leave from document top)
  let exitFired = false;
  document.addEventListener("mouseleave", function (e) {
    if (e.clientY < 20 && !exitFired) {
      exitFired = true;
      session.mouseLeaveCount = (session.mouseLeaveCount || 0) + 1;
      session.hesitations++;
      save();
      sendToZeno("exit_intent");
    }
  });

  // E. Tab visibility (hidden = user distracted or considering leaving)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      session.tabHiddenCount = (session.tabHiddenCount || 0) + 1;
      session.hesitations++;
      save();
    }
  });

  // F. Idle detection — genuine hesitation inside the funnel
  let idleTimer;
  const resetIdle = function () {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      session.hesitations++;
      save();
      const inFunnel = location.href.includes("cart") ||
                       location.href.includes("checkout") ||
                       session.cartStatus !== "empty";
      sendToZeno(inFunnel ? "funnel_idle" : "browse_idle");
    }, 18000); // 18 seconds of silence = meaningful hesitation
  };
  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, resetIdle, { passive: true });
  });
  resetIdle();

  // G. Checkout success detection (Shopify/WooCommerce)
  function detectConversion() {
    const isSuccess =
      /thank.?you|order.?confirm|order.?success|success/i.test(document.title) ||
      /\/order-confirmation|\/thank.?you|\/checkout\/success/i.test(location.pathname) ||
      !!document.querySelector("[class*='order-confirmation'], [class*='thank-you'], [id*='checkout-success']");

    if (isSuccess) {
      // Bind outcome to Zeno's calibration system
      fetch(API_BASE + "/api/engine/reality-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.sessionId,
          actual_class: "convert",
          verification_source: "checkout_event",
        }),
        keepalive: true,
      }).catch(function () {});
    }
  }
  detectConversion();

  // ── 3. Decision Send — The ONLY connection to Zeno Brain ─────────────────
  let pending = false;

  function sendToZeno(trigger) {
    if (sessionStorage.getItem(LOCK_KEY)) return; // Hard lock: 1 action per session
    if (pending) return;
    pending = true;

    fetch(API_BASE + "/api/engine/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signals(trigger)),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      pending = false;

      if (data.blocked_reason) {
        // Domain gate or billing block — silent exit
        return;
      }

      if (data.action && data.action !== "do_nothing") {
        executeDecision(data);
      }
      // do_nothing = correct decision, not a failure. Do nothing silently.
    })
    .catch(function () { pending = false; });
  }

  // ── 4. Execution Layer — NOLIX runs Zeno's decision ─────────────────────
  // NOLIX has zero opinion about what to show. It renders exactly what Zeno returned.
  function executeDecision(data) {
    if (sessionStorage.getItem(LOCK_KEY)) return;
    sessionStorage.setItem(LOCK_KEY, "1"); // Lock: one action per session

    // Inject Inter font
    if (!document.getElementById("zeno-font")) {
      const lnk = document.createElement("link");
      lnk.id = "zeno-font"; lnk.rel = "stylesheet";
      lnk.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(lnk);
    }

    const THEMES = {
      urgency:       { grad: "linear-gradient(135deg,#1f0a0a 0%,#3d1515 100%)", accent: "#fb7185", tag: "⏰ Limited Time"    },
      popup_info:    { grad: "linear-gradient(135deg,#0a0f1f 0%,#1a2340 100%)", accent: "#818cf8", tag: "💡 Quick Note"      },
      free_shipping: { grad: "linear-gradient(135deg,#0a1a2e 0%,#0c2a49 100%)", accent: "#38bdf8", tag: "🚚 Free Shipping"   },
      bundle:        { grad: "linear-gradient(135deg,#0a1a10 0%,#0e2918 100%)", accent: "#34d399", tag: "🎁 Bundle Offer"    },
      discount_5:    { grad: "linear-gradient(135deg,#1a0a2e 0%,#2d1458 100%)", accent: "#a78bfa", tag: "🎁 5% Off"          },
      discount_10:   { grad: "linear-gradient(135deg,#1a0a2e 0%,#2d1458 100%)", accent: "#c084fc", tag: "💰 10% Off"         },
      discount_15:   { grad: "linear-gradient(135deg,#180a1f 0%,#2d0f3d 100%)", accent: "#e879f9", tag: "🔥 Flash Deal 15%"  },
    };

    const theme = THEMES[data.action] || THEMES.urgency;
    const discountCode =
      data.action === "discount_5"  ? "ZENO5"  :
      data.action === "discount_10" ? "ZENO10" :
      data.action === "discount_15" ? "ZENO15" : null;

    // ── Overlay ──────────────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999990;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);animation:zeFadeIn .3s ease;";

    // ── Popup Card ───────────────────────────────────────────────────────────
    const card = document.createElement("div");
    card.style.cssText = [
      "position:fixed;z-index:9999999;",
      "bottom:24px;right:24px;",
      "width:360px;max-width:calc(100vw - 32px);",
      "border-radius:24px;padding:28px 32px;",
      "background:" + theme.grad + ";",
      "border:1px solid rgba(255,255,255,0.10);",
      "box-shadow:0 24px 64px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04);",
      "font-family:'Inter',system-ui,sans-serif;color:#f1f5f9;",
      "animation:zeSlideUp .45s cubic-bezier(0.22,1,0.36,1);",
    ].join("");

    card.innerHTML = [
      "<style>",
      "@keyframes zeSlideUp{from{opacity:0;transform:translateY(30px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes zeFadeIn{from{opacity:0}to{opacity:1}}",
      ".ze-btn{display:block;width:100%;padding:13px 20px;border-radius:12px;border:none;",
      "background:" + theme.accent + ";color:#000;font-weight:700;font-size:14px;cursor:pointer;",
      "font-family:inherit;transition:transform .15s,box-shadow .15s;margin-top:18px;}",
      ".ze-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px " + theme.accent + "55;}",
      ".ze-close{position:absolute;top:14px;right:16px;background:none;border:none;color:rgba(255,255,255,.4);",
      "font-size:18px;cursor:pointer;line-height:1;padding:4px;}",
      ".ze-close:hover{color:rgba(255,255,255,.8);}",
      ".ze-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:" + theme.accent + ";margin-bottom:10px;}",
      ".ze-h{font-size:20px;font-weight:800;line-height:1.2;margin-bottom:8px;}",
      ".ze-sub{font-size:13px;color:rgba(241,245,249,.75);line-height:1.65;}",
      discountCode ? ".ze-code{margin-top:14px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:8px;padding:10px 14px;font-family:monospace;font-size:15px;font-weight:700;color:" + theme.accent + ";text-align:center;letter-spacing:.1em;}" : "",
      "</style>",
      "<button class='ze-close' id='ze-close' aria-label='Close'>✕</button>",
      "<div class='ze-tag'>" + theme.tag + "</div>",
      "<div class='ze-h'>" + (data.headline || "") + "</div>",
      "<div class='ze-sub'>" + (data.sub_message || "") + "</div>",
      discountCode ? "<div class='ze-code'>" + discountCode + "</div>" : "",
      "<button class='ze-btn' id='ze-cta'>" + (data.cta_text || "Claim Offer") + "</button>",
    ].join("");

    document.body.appendChild(overlay);
    document.body.appendChild(card);

    function close() {
      [overlay, card].forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      // Bind exit outcome after 30s if no conversion detected
      setTimeout(function () {
        if (!sessionStorage.getItem("zeno_converted_" + session.sessionId)) {
          fetch(API_BASE + "/api/engine/reality-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: session.sessionId,
              actual_class: "exit",
              verification_source: "timeout",
            }),
            keepalive: true,
          }).catch(function () {});
        }
      }, 30000);
    }

    document.getElementById("ze-close").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("ze-cta").addEventListener("click", function () {
      sessionStorage.setItem("zeno_converted_" + session.sessionId, "1");

      // Report conversion
      fetch(API_BASE + "/api/engine/reality-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: data.session_id,
          actual_class: "convert",
          verification_source: "checkout_event",
        }),
        keepalive: true,
      }).catch(function () {});

      // Apply discount to URL if applicable
      if (discountCode) {
        const url = new URL(window.location.href);
        url.searchParams.set("discount", discountCode);
        window.history.replaceState({}, "", url.toString());
        this.innerText = "✓ Code Applied: " + discountCode;
        this.style.background = "#10b981";
        setTimeout(close, 2200);
      } else {
        close();
      }
    });
  }

  // ── 5. Early evaluation — Zeno evaluates every visitor at the 10s mark ───
  // Not to "trap" them but to understand if they need help early.
  setTimeout(function () { sendToZeno("early_eval"); }, 10000);

})();
