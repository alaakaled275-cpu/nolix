/**
 * NOLIX × ZENO - Client-Side Integration Layer
 * Production-Grade Store Script
 * Async, Non-blocking, Fail-safe
 */

(function () {
  try {
    // 1. FAIL-SAFE INITIALIZATION & STATE
    if (window.nolixInitialized) return;
    window.nolixInitialized = true;

    const STATE = {
      sessionId: `sid_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      storeDomain: window.location.hostname.replace(/^www\./, ''),
      timeOnPage: 0,
      pagesViewed: 1,
      scrollDepth: 0,
      cartStatus: "empty",
      hesitations: 0,
      exitIntentTriggered: false,
      lastInteraction: Date.now(),
      popupActive: false,
      offerClaimed: false, // FREQUENCY CONTROL: Block spam
      attributionWindowOpen: false, 
      aiInfluenceTimestamp: null,
      generatedCoupon: null
    };

    // Load persisted state if exists (Session continuity)
    const savedState = sessionStorage.getItem("nolix_state");
    if (savedState) {
      const parsed = JSON.parse(savedState);
      STATE.sessionId = parsed.sessionId || STATE.sessionId;
      STATE.pagesViewed = (parsed.pagesViewed || 0) + 1;
      STATE.cartStatus = parsed.cartStatus || "empty";
      STATE.offerClaimed = parsed.offerClaimed || false;
      STATE.attributionWindowOpen = parsed.attributionWindowOpen || false;
      STATE.aiInfluenceTimestamp = parsed.aiInfluenceTimestamp || null;
      STATE.generatedCoupon = parsed.generatedCoupon || null;
    }

    const persistState = () => sessionStorage.setItem("nolix_state", JSON.stringify(STATE));
    persistState();

    // 2. DATA COLLECTION LAYER (Observers)
    // - Track Time
    setInterval(() => {
      STATE.timeOnPage += 1;
      if (Date.now() - STATE.lastInteraction > 15000) STATE.hesitations += 1;
      persistState();
    }, 1000);

    // - Track Interaction
    document.addEventListener("click", () => { STATE.lastInteraction = Date.now(); });
    document.addEventListener("keypress", () => { STATE.lastInteraction = Date.now(); });

    // - Track Scroll
    window.addEventListener("scroll", () => {
      const depth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (depth > STATE.scrollDepth) STATE.scrollDepth = depth;
    });

    // - Track Exit Intent (Mouse leaving top viewport)
    document.addEventListener("mouseout", (e) => {
      if (e.clientY < 5 && !STATE.exitIntentTriggered && !STATE.popupActive) {
        STATE.exitIntentTriggered = true;
        triggerBrain("exit_intent");
      }
    });

    // - Identify Cart Additions (Basic heuristic, platforms like Shopify provide better webhooks)
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.innerText && /add to cart|checkout|buy/i.test(target.innerText)) {
        STATE.cartStatus = /checkout|buy/i.test(target.innerText) ? "checkout" : "added";
        persistState();
      }
    });

    // 3. REAL-TIME DECISION TRIGGER (The Brain Link)
    const triggerBrain = async (triggerReason) => {
      // FREQUENCY CONTROL: Never spam if the user already received an AI offer this session.
      if (STATE.popupActive || STATE.offerClaimed) return; 

      try {
        const payload = {
          session_id: STATE.sessionId,
          trigger: triggerReason,
          time_on_site: STATE.timeOnPage,
          pages_viewed: STATE.pagesViewed,
          scroll_depth: STATE.scrollDepth,
          cart_status: STATE.cartStatus,
          hesitations: STATE.hesitations,
          current_url: window.location.href,
          device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
        };

        const apiHost = "https://your-production-url.com"; // Replace during real deployment or dynamically define
        const response = await fetch(\`\${apiHost || ''}/api/engine/decide\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Brain unreachable");
        
        const decision = await response.json();
        
        // Execute Action if not blocked
        if (decision.action && decision.action !== "do_nothing") {
           renderAction(decision);
        }
      } catch (err) {
        // Silent fail-safe for the user experience
        console.warn("Zeno Engine skip:", err.message);
      }
    };

    // 4. ACTION LAYER (UI Execution)
    const renderAction = (decision) => {
      STATE.popupActive = true;
      STATE.attributionWindowOpen = true;
      STATE.aiInfluenceTimestamp = Date.now();
      persistState();

      // Native unobtrusive DOM injection
      const wrapper = document.createElement("div");
      wrapper.id = "nolix-action-overlay";
      Object.assign(wrapper.style, {
        position: "fixed", bottom: "20px", right: "20px", background: "#050505",
        border: "1px solid #00ff66", borderRadius: "12px", color: "white",
        boxShadow: "0 10px 40px rgba(0, 255, 102, 0.2)", padding: "24px",
        zIndex: "2147483647", fontFamily: "system-ui, sans-serif", width: "320px",
        opacity: "0", transform: "translateY(20px)", transition: "all 0.4s ease"
      });

      const msg = decision.message || "Wait! Complete your order now.";
      let offerHtml = \`<div style="font-weight:900; font-size:18px; color:#00ff66; margin-bottom:8px">Exclusive Offer</div>
                       <div style="font-size:14px; color:#ccc; margin-bottom:16px; line-height:1.4;">\${msg}</div>\`;

      // Apply Attribution via Coupon Code injection
      if (decision.action.includes("discount")) {
        const code = \`ZENO-\${Math.random().toString(36).substr(2, 5).toUpperCase()}\`;
        offerHtml += \`<div style="margin-bottom:12px; font-size:11px; color:#888;">Use code at checkout:</div>
                      <div style="background:#111; border:1px dashed #444; padding:8px; text-align:center; letter-spacing:2px; font-weight:bold; color:white; margin-bottom:16px;">\${code}</div>\`;
        
        // Try injecting coupon query string to URL immediately
        if (window.history.pushState) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('discount', code);
            newUrl.searchParams.set('source', 'zeno_ai');
            window.history.pushState({path:newUrl.href}, '', newUrl.href);
        }
      }

      offerHtml += \`<button id="nolix-claim-btn" style="width:100%; padding:12px; background:#00ff66; color:black; font-weight:900; border:none; border-radius:6px; cursor:pointer;" onclick="document.getElementById('nolix-action-overlay').remove();">CLAIM OFFER</button>\`;
      
      wrapper.innerHTML = offerHtml;
      document.body.appendChild(wrapper);

      // Animate In
      requestAnimationFrame(() => {
        wrapper.style.opacity = "1";
        wrapper.style.transform = "translateY(0)";
      });
    };

    // 5. SECURE CHECKOUT DETECTION (Log Only - Billing is handled via Webhook safely)
    const checkForPurchase = () => {
        if (window.location.href.includes("thank_you") || window.location.href.includes("checkout/success")) {
            if (STATE.attributionWindowOpen) {
                // Client side strictly reports to internal analytics. 
                // IT NO LONGER SYNCS MONEY. Shopify Webhooks will handle Stripe Sync securely.
                console.log("[Zeno AI] Order detected. Validating revenue through secure Shopify Webhook.");
                sessionStorage.removeItem("nolix_state");
            }
        }
    };
    checkForPurchase();

    // Trigger idle check occasionally
    setTimeout(() => {
        if (!STATE.popupActive && STATE.hesitations > 2) {
            triggerBrain("browse_idle");
        }
    }, 45000);

  } catch (err) {
    console.error("[Zeno AI] Initialization safely bypassed due to local error.");
  }
})();
