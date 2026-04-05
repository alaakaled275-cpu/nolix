"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./styles.module.css";

// ── Live activity feed entries ──────────────────────────────────────────
const LIVE_EVENTS = [
  { icon: "🛒", store: "petflow.co", action: "Cart hesitation detected", result: "10% offer shown → Converted", delta: "+$87" },
  { icon: "⚡", store: "luminestore.com", action: "Checkout abandonment caught", result: "Urgency message triggered", delta: "+$134" },
  { icon: "💰", store: "modernhome.io", action: "High-intent visitor paused", result: "Free shipping unlocked → Sold", delta: "+$62" },
  { icon: "🔥", store: "gearcraft.co", action: "Paid-ad visitor stuck in cart", result: "15% flash deal → Purchase", delta: "+$211" },
  { icon: "🚀", store: "bloombeauty.com", action: "Mobile drop-off intercepted", result: "Bundle offer shown → Converted", delta: "+$93" },
  { icon: "⚡", store: "nexgear.io", action: "Email click with full cart", result: "Urgency nudge → Order placed", delta: "+$149" },
];

// ── Post-activation state messages ──────────────────────────────────────
const ACTIVATION_STEPS = [
  { icon: "⚡", text: "NOLIX is now active", delay: 0 },
  { icon: "👁️", text: "Analyzing your visitors in real-time...", delay: 1800 },
  { icon: "🧠", text: "Behavior engine initialized", delay: 3200 },
  { icon: "✅", text: "First revenue insights available within 24 hours", delay: 5000 },
];

export default function ActivatePage() {
  const params = useSearchParams();
  const store = params.get("store") ?? "";
  const rawLoss = params.get("loss") ?? "";

  const [tab, setTab] = useState<"shopify" | "script" | "assisted">("shopify");
  const [copied, setCopied] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activationStep, setActivationStep] = useState(-1);
  const [liveEvents, setLiveEvents] = useState<typeof LIVE_EVENTS>([]);
  const [requestSent, setRequestSent] = useState(false);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveIdx = useRef(0);

  const revLoss = rawLoss ? `$${Number(rawLoss).toLocaleString()}` : "$3,200";
  const scriptTag = `<script src="https://cdn.NOLIX.co/v1/engine.js" data-store="${store || "yourstore.com"}"></script>`;

  // Boot live feed
  useEffect(() => {
    // Show first event immediately
    setLiveEvents([LIVE_EVENTS[0]]);
    liveIdx.current = 1;

    liveRef.current = setInterval(() => {
      const next = LIVE_EVENTS[liveIdx.current % LIVE_EVENTS.length];
      setLiveEvents(prev => [next, ...prev].slice(0, 5));
      liveIdx.current++;
    }, 3400);

    return () => { if (liveRef.current) clearInterval(liveRef.current); };
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(scriptTag).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleActivate() {
    setActivated(true);
    let stepIdx = 0;
    ACTIVATION_STEPS.forEach((step) => {
      setTimeout(() => {
        setActivationStep(stepIdx);
        stepIdx++;
      }, step.delay + 400);
    });
  }

  function handleRequestSetup() {
    setRequestSent(true);
  }

  // ── POST-ACTIVATION SCREEN ────────────────────────────────────────────
  if (activated) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.container}>
            <a href="/" className={styles.logo}>NOLI<span className={styles.logoAccent}>X</span></a>
          </div>
        </header>

        <div className={styles.activationScreen}>
          <div className={styles.activationGlow} aria-hidden />
          <div className={styles.activationContent}>
            <div className={styles.activationPulse} aria-hidden />
            <div className={styles.activationBrand}>NOLI<span className={styles.logoAccent}>X</span></div>

            <div className={styles.activationStepList}>
              {ACTIVATION_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`${styles.activationStep} ${activationStep >= i ? styles.activationStepVisible : ""}`}
                >
                  <span className={styles.activationStepIcon}>{step.icon}</span>
                  <span className={styles.activationStepText}>{step.text}</span>
                </div>
              ))}
            </div>

            {activationStep >= 3 && (
              <div className={styles.activationDone}>
                <div className={styles.activationDoneTitle}>You&apos;re live.</div>
                <p className={styles.activationDoneSub}>
                  NOLIX is now watching your visitors and protecting every checkout.
                  Check your dashboard for live conversions.
                </p>
                <a href="/dashboard" className={styles.activationDoneBtn} id="post-activation-dashboard-btn">
                  Go to My Dashboard →
                </a>
              </div>
            )}
          </div>

          {/* Live feed in activation screen */}
          <div className={styles.activationFeed}>
            <div className={styles.feedHeader}>
              <span className={styles.liveDot} /> Other stores — right now
            </div>
            {liveEvents.slice(0, 3).map((ev, i) => (
              <div key={i} className={`${styles.feedItem} ${i === 0 ? styles.feedItemNew : ""}`}>
                <span className={styles.feedIcon}>{ev.icon}</span>
                <div className={styles.feedBody}>
                  <div className={styles.feedStore}>{ev.store}</div>
                  <div className={styles.feedResult}>{ev.result}</div>
                </div>
                <div className={styles.feedDelta}>{ev.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN ACTIVATION PAGE ──────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/" className={styles.logo}>
            NOLI<span className={styles.logoAccent}>X</span>
          </a>
          {store && (
            <div className={styles.headerStore}>
              <span className={styles.liveDot} />
              Activating for <strong>{store}</strong>
            </div>
          )}
          <a href={store ? `/results?store=${encodeURIComponent(store)}` : "/"} className={styles.btnBack}>
            ← Back to Analysis
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ── SECTION 1 + 2: HEADLINE + REVENUE REINFORCEMENT ── */}
          <div className={styles.hero}>
            <div className={styles.heroGlow} aria-hidden />
            <div className={styles.heroBadge}>
              <span className={styles.badgeDot} />
              Revenue Recovery Engine — Ready
            </div>
            <h1 className={styles.heroTitle}>
              Turn your lost visitors into revenue —{" "}
              <span className={styles.titleGradient}>starting now</span>
            </h1>
            <div className={styles.revenueBanner}>
              <div className={styles.revenueBannerInner}>
                <span className={styles.revenueBannerLabel}>You are currently losing</span>
                <span className={styles.revenueBannerAmount}>{revLoss}/month</span>
                <span className={styles.revenueBannerSub}>from visitors who were ready to buy and didn&apos;t.</span>
              </div>
            </div>
            <p className={styles.heroSub}>
              Every minute you wait, that money walks out the door.
              NOLIX stops it — one click, zero risk.
            </p>
            <a href="#install" className={styles.heroCtaBtn} id="hero-cta-btn">
              Start Recovering This Revenue →
            </a>
            <div className={styles.heroTrust}>
              <span>✓ 7-day free trial</span>
              <span>✓ No credit card</span>
              <span>✓ Remove anytime</span>
            </div>
          </div>

          {/* ── LIVE FEED (Section 10: Live Feel) ── */}
          <div className={styles.liveSection}>
            <div className={styles.liveSectionHeader}>
              <span className={styles.liveDot} />
              <span className={styles.liveSectionTitle}>Happening right now — across NOLIX stores</span>
            </div>
            <div className={styles.liveFeed}>
              {liveEvents.map((ev, i) => (
                <div key={`${ev.store}-${i}`} className={`${styles.feedItem} ${i === 0 ? styles.feedItemNew : ""}`}>
                  <span className={styles.feedIcon}>{ev.icon}</span>
                  <div className={styles.feedBody}>
                    <div className={styles.feedStore}>{ev.store}</div>
                    <div className={styles.feedAction}>{ev.action}</div>
                    <div className={styles.feedResult}>{ev.result}</div>
                  </div>
                  <div className={styles.feedDelta}>{ev.delta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 4: ULTRA-SIMPLE ACTIVATION (2 options) ── */}
          <div className={styles.installSection} id="install">
            <div className={styles.sectionLabel}>🚀 Choose Your Setup</div>
            <h2 className={styles.installTitle}>Pick how you want to get started</h2>
            <p className={styles.installSub}>Both options take under 2 minutes. We handle the rest.</p>

            <div className={styles.tabRow}>
              <button
                className={`${styles.tab} ${styles.tabRecommended} ${tab === "shopify" ? styles.tabActive : ""}`}
                onClick={() => setTab("shopify")}
                id="tab-shopify-btn"
              >
                <span className={styles.tabIcon}>🛍️</span>
                <span className={styles.tabLabel}>1-Click Shopify Install</span>
                <span className={styles.tabBadge}>Recommended</span>
              </button>
              <button
                className={`${styles.tab} ${tab === "script" ? styles.tabActive : ""}`}
                onClick={() => setTab("script")}
                id="tab-script-btn"
              >
                <span className={styles.tabIcon}>📋</span>
                <span className={styles.tabLabel}>Quick Setup (2 min)</span>
              </button>
              <button
                className={`${styles.tab} ${tab === "assisted" ? styles.tabActive : ""}`}
                onClick={() => setTab("assisted")}
                id="tab-assisted-btn"
              >
                <span className={styles.tabIcon}>🤝</span>
                <span className={styles.tabLabel}>We Install For You</span>
              </button>
            </div>

            {/* Option A: Shopify */}
            {tab === "shopify" && (
              <div className={styles.panelBox}>
                <div className={styles.panelGlow} aria-hidden />
                <div className={styles.optionTag}>Option A — Recommended</div>
                <h3 className={styles.optionTitle}>1-Click Shopify Install</h3>
                <div className={styles.optionFeatures}>
                  <div className={styles.optionFeature}><span>✓</span> No setup required</div>
                  <div className={styles.optionFeature}><span>✓</span> No coding needed</div>
                  <div className={styles.optionFeature}><span>✓</span> Works instantly after install</div>
                </div>
                <div className={styles.shopifySteps}>
                  {[
                    { n: "1", text: "Go to Shopify Admin → Online Store → Themes" },
                    { n: "2", text: "Click \"Edit code\" on your active theme" },
                    { n: "3", text: "Open theme.liquid and find </body>" },
                    { n: "4", text: "Paste the script tag below and click Save" },
                  ].map((s) => (
                    <div key={s.n} className={styles.shopifyStep}>
                      <div className={styles.shopifyNum}>{s.n}</div>
                      <div className={styles.shopifyText}>{s.text}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.codeBlock}>
                  <code className={styles.codeText}>{scriptTag}</code>
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
                    onClick={handleCopy}
                    id="copy-shopify-script-btn"
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  className={styles.activateMainBtn}
                  onClick={handleActivate}
                  id="shopify-activate-btn"
                >
                  ✅ Start Recovering This Revenue
                </button>
              </div>
            )}

            {/* Option B: Script */}
            {tab === "script" && (
              <div className={styles.panelBox}>
                <div className={styles.optionTag}>Option B</div>
                <h3 className={styles.optionTitle}>Add One Tracking Snippet</h3>
                <p className={styles.optionDesc}>
                  Paste this line before the <code>&lt;/body&gt;</code> tag of any page on your store.
                  Works on WooCommerce, Wix, Webflow, or any custom HTML store.
                </p>
                <div className={styles.codeBlock}>
                  <code className={styles.codeText}>{scriptTag}</code>
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
                    onClick={handleCopy}
                    id="copy-script-btn"
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  className={styles.activateMainBtn}
                  onClick={handleActivate}
                  id="script-activate-btn"
                >
                  ✅ Start Recovering This Revenue
                </button>
              </div>
            )}

            {/* Option C: Assisted — Section 5 */}
            {tab === "assisted" && (
              <div className={styles.panelBox}>
                <div className={styles.panelGlow} aria-hidden />
                <div className={styles.optionTag}>🤝 We Do Everything For You</div>
                <h3 className={styles.optionTitle}>We&apos;ll install everything for you — free</h3>
                <p className={styles.optionDesc}>
                  Tell us your store. Our team will have NOLIX running within 2 hours.
                  You don&apos;t need to touch a single line of code.
                </p>
                <div className={styles.assistedFeatures}>
                  <div className={styles.assistedFeature}><span>✓</span> We set up and verify the install</div>
                  <div className={styles.assistedFeature}><span>✓</span> We test the live behavior engine</div>
                  <div className={styles.assistedFeature}><span>✓</span> We confirm your first session is tracked</div>
                  <div className={styles.assistedFeature}><span>✓</span> Completely free, no obligations</div>
                </div>
                {!requestSent ? (
                  <button
                    className={styles.activateMainBtn}
                    onClick={handleRequestSetup}
                    id="request-setup-btn"
                  >
                    🤝 Request Free Setup
                  </button>
                ) : (
                  <div className={styles.requestSentBox}>
                    <div className={styles.requestSentIcon}>✅</div>
                    <div className={styles.requestSentTitle}>Request received!</div>
                    <div className={styles.requestSentSub}>
                      Our team will reach out within 1 hour to get you set up.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 6: TRUST & SAFETY ── */}
          <div className={styles.trustSection}>
            <div className={styles.sectionLabel}>🔒 Your Data Is Safe</div>
            <div className={styles.trustGrid}>
              {[
                { icon: "🔒", title: "No access to your store data", desc: "We never read your products, orders, or customer info." },
                { icon: "👁️", title: "Behavior analysis only", desc: "We only analyze behavior — like Google Analytics. Nothing personal is ever stored." },
                { icon: "⚡", title: "Zero performance impact", desc: "The script is async and loads after your page. Your store speed is not affected." },
                { icon: "🗑️", title: "Removable anytime", desc: "Delete one line of code and NOLIX is gone. No traces, no lock-in." },
              ].map((t) => (
                <div key={t.title} className={styles.trustCard}>
                  <div className={styles.trustIcon}>{t.icon}</div>
                  <div className={styles.trustTitle}>{t.title}</div>
                  <div className={styles.trustDesc}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 7: RISK REVERSAL ── */}
          <div className={styles.riskBox}>
            <div className={styles.riskGlow} aria-hidden />
            <div className={styles.riskMark}>💎</div>
            <div className={styles.riskTitle}>Try NOLIX for 7 days — completely free</div>
            <p className={styles.riskText}>
              If NOLIX doesn&apos;t generate additional revenue within 7 days,
              remove the script instantly. One line of code. No questions asked.
              No billing. No obligations.
            </p>
            <div className={styles.riskPills}>
              <span className={styles.riskPill}>✓ No credit card</span>
              <span className={styles.riskPill}>✓ Cancel in 10 seconds</span>
              <span className={styles.riskPill}>✓ GDPR compliant</span>
            </div>
          </div>

          {/* ── SECTION 8: WHAT HAPPENS AFTER ACTIVATION ── */}
          <div className={styles.afterSection}>
            <div className={styles.sectionLabel}>📍 What Happens After You Activate</div>
            <div className={styles.afterSteps}>
              {[
                { n: "1", icon: "📊", title: "We track visitor behavior", desc: "The engine silently watches page views, time spent, and cart events. Like Google Analytics, but smarter." },
                { n: "2", icon: "🧠", title: "We detect hesitation", desc: "The moment a buyer pauses at checkout, the system scores their intent in milliseconds." },
                { n: "3", icon: "⚡", title: "We apply the right action", desc: "Urgency message, small discount, free shipping — picked for this exact visitor, in real-time." },
                { n: "4", icon: "💰", title: "You see more conversions", desc: "More carts complete. More revenue recovered. Your dashboard shows every action and result." },
              ].map((s) => (
                <div key={s.n} className={styles.afterStep}>
                  <div className={styles.afterStepNum}>{s.n}</div>
                  <div className={styles.afterStepIcon}>{s.icon}</div>
                  <div>
                    <div className={styles.afterStepTitle}>{s.title}</div>
                    <div className={styles.afterStepDesc}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* ── STICKY BAR ── */}
      <div className={styles.stickyBar}>
        <div className={styles.stickyLeft}>
          <span className={styles.stickyPulse} />
          <span>
            {store
              ? <>NOLIX is ready to activate for <strong>{store}</strong> — every minute costs you money.</>
              : <>NOLIX is ready to activate — start recovering revenue now.</>
            }
          </span>
        </div>
        <a href="#install" className={styles.stickyBtn} id="sticky-activate-btn">
          Start Recovering This Revenue →
        </a>
      </div>
    </div>
  );
}
