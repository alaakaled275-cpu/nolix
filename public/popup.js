/**
 * ConvertAI – Embeddable Popup Script v2.0
 * Usage: <script src="https://yourapp.com/popup.js" data-key="YOUR_EMBED_KEY"></script>
 *
 * What's new in v2:
 * - Analyzes early (5s after load), but respects delay_ms from the API
 * - Shows exactly one action exactly once per session
 * - Tracks add-to-cart + checkout events in real-time for accurate friction detection
 */
(function () {
  "use strict";

  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var EMBED_KEY   = scriptTag.getAttribute("data-key") || "demo";
  var API_BASE    = scriptTag.src.replace("/popup.js", "");
  var SESSION_KEY = "convertai_session_" + EMBED_KEY;
  var SHOWN_KEY   = "convertai_shown_"   + EMBED_KEY;

  // ── Collect real-time session data ──────────────────────────────────────
  function getSessionData() {
    var stored = sessionStorage.getItem(SESSION_KEY);
    var sd = stored ? JSON.parse(stored) : {
      sessionId:   "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      startTime:   Date.now(),
      pagesViewed: [],
      cartStatus:  "empty"
    };

    // Track page view
    var page = location.pathname;
    if (sd.pagesViewed.indexOf(page) === -1) {
      sd.pagesViewed.push(page);
    }

    // Real-time cart detection (DOM signals)
    if (sessionStorage.getItem("convertai_checkout")) {
      sd.cartStatus = "checkout";
    } else if (
      sessionStorage.getItem("convertai_cart_added") ||
      document.querySelector("[data-cart-count]") ||
      document.querySelector(".cart-count") ||
      document.querySelector(".woocommerce-cart-count")
    ) {
      if (sd.cartStatus !== "checkout") sd.cartStatus = "added";
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sd));

    // Traffic source
    var ref = document.referrer;
    var src = "direct";
    if (/google|bing|duckduckgo/.test(ref))                src = "organic";
    else if (/facebook|instagram|tiktok|twitter/.test(ref)) src = "social";
    else if (/email|mailchimp|klaviyo/.test(ref))           src = "email";
    else if (/gclid|fbclid|utm_source/.test(location.search)) src = "paid_ads";
    else if (ref && !ref.includes(location.hostname))       src = "referral";

    // Device
    var ua = navigator.userAgent;
    var device = /Mobi|Android/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";

    return {
      session_id:     sd.sessionId,
      time_on_site:   Math.round((Date.now() - sd.startTime) / 1000),
      pages_viewed:   sd.pagesViewed.length,
      traffic_source: src,
      cart_status:    sd.cartStatus,
      device:         device
    };
  }

  // ── Popup themes ──────────────────────────────────────────────────────────
  var THEMES = {
    urgency:       { bg: "linear-gradient(135deg,#1f0a0a,#3d1515)", tag: "⏰ Limited Time",    tagClr: "#fb7185", btnBg: "linear-gradient(135deg,#be123c,#f43f5e)" },
    popup_info:    { bg: "linear-gradient(135deg,#0a0f1f,#1a2340)", tag: "💡 Quick Note",      tagClr: "#818cf8", btnBg: "linear-gradient(135deg,#4338ca,#6366f1)" },
    discount_5:    { bg: "linear-gradient(135deg,#1a0a2e,#2d1458)", tag: "🎁 5% Off",          tagClr: "#c084fc", btnBg: "linear-gradient(135deg,#7c3aed,#a855f7)" },
    discount_10:   { bg: "linear-gradient(135deg,#1a0a2e,#2d1458)", tag: "💰 10% Off",         tagClr: "#c084fc", btnBg: "linear-gradient(135deg,#7c3aed,#a855f7)" },
    discount_15:   { bg: "linear-gradient(135deg,#1a0a2e,#2d1458)", tag: "🔥 15% Flash Deal",  tagClr: "#c084fc", btnBg: "linear-gradient(135deg,#7c3aed,#a855f7)" },
    free_shipping: { bg: "linear-gradient(135deg,#0a1a2e,#0c2a49)", tag: "🚚 Free Shipping",   tagClr: "#38bdf8", btnBg: "linear-gradient(135deg,#0369a1,#0ea5e9)" },
    bundle:        { bg: "linear-gradient(135deg,#0a1a10,#0e2918)", tag: "🎁 Bundle Deal",     tagClr: "#34d399", btnBg: "linear-gradient(135deg,#059669,#10b981)" },
  };

  // ── Render Popup ─────────────────────────────────────────────────────────
  function renderPopup(data) {
    if (!data.show_popup || !data.headline) return;
    if (sessionStorage.getItem(SHOWN_KEY)) return; // Guard: one popup per session

    if (!document.getElementById("convertai-font")) {
      var lnk = document.createElement("link");
      lnk.id = "convertai-font";
      lnk.rel = "stylesheet";
      lnk.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap";
      document.head.appendChild(lnk);
    }

    var t = THEMES[data.offer_type] || THEMES.urgency;

    var overlay = document.createElement("div");
    overlay.id = "convertai-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:999998;animation:caFadeIn .3s ease;";

    var popup = document.createElement("div");
    popup.id = "convertai-popup";
    popup.style.cssText = [
      "position:fixed;z-index:999999;",
      "bottom:24px;right:24px;",
      "width:340px;max-width:calc(100vw - 32px);",
      "border-radius:20px;padding:24px 28px;",
      "background:" + t.bg + ";",
      "border:1px solid rgba(255,255,255,0.12);",
      "box-shadow:0 20px 60px rgba(0,0,0,0.5);",
      "font-family:'Inter',sans-serif;color:#f1f5f9;",
      "animation:caSlideIn .45s cubic-bezier(0.34,1.56,0.64,1);",
    ].join("");

    popup.innerHTML = [
      "<style>",
      "@keyframes caSlideIn{from{opacity:0;transform:translateY(24px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes caFadeIn{from{opacity:0}to{opacity:1}}",
      "#ca-cta:hover{transform:scale(1.04);opacity:.93}",
      "</style>",
      "<button id='ca-close' style='position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(255,255,255,.5);font-size:18px;cursor:pointer;line-height:1;'>✕</button>",
      "<div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:" + t.tagClr + ";margin-bottom:8px;'>" + t.tag + "</div>",
      "<div style='font-size:19px;font-weight:800;line-height:1.2;margin-bottom:8px;'>" + data.headline + "</div>",
      "<div style='font-size:13px;color:rgba(241,245,249,.8);line-height:1.6;margin-bottom:16px;'>" + (data.sub_message || "") + "</div>",
      "<button id='ca-cta' style='padding:11px 20px;border-radius:8px;border:none;background:" + t.btnBg + ";color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:transform .15s,opacity .15s;'>",
        (data.cta_text || "Claim Offer"),
      "</button>",
      data.urgency_line ? "<div style='font-size:11px;color:rgba(241,245,249,.6);margin-top:10px;'>" + data.urgency_line + "</div>" : "",
    ].join("");

    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    sessionStorage.setItem(SHOWN_KEY, "shown");

    function close() {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    document.getElementById("ca-close").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("ca-cta").addEventListener("click", function () {
      fetch(API_BASE + "/api/convert/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: data.session_id })
      });
      sessionStorage.setItem(SHOWN_KEY, "converted");
      close();
    });
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  function analyze() {
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    var sessionData = getSessionData();

    fetch(API_BASE + "/api/convert/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.show_popup) return;
      // API tells us the ideal delay, default to 5s if missing
      var delay = typeof data.delay_ms === "number" ? data.delay_ms : 5000;
      setTimeout(function () { renderPopup(data); }, delay);
    })
    .catch(function (e) { console.warn("[ConvertAI]", e); });
  }

  // ── Event listeners for real-time cart signals ────────────────────────────
  function init() {
    document.addEventListener("click", function (e) {
      var el = e.target;
      if (!el) return;
      if (el.matches("[data-action='add-to-cart'], .add-to-cart") ||
          (el.innerText && /add to cart|add to bag/i.test(el.innerText))) {
        sessionStorage.setItem("convertai_cart_added", "1");
      }
      if (el.matches("[data-action='checkout'], .checkout-button") ||
          (el.innerText && /checkout|buy now|purchase/i.test(el.innerText))) {
        sessionStorage.setItem("convertai_checkout", "1");
      }
    }, true);

    // Analyze after 5s (get AI decision quickly; popup timing driven by delay_ms)
    setTimeout(analyze, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
