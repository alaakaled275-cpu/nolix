/**
 * NOLIX Intelligence Widget — v3.0 Production
 * ============================================
 * Embed on any store: <script src="https://your-domain.com/nolix.js" data-domain="yourstore.com" async></script>
 *
 * Flow:
 *   1. page_view  → POST /api/track  → decision returned
 *   2. exit_intent → POST /api/track  → decision returned
 *   3. Decision "small_incentive"|"trust_urgency"|"bundle_offer" → show popup
 *   4. popup_shown → POST /api/track  (attribution log)
 *   5. cta_click   → POST /api/track  (click log)
 *   6. /thank_you  → POST /api/track  {event:"conversion"} (attribution close)
 */

(function (window, document) {
  'use strict';

  // ── Guard: only init once ─────────────────────────────────────────────────
  if (window.__nolix_loaded) return;
  window.__nolix_loaded = true;

  // ── Read config from script tag ───────────────────────────────────────────
  var scripts = document.getElementsByTagName('script');
  var thisScript = scripts[scripts.length - 1];
  var scriptSrc = thisScript.src || '';

  // API URL: where this script is hosted (auto-detected from script src)
  var API_URL = (function () {
    try {
      var u = new URL(scriptSrc);
      return u.origin; // e.g. https://your-app.vercel.app
    } catch (e) {
      return '';  // same-origin fallback
    }
  })();

  var STORE_DOMAIN = thisScript.getAttribute('data-domain')
    || thisScript.getAttribute('data-store')
    || window.location.hostname.replace(/^www\./, '');

  var API_KEY = thisScript.getAttribute('data-api-key') || '';

  // ── Session State ─────────────────────────────────────────────────────────
  var SESSION_KEY = 'nlx_s';
  var STATE = (function () {
    try {
      var saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return {
        sessionId:   saved && saved.sid ? saved.sid : ('sid_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()),
        visitorId:   saved && saved.vid ? saved.vid : ('vid_' + Math.random().toString(36).substr(2, 12)),
        pagesViewed: saved ? ((saved.pv || 0) + 1) : 1,
        cartStatus:  saved && saved.cs ? saved.cs : 'empty',
        cartValue:   saved && saved.cv ? saved.cv : 0,
        offerClaimed:saved ? !!saved.oc : false,
        popupActive: false,
        attributionOpen: saved ? !!saved.ao : false,
        aiInfluencedAt:  saved && saved.ai ? saved.ai : null,
        couponCode:  saved && saved.cc ? saved.cc : null,
        timeOnPage:  0,
        scrollDepth: 0,
        clicks:      0,
        hesitations: 0,
        lastActive:  Date.now(),
        exitFired:   false,
      };
    } catch (e) {
      return {
        sessionId: 'sid_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
        visitorId: 'vid_' + Math.random().toString(36).substr(2, 12),
        pagesViewed: 1, cartStatus: 'empty', cartValue: 0,
        offerClaimed: false, popupActive: false, attributionOpen: false,
        aiInfluencedAt: null, couponCode: null, timeOnPage: 0,
        scrollDepth: 0, clicks: 0, hesitations: 0, lastActive: Date.now(), exitFired: false,
      };
    }
  })();

  function persist() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sid: STATE.sessionId, vid: STATE.visitorId, pv: STATE.pagesViewed,
        cs: STATE.cartStatus, cv: STATE.cartValue, oc: STATE.offerClaimed,
        ao: STATE.attributionOpen, ai: STATE.aiInfluencedAt, cc: STATE.couponCode,
      }));
    } catch (e) {}
  }
  persist();

  // ── Utility ───────────────────────────────────────────────────────────────
  function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  function hesitationScore() {
    // 0.0 → 1.0 based on hesitations + idle time
    var idleSec = (Date.now() - STATE.lastActive) / 1000;
    var raw = Math.min(1, (STATE.hesitations * 0.15) + (idleSec > 30 ? 0.3 : 0) + (STATE.scrollDepth < 20 ? 0.1 : 0));
    return Math.round(raw * 100) / 100;
  }

  function engagementScore() {
    var raw = Math.min(1,
      (Math.min(STATE.timeOnPage, 180) / 180) * 0.4 +
      (STATE.scrollDepth / 100) * 0.3 +
      (Math.min(STATE.clicks, 10) / 10) * 0.2 +
      (Math.min(STATE.pagesViewed, 5) / 5) * 0.1
    );
    return Math.round(raw * 100) / 100;
  }

  // ── Core: Send Event to /api/track ────────────────────────────────────────
  function sendEvent(eventName, extraData, callback) {
    var payload = {
      event:      eventName,
      session_id: STATE.sessionId,
      visitor_id: STATE.visitorId,
      store:      STORE_DOMAIN,
      timestamp:  Date.now(),
      data: Object.assign({
        time_on_page:      STATE.timeOnPage,
        scroll_depth:      STATE.scrollDepth,
        clicks:            STATE.clicks,
        hesitation_score:  hesitationScore(),
        engagement_score:  engagementScore(),
        exit_intent:       eventName === 'exit_intent',
        cart_status:       STATE.cartStatus,
        cart_value:        STATE.cartValue,
        pages_viewed:      STATE.pagesViewed,
        session_duration:  STATE.timeOnPage * 1000,
        device:            isMobile() ? 'mobile' : 'desktop',
        current_url:       window.location.href,
        source:            document.referrer ? 'referral' : 'direct',
      }, extraData || {}),
    };

    var headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['x-api-key'] = API_KEY;
    headers['x-store-domain'] = STORE_DOMAIN;

    var endpoint = API_URL + '/api/track';

    try {
      fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
      })
        .then(function (r) { return r.json(); })
        .then(function (response) {
          if (callback) callback(null, response);
          else handleDecision(response);
        })
        .catch(function (err) {
          console.warn('[Nolix] Event send failed (silent):', err.message);
          if (callback) callback(err, null);
        });
    } catch (e) {
      console.warn('[Nolix] fetch not available:', e.message);
    }
  }

  // ── Sprint 3: Handle Decision → Show Popup ────────────────────────────────
  function handleDecision(response) {
    if (!response || !response.decision) return;
    var d = response.decision;
    var action = d.final_action || d.action || 'Do Nothing';

    if (action === 'Do Nothing' || action === 'none' || STATE.offerClaimed || STATE.popupActive) return;

    var actionable = ['small_incentive', 'trust_urgency', 'bundle_offer', 'discount_10', 'discount_15', 'discount_5'];
    if (actionable.indexOf(action) === -1) return;

    // Wait 800ms for a natural feel before showing
    setTimeout(function () {
      if (STATE.popupActive || STATE.offerClaimed) return;
      showPopup(action, d);
    }, 800);
  }

  // ── Sprint 3: Popup Renderer ──────────────────────────────────────────────
  function showPopup(actionType, decision) {
    if (document.getElementById('nlx-popup')) return;
    STATE.popupActive = true;

    var coupon = null;
    var title, body, cta, accentColor, bgColor;

    switch (actionType) {
      case 'discount_15':
        coupon = 'ZENO' + Math.random().toString(36).substr(2, 4).toUpperCase();
        title = '⚡ 15% Off — Just for You';
        body  = 'Your cart is waiting. Use this code at checkout:';
        cta   = 'Claim 15% Off Now';
        accentColor = '#00e676'; bgColor = '#0a2e1a';
        break;
      case 'discount_10':
        coupon = 'ZENO' + Math.random().toString(36).substr(2, 4).toUpperCase();
        title = '🎁 10% Off — Limited Offer';
        body  = 'Complete your order now and save 10%:';
        cta   = 'Claim 10% Off';
        accentColor = '#00bcd4'; bgColor = '#0a1e2e';
        break;
      case 'discount_5':
        coupon = 'ZENO' + Math.random().toString(36).substr(2, 4).toUpperCase();
        title = '💰 5% Off Your Order';
        body  = 'Use this code at checkout:';
        cta   = 'Apply Discount';
        accentColor = '#ffd740'; bgColor = '#1e1a00';
        break;
      case 'small_incentive':
        coupon = 'ZENO' + Math.random().toString(36).substr(2, 4).toUpperCase();
        title = '🎁 Special Offer — Act Now';
        body  = 'Get an exclusive discount on your order:';
        cta   = 'Get My Offer';
        accentColor = '#ff6b35'; bgColor = '#1e0a00';
        break;
      case 'trust_urgency':
        title = '⏰ Only a Few Left in Stock';
        body  = 'High demand detected for items in your cart. Secure yours now before they sell out.';
        cta   = 'Complete Order Now';
        accentColor = '#ff4081'; bgColor = '#1e001a';
        break;
      case 'bundle_offer':
        title = '📦 Add More, Save More';
        body  = 'Customers who viewed this also bought — complete your bundle for free shipping.';
        cta   = 'See Bundle Deal';
        accentColor = '#7c4dff'; bgColor = '#0a001e';
        break;
      default:
        title = '✨ Don\'t Leave Just Yet';
        body  = 'Complete your order for a special offer.';
        cta   = 'Continue Shopping';
        accentColor = '#00e676'; bgColor = '#0a2e1a';
    }

    // Save coupon for attribution
    if (coupon) {
      STATE.couponCode = coupon;
      persist();
    }

    // Build popup HTML
    var popup = document.createElement('div');
    popup.id = 'nlx-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Special Offer');
    popup.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px',
      'width:320px', 'max-width:calc(100vw - 32px)',
      'background:' + bgColor,
      'border:1px solid ' + accentColor,
      'border-radius:16px',
      'padding:24px',
      'z-index:2147483647',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
      'opacity:0',
      'transform:translateY(24px)',
      'transition:opacity 0.35s ease,transform 0.35s ease',
      'color:#f0f0f0',
    ].join(';');

    var couponHtml = coupon ? (
      '<div style="background:rgba(255,255,255,0.05);border:1px dashed ' + accentColor + ';border-radius:8px;padding:10px 14px;text-align:center;margin:12px 0 16px;letter-spacing:3px;font-weight:700;font-size:16px;color:' + accentColor + ';">' + coupon + '</div>' +
      '<button id="nlx-copy" style="display:block;width:100%;padding:6px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:rgba(255,255,255,0.5);font-size:11px;cursor:pointer;margin-bottom:12px;">📋 Copy Code</button>'
    ) : '';

    popup.innerHTML =
      '<button id="nlx-close" aria-label="Close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:20px;cursor:pointer;line-height:1;">×</button>' +
      '<div style="font-size:17px;font-weight:700;margin-bottom:8px;color:#fff;">' + title + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.5;margin-bottom:10px;">' + body + '</div>' +
      couponHtml +
      '<button id="nlx-cta" style="display:block;width:100%;padding:13px;background:' + accentColor + ';color:#000;font-weight:700;font-size:14px;border:none;border-radius:10px;cursor:pointer;transition:opacity 0.2s;">' + cta + '</button>' +
      '<div style="text-align:center;margin-top:10px;font-size:10px;color:rgba(255,255,255,0.2);">Powered by Nolix Intelligence</div>';

    document.body.appendChild(popup);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(0)';
      });
    });

    // Sprint 4: Log popup_shown for attribution
    sendEvent('popup_shown', {
      action: actionType,
      friction: decision.friction_type || 'unknown',
      intent_level: decision.intent_score > 70 ? 'high' : decision.intent_score > 40 ? 'medium' : 'low',
      coupon_code: coupon,
      decision_id: decision.decision_id,
    }, null);

    // Close button
    var closeBtn = document.getElementById('nlx-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        dismissPopup(popup);
      });
    }

    // Copy coupon button
    var copyBtn = document.getElementById('nlx-copy');
    if (copyBtn && coupon) {
      copyBtn.addEventListener('click', function () {
        try {
          navigator.clipboard.writeText(coupon).then(function () {
            copyBtn.textContent = '✅ Copied!';
          });
        } catch (e) {
          copyBtn.textContent = coupon;
        }
      });
    }

    // CTA button — Sprint 4 click tracking + redirect
    var ctaBtn = document.getElementById('nlx-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', function () {
        STATE.offerClaimed = true;
        STATE.attributionOpen = true;
        STATE.aiInfluencedAt = Date.now();
        persist();

        // Sprint 4: Track CTA click
        sendEvent('cta_click', {
          action: actionType,
          coupon_code: coupon,
          decision_id: decision.decision_id,
          session_id: STATE.sessionId,
        }, null);

        // Inject discount into URL if coupon exists
        if (coupon && window.history && window.history.pushState) {
          try {
            var url = new URL(window.location.href);
            url.searchParams.set('discount', coupon);
            url.searchParams.set('ref', 'nolix');
            window.history.pushState({}, '', url.toString());
          } catch (e) {}
        }

        dismissPopup(popup);
      });
    }

    // Auto dismiss after 25s
    setTimeout(function () { dismissPopup(popup); }, 25000);
  }

  function dismissPopup(popup) {
    if (!popup || !popup.parentNode) return;
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(24px)';
    setTimeout(function () {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 350);
    STATE.popupActive = false;
  }

  // ── Sprint 2: Data Collection ─────────────────────────────────────────────
  // Time on page (every second)
  setInterval(function () {
    STATE.timeOnPage += 1;
    // Hesitation: if inactive for 15+ seconds
    if (Date.now() - STATE.lastActive > 15000) {
      STATE.hesitations = Math.min(STATE.hesitations + 1, 10);
    }
    // Periodic brain check at 60s with high hesitation
    if (STATE.timeOnPage === 60 && STATE.hesitations >= 2 && !STATE.offerClaimed && !STATE.popupActive) {
      sendEvent('idle_hesitation', { intent_score: Math.max(0, 50 - STATE.hesitations * 5) });
    }
  }, 1000);

  // Interaction tracking
  document.addEventListener('click', function (e) {
    STATE.lastActive = Date.now();
    STATE.clicks++;
    persist();
  }, { passive: true });

  document.addEventListener('touchstart', function () {
    STATE.lastActive = Date.now();
  }, { passive: true });

  document.addEventListener('keydown', function () {
    STATE.lastActive = Date.now();
  }, { passive: true });

  // Scroll tracking
  var scrollTimeout;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function () {
      var totalHeight = document.body.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        var depth = Math.round((window.scrollY / totalHeight) * 100);
        if (depth > STATE.scrollDepth) {
          STATE.scrollDepth = Math.min(depth, 100);
          persist();
        }
      }
    }, 100);
  }, { passive: true });

  // Cart detection (works on Shopify and WooCommerce)
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target) return;
    var text = (target.innerText || target.value || target.getAttribute('data-add-to-cart') || '').toLowerCase();
    var id = (target.id || '').toLowerCase();
    var cls = (target.className || '').toLowerCase();

    if (/add.to.cart|add_to_cart|addtocart/i.test(text + id + cls)) {
      STATE.cartStatus = 'added';
      persist();
      sendEvent('add_to_cart', { cart_status: 'added' });
    } else if (/checkout|complete.order|place.order/i.test(text + id + cls)) {
      STATE.cartStatus = 'checkout';
      persist();
    }
  }, { passive: true });

  // Shopify-specific cart monitoring via AJAX API
  (function pollShopifyCart() {
    if (!window.Shopify) return;
    setInterval(function () {
      fetch('/cart.js')
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          if (cart && cart.item_count > 0) {
            var newVal = parseFloat(cart.total_price) / 100;
            if (STATE.cartValue !== newVal || STATE.cartStatus === 'empty') {
              STATE.cartStatus = 'added';
              STATE.cartValue = newVal;
              persist();
            }
          }
        })
        .catch(function () {});
    }, 8000);
  })();

  // Sprint 3: Exit Intent (desktop — mouse leaves top of viewport)
  document.addEventListener('mouseleave', function (e) {
    if (e.clientY < 5 && !STATE.exitFired && !STATE.offerClaimed && !STATE.popupActive) {
      STATE.exitFired = true;
      persist();
      sendEvent('exit_intent', { exit_intent: true, hesitation_score: hesitationScore() });
    }
  });

  // Mobile exit: page visibility change (tab switch = potential exit)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && !STATE.exitFired && !STATE.offerClaimed && !STATE.popupActive && STATE.timeOnPage > 15) {
      STATE.exitFired = true;
      persist();
      sendEvent('exit_intent', { exit_intent: true, hesitation_score: hesitationScore(), device: 'mobile' });
    }
  });

  // Sprint 4: Conversion Detection (thank-you / order confirmation page)
  (function detectConversion() {
    var url = window.location.href;
    var isThankYou = /thank.you|order.confirmed|order.success|checkout\/thank|checkout.success|\/orders\//i.test(url);

    if (isThankYou && STATE.attributionOpen) {
      // Extract order value from page
      var orderValue = 0;
      var orderId = '';

      try {
        // Shopify order page selectors
        var priceEl = document.querySelector('.payment-due__price, .os-price, .order-summary__emphasis, [data-order-total]');
        if (priceEl) orderValue = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) || 0;

        // Try Shopify Liquid checkout object
        if (window.Shopify && window.Shopify.checkout) {
          orderValue = parseFloat(window.Shopify.checkout.total_price) / 100 || orderValue;
          orderId = window.Shopify.checkout.order_id || '';
        }

        // Try URL path for order ID
        var pathMatch = window.location.pathname.match(/\/orders\/([^/]+)/);
        if (pathMatch) orderId = pathMatch[1];
      } catch (e) {}

      // Sprint 5: Fire conversion event → Attribution engine in /api/track handles it
      sendEvent('conversion', {
        order_value: orderValue,
        order_id:    orderId || ('ORD-' + Date.now()),
        coupon_code: STATE.couponCode,
        session_id:  STATE.sessionId,
        ai_influenced: !!STATE.aiInfluencedAt,
        time_to_convert: STATE.aiInfluencedAt ? Math.round((Date.now() - STATE.aiInfluencedAt) / 1000) : null,
      }, function (err, res) {
        if (!err && res && res.success) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      });
    }
  })();

  // Sprint 2: Initial page_view event (fires after page settles)
  setTimeout(function () {
    sendEvent('page_view', {
      page_type: document.body.getAttribute('data-page-type') || 'unknown',
      intent_score: STATE.pagesViewed > 1 ? 40 : 20,
    });
  }, 2000);

  // ── Expose minimal public API ─────────────────────────────────────────────
  window.Nolix = {
    version: '3.0.0',
    session: function () { return STATE.sessionId; },
    track:   function (eventName, data) { sendEvent(eventName, data || {}); },
    // Called by Shopify order status page Liquid template for attribution
    orderCompleted: function (orderId, orderValue) {
      STATE.attributionOpen = true;
      sendEvent('conversion', { order_id: orderId, order_value: orderValue, session_id: STATE.sessionId });
    },
  };

  console.log('[Nolix v3.0] Loaded for ' + STORE_DOMAIN + ' | Session: ' + STATE.sessionId.substr(0, 16) + '...');

})(window, document);
