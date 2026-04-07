"use client";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <link rel="stylesheet" href="/iso-style.css" />
      <link rel="stylesheet" href="/iso-animations.css" />
      <div dangerouslySetInnerHTML={{ __html: `

  <!-- ═══════════════════ NAVBAR ═══════════════════ -->
  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="/waitlist" class="nav-logo">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" /></svg>
        <span class="logo-text" style="display:flex;align-items:center;font-weight:900;letter-spacing:1px;font-size:1.1rem;"><span style="color:#fff">NOLI</span><span style="color:#EF4444">X</span></span>
      </a>
      <ul class="nav-links">
        <li><a href="#features">FEATURES</a></li>
        <li><a href="/waitlist">PRICING</a></li>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="#blog">BLOG</a></li>
      </ul>
      <a href="/waitlist" class="btn-login" id="loginBtn">LOGIN</a>
      <button class="hamburger" id="hamburger">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <!-- ═══════════════════ HERO ═══════════════════ -->
  <section class="hero" id="home">
    <div class="hero-bg-glow"></div>

    <div class="hero-container">
      <!-- LEFT: Text Content -->
      <div class="hero-content">
        <div class="hero-badge reveal-up">
          <span class="badge-dot"></span>
          <span>Powered by Zeno AI Operator</span>
        </div>
        <h1 class="hero-title reveal-up delay-1">
          The Future of<br />Revenue<br />Intelligence
        </h1>
        <div class="hero-divider reveal-up delay-2"></div>
        <p class="hero-subtitle reveal-up delay-2">
          Track, manage, and optimize your e-commerce revenue with Zeno AI in one centralized system..
        </p>
        <div class="hero-cta reveal-up delay-3">
          <a href="/waitlist" class="btn-primary" id="viewPlansBtn">
            VIEW PLANS
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </a>
          <a href="/waitlist" class="btn-ghost" id="watchDemoBtn">
            <span class="play-icon">▶</span> Watch Demo
          </a>
        </div>
        <div class="hero-stats reveal-up delay-4">
          <div class="stat"><span class="stat-num">100+</span><span class="stat-label">Signals</span></div>
          <div class="stat-divider"></div>
          <div class="stat"><span class="stat-num">99.9%</span><span class="stat-label">Uptime</span></div>
          <div class="stat-divider"></div>
          <div class="stat"><span class="stat-num">50K+</span><span class="stat-label">Marketers</span></div>
        </div>
      </div>

      <!-- RIGHT: 3D Isometric Scene -->
      <div class="hero-visual" id="heroVisual">
        <!-- Stars/particles canvas -->
        <canvas class="particles-canvas" id="particlesCanvas"></canvas>

        <!-- Isometric 3D scene -->
        <div class="iso-scene">

          <!-- Glowing curved platform base -->
          <div class="iso-platform"></div>

          <!-- Light streaks / beams -->
          <div class="light-streak streak-1"></div>
          <div class="light-streak streak-2"></div>
          <div class="light-streak streak-3"></div>
          <div class="light-streak streak-4"></div>

          <!-- PANEL A: Big main blue panel with bar chart -->
          <div class="iso-panel panel-main float-slow">
            <div class="panel-glow-border"></div>
            <div class="panel-inner">
              <div class="panel-top-bar">
                <div class="ptb-dot cyan"></div>
                <div class="ptb-dot blue"></div>
                <div class="ptb-line"></div>
              </div>
              <div class="panel-bars">
                <div class="bar-col"><div class="bar-fill" style="height:38%"></div></div>
                <div class="bar-col"><div class="bar-fill" style="height:62%"></div></div>
                <div class="bar-col"><div class="bar-fill" style="height:48%"></div></div>
                <div class="bar-col"><div class="bar-fill" style="height:78%"></div></div>
                <div class="bar-col"><div class="bar-fill" style="height:55%"></div></div>
                <div class="bar-col"><div class="bar-fill bar-active" style="height:94%"></div></div>
                <div class="bar-col"><div class="bar-fill" style="height:68%"></div></div>
              </div>
              <div class="panel-label">Campaign ROI</div>
            </div>
          </div>

          <!-- PANEL B: Wave chart (orange/red) -->
          <div class="iso-panel panel-wave float-medium">
            <div class="panel-glow-border" style="border-color: rgba(255,107,0,0.4);"></div>
            <div class="panel-inner">
              <svg class="wave-svg" viewBox="0 0 200 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="wg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FF6B00" stop-opacity="0.85"/>
                    <stop offset="100%" stop-color="#FF2D00" stop-opacity="0.05"/>
                  </linearGradient>
                  <filter id="fgw">
                    <feGaussianBlur stdDeviation="2.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <path class="anim-wave" d="M0,65 C20,55 35,40 55,35 C75,30 85,45 105,38 C125,31 140,20 160,18 C175,16 188,22 200,20 L200,80 L0,80 Z" fill="url(#wg1)"/>
                <path class="anim-wave-line" d="M0,70 C15,60 30,50 50,42 C70,34 90,50 110,44 C130,38 150,28 175,26 C185,25 193,28 200,27" fill="none" stroke="#FF2D55" stroke-width="2.5" filter="url(#fgw)"/>
                <path d="M0,65 C20,55 35,40 55,35 C75,30 85,45 105,38 C125,31 140,20 160,18 C175,16 188,22 200,20" fill="none" stroke="#FF8C00" stroke-width="2"/>
                <circle cx="160" cy="18" r="4" fill="#FF6B00" filter="url(#fgw)"/>
                <circle cx="160" cy="18" r="9" fill="#FF6B00" opacity="0.25"/>
              </svg>
              <div class="panel-label" style="color:#FF8C00; margin-top:4px;">Conversion Rate</div>
            </div>
          </div>

          <!-- PANEL C: Dot grid -->
          <div class="iso-panel panel-dots float-fast">
            <div class="panel-inner">
              <div class="dots-grid" id="dotsGrid"></div>
              <div class="panel-label">Tracking Pixels</div>
            </div>
          </div>

          <!-- PANEL D: Mini accent numbers panel -->
          <div class="iso-panel panel-accent float-medium" style="animation-delay:-2.1s;">
            <div class="panel-inner">
              <div class="acc-row">
                <div class="acc-item">
                  <span class="acc-val">142K</span>
                  <span class="acc-lbl">Clicks</span>
                </div>
                <div class="acc-sep"></div>
                <div class="acc-item">
                  <span class="acc-val orange">8.4K</span>
                  <span class="acc-lbl">Convs</span>
                </div>
              </div>
              <div class="acc-sparkline">
                <svg viewBox="0 0 80 20"><polyline points="0,18 15,12 28,15 42,6 55,9 68,3 80,5" fill="none" stroke="#EF4444" stroke-width="1.5"/></svg>
              </div>
            </div>
          </div>

          <!-- Circular gauge top-right -->
          <div class="iso-gauge float-slow" style="animation-delay:-1.2s;">
            <svg viewBox="0 0 100 100" class="gauge-svg">
              <defs>
                <filter id="gg">
                  <feGaussianBlur stdDeviation="3" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="43" fill="rgba(0,20,60,0.5)" stroke="rgba(0,210,255,0.12)" stroke-width="1"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(0,210,255,0.1)" stroke-width="10"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="#EF4444" stroke-width="10"
                stroke-dasharray="175 64" stroke-dashoffset="58" stroke-linecap="round"
                filter="url(#gg)" class="gauge-arc"/>
              <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(0,100,255,0.12)" stroke-width="6"/>
              <circle cx="50" cy="50" r="25" fill="none" stroke="#0066FF" stroke-width="6"
                stroke-dasharray="110 47" stroke-dashoffset="35" stroke-linecap="round" class="gauge-inner"/>
              <circle cx="50" cy="50" r="5" fill="#EF4444" filter="url(#gg)"/>
              <text x="50" y="46" text-anchor="middle" fill="white" font-size="11" font-weight="800" font-family="Inter,sans-serif">87%</text>
              <text x="50" y="57" text-anchor="middle" fill="#EF4444" font-size="5.5" font-family="Inter,sans-serif" letter-spacing="1">EFFICIENCY</text>
            </svg>
          </div>

          <!-- Laptop bottom-left -->
          <div class="iso-laptop float-slow" style="animation-delay:-0.7s;">
            <div class="laptop-lid">
              <div class="laptop-screen-content">
                <div class="lsc-bar" style="width:70%"></div>
                <div class="lsc-bar" style="width:50%"></div>
                <div class="lsc-block">
                  <div class="lsc-sq cyan-sq"></div>
                  <div class="lsc-sq orange-sq"></div>
                  <div class="lsc-sq blue-sq"></div>
                </div>
              </div>
            </div>
            <div class="laptop-base">
              <div class="laptop-trackpad"></div>
            </div>
            <div class="laptop-shadow"></div>
          </div>

          <!-- Floating orbs -->
          <div class="iso-orb orb-cyan float-fast" style="animation-delay:-0.3s;"></div>
          <div class="iso-orb orb-blue float-medium" style="animation-delay:-1.8s;"></div>
          <div class="iso-orb orb-small float-slow" style="animation-delay:-3s;"></div>

          <!-- Floating data labels -->
          <div class="data-tag tag-1">
            <span class="dt-icon">↑</span> +12.4%
          </div>
          <div class="data-tag tag-2">
            📊 \$142K
          </div>
          <div class="data-tag tag-3">
            ⚡ 4.2x ROAS
          </div>

        </div>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="scroll-indicator">
      <div class="scroll-mouse"><div class="scroll-dot"></div></div>
      <span>Scroll to explore</span>
    </div>
  </section>

  <!-- ═══════════════════ FEATURES ═══════════════════ -->
  <section class="features" id="features">
    <div class="section-container">
      <div class="section-header">
        <div class="section-tag reveal-up">FEATURES</div>
        <h2 class="section-title reveal-up delay-1">Take Advantage of Our<br />Unique Features</h2>
        <a href="/waitlist" class="btn-outline reveal-up delay-2" id="viewAllFeaturesBtn">VIEW ALL FEATURES <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
      </div>
      <div class="features-grid">
        <div class="feature-card reveal-up delay-1" id="featureCard1">
          <div class="feature-icon cyan-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="4" width="8" height="8" rx="2" fill="currentColor" opacity="0.7"/><rect x="16" y="4" width="8" height="8" rx="2" fill="currentColor"/><rect x="4" y="16" width="8" height="8" rx="2" fill="currentColor"/><rect x="16" y="16" width="8" height="8" rx="2" fill="currentColor" opacity="0.7"/></svg>
          </div>
          <h3 class="feature-title">Automatically Track Data Points</h3>
          <p class="feature-desc">Access up to 30+ data points about every impression, visit, click and conversion to go as granular as you need.</p>
        </div>
        <div class="feature-card reveal-up delay-2" id="featureCard2">
          <div class="feature-icon teal-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20L10 12L14 16L20 8L24 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="14" r="2" fill="currentColor"/></svg>
          </div>
          <h3 class="feature-title">Extensive Drill Down Reports</h3>
          <p class="feature-desc">Get granular with your data and drill down deep into your reports with our proprietary database unmatched by other trackers.</p>
        </div>
        <div class="feature-card reveal-up delay-3" id="featureCard3">
          <div class="feature-icon yellow-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4L17 10H23L18 14.5L20 21L14 17L8 21L10 14.5L5 10H11L14 4Z" fill="currentColor" opacity="0.9"/></svg>
          </div>
          <h3 class="feature-title">Developed For Speed and Scale</h3>
          <p class="feature-desc">Handle millions of Clicks effortlessly, we constantly optimize to ensure the reduction of click loss.</p>
        </div>
        <div class="feature-card reveal-up delay-2" id="featureCard4">
          <div class="feature-icon blue-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="6" y="6" width="16" height="10" rx="2" fill="currentColor" opacity="0.3"/><circle cx="14" cy="18" r="4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="14" cy="18" r="1.5" fill="currentColor"/></svg>
          </div>
          <h3 class="feature-title">Multi User Accounts</h3>
          <p class="feature-desc">Invite partners or associates to your NOLIX account. Customize and control what they have access to.</p>
        </div>
        <div class="feature-card reveal-up delay-3" id="featureCard5">
          <div class="feature-icon green-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4L4 9v6c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V9L14 4z" stroke="currentColor" stroke-width="2" fill="currentColor" opacity="0.2"/><path d="M10 14l2.5 2.5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <h3 class="feature-title">Military Grade Security</h3>
          <p class="feature-desc">We utilize the latest security protocols and encryption technology to protect your valuable data against cyber threats.</p>
        </div>
        <div class="feature-card reveal-up delay-4" id="featureCard6">
          <div class="feature-icon red-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="2" fill="currentColor" opacity="0.15"/><path d="M14 10v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <h3 class="feature-title">Limitless Capabilities</h3>
          <p class="feature-desc">Setup, Track, Rotate & Split-Test Unlimited Campaigns, Offers, Landing Pages, Paths & More.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ ABOUT ═══════════════════ -->
  <section class="about" id="about">
    <div class="about-bg"></div>
    <div class="section-container about-container">
      <div class="about-visual reveal-left">
        <div class="about-screen">
          <div class="about-screen-header">
            <div class="about-dots"><span></span><span></span><span></span></div>
          </div>
          <div class="about-screen-body">
            <div class="ab-row">
              <div class="ab-platform">
                <div class="ab-platform-icon" style="background:#1877F2">f</div>
                <div class="ab-platform-info">
                  <div class="ab-platform-name">Meta Ads</div>
                  <div class="ab-bar"><div class="ab-fill" style="width:78%;background:#1877F2"></div></div>
                </div>
                <div class="ab-platform-val">\$48K</div>
              </div>
              <div class="ab-platform">
                <div class="ab-platform-icon" style="background:#EA4335">G</div>
                <div class="ab-platform-info">
                  <div class="ab-platform-name">Google Ads</div>
                  <div class="ab-bar"><div class="ab-fill" style="width:65%;background:#EA4335"></div></div>
                </div>
                <div class="ab-platform-val">\$39K</div>
              </div>
              <div class="ab-platform">
                <div class="ab-platform-icon" style="background:#010101;border:1px solid #333">T</div>
                <div class="ab-platform-info">
                  <div class="ab-platform-name">TikTok Ads</div>
                  <div class="ab-bar"><div class="ab-fill" style="width:45%;background:#69C9D0"></div></div>
                </div>
                <div class="ab-platform-val">\$27K</div>
              </div>
              <div class="ab-platform">
                <div class="ab-platform-icon" style="background:#0A66C2">in</div>
                <div class="ab-platform-info">
                  <div class="ab-platform-name">LinkedIn Ads</div>
                  <div class="ab-bar"><div class="ab-fill" style="width:30%;background:#0A66C2"></div></div>
                </div>
                <div class="ab-platform-val">\$18K</div>
              </div>
            </div>
            <div class="ab-total">
              <span class="ab-total-label">Total Attributed Revenue</span>
              <span class="ab-total-val">\$142,850</span>
            </div>
          </div>
        </div>
      </div>
      <div class="about-content reveal-right">
        <div class="section-tag">ABOUT</div>
        <h2 class="section-title">What is NOLIX?</h2>
        <p class="about-text">It's a cloud-based tracking software for campaign management, data analysis and conversion optimization. NOLIX connects all your advertising platforms in one unified dashboard.</p>
        <ul class="about-list">
          <li><span class="check cyan">✓</span> Unified cross-platform attribution</li>
          <li><span class="check cyan">✓</span> Real-time data processing & alerts</li>
          <li><span class="check cyan">✓</span> Automated reporting & insights</li>
          <li><span class="check cyan">✓</span> Privacy-first, cookieless tracking</li>
        </ul>
        <a href="/waitlist" class="btn-primary" id="getStartedAboutBtn">GET STARTED <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ PRICING ═══════════════════ -->
  <section class="pricing" id="pricing">
    <div class="section-container">
      <div class="section-header">
        <div class="section-tag reveal-up">PRICING</div>
        <h2 class="section-title reveal-up delay-1">Pricing Plans</h2>
        <div class="billing-toggle reveal-up delay-2">
          <span class="toggle-label active" id="monthlyLabel">MONTHLY</span>
          <button class="toggle-switch" id="billingToggle" role="switch" aria-checked="false">
            <span class="toggle-thumb"></span>
          </button>
          <span class="toggle-label" id="yearlyLabel">YEARLY</span>
          <span class="save-badge">SAVE 25%</span>
        </div>
      </div>
      <div class="pricing-grid">
        <div class="pricing-card reveal-up delay-1" id="pricingCardBasic">
          <div class="plan-header">
            <div class="plan-name">BASIC</div>
            <div class="plan-tag" style="color:#EF4444">STARTS HERE</div>
          </div>
          <div class="plan-price">
            <span class="currency">\$</span>
            <span class="amount" data-monthly="74" data-yearly="55">74</span>
            <span class="period">PER MONTH</span>
          </div>
          <div class="plan-desc">For affiliates who require a simplified solution with the core tracking features to start their campaigns.</div>
          <a href="/waitlist" class="btn-plan" id="basicPlanBtn">GET STARTED <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
          <ul class="plan-features">
            <li>✓ 5,000,000 events</li>
            <li>✓ 3 custom domains</li>
            <li>✓ 5 employee seats (no SSL)</li>
            <li>✓ 6 months data history</li>
            <li>✓ Overage \$0.05 per 1,000 events</li>
          </ul>
          <div class="plan-section-title">Existing User Facility</div>
          <ul class="plan-features">
            <li>✓ Advance Domain Rotation</li>
            <li>✓ Deep Funnel Reporting</li>
            <li>✓ Advanced Reporting Analytics</li>
            <li>✓ Live Chat Support</li>
          </ul>
        </div>
        <div class="pricing-card popular reveal-up delay-2" id="pricingCardAdvanced">
          <div class="popular-badge">★ POPULAR</div>
          <div class="plan-header">
            <div class="plan-name">ADVANCED</div>
            <div class="plan-tag" style="color:#EF4444">BEST VALUE</div>
          </div>
          <div class="plan-price">
            <span class="currency">\$</span>
            <span class="amount" data-monthly="149" data-yearly="112">149</span>
            <span class="period">PER MONTH</span>
          </div>
          <div class="plan-desc">For users and brand teams \$50,000+ experiencing from \$10,000 and scaling their operations.</div>
          <a href="/waitlist" class="btn-plan popular-btn" id="advancedPlanBtn">GET STARTED <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
          <ul class="plan-features">
            <li>✓ 10 mobile events</li>
            <li>✓ 8 custom domains</li>
            <li>✓ 15 employee seats with SSL</li>
            <li>✓ 36 months data history</li>
            <li>✓ Overage \$0.04 per 1,000 events</li>
          </ul>
          <div class="plan-section-title">Includes ALL Basic Features, plus:</div>
          <ul class="plan-features">
            <li>✓ High-risk Requirements</li>
            <li>✓ 10 Additional Users</li>
            <li>✓ Live Chat Support Priority</li>
            <li>✓ Extreme Revenue Tracking Soon</li>
          </ul>
        </div>
        <div class="pricing-card reveal-up delay-3" id="pricingCardPremium">
          <div class="plan-header">
            <div class="plan-name">PREMIUM</div>
            <div class="plan-tag" style="color:#A855F7">ENTERPRISE</div>
          </div>
          <div class="plan-price">
            <span class="currency">\$</span>
            <span class="amount" data-monthly="224" data-yearly="168">224</span>
            <span class="period">PER MONTH</span>
          </div>
          <div class="plan-desc">For experienced users seeking to expand their income and scale campaigns aggressively.</div>
          <a href="/waitlist" class="btn-plan" id="premiumPlanBtn">GET STARTED <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
          <ul class="plan-features">
            <li>✓ 50,000,000 events</li>
            <li>✓ Unlimited domains</li>
            <li>✓ Unlimited employees with SSL</li>
            <li>✓ 36 months data history</li>
            <li>✓ Overage \$0.03 per 1,000 events</li>
          </ul>
          <div class="plan-section-title">Includes ALL Advanced Features, plus:</div>
          <ul class="plan-features">
            <li>✓ 6 Additional Users - 3 Total</li>
            <li>✓ Live Chat Support Priority</li>
            <li>✓ Dedicated Account Manager</li>
            <li>✓ VIP Support</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ FAQ ═══════════════════ -->
  <section class="faq" id="faq">
    <div class="section-container">
      <div class="section-header">
        <div class="section-tag reveal-up">FAQ</div>
        <h2 class="section-title reveal-up delay-1">Frequently Asked<br />Questions</h2>
      </div>
      <div class="faq-grid">
        <div class="faq-item reveal-up delay-1" id="faqItem1">
          <button class="faq-question" aria-expanded="false">
            <span>Will my tracking stop after I reach the monthly plan limit?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            <p>No, your tracking will not stop. Once you reach your plan limit, we automatically switch to our overage model, billing you per additional 1,000 events at the rate specified in your plan.</p>
          </div>
        </div>
        <div class="faq-item reveal-up delay-2" id="faqItem2">
          <button class="faq-question" aria-expanded="false">
            <span>Is my data removed and lost after the retention period?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            <p>After the retention period expires, older data is archived and removed from active storage. We recommend exporting your data regularly if you need historical records beyond your plan's retention window.</p>
          </div>
        </div>
        <div class="faq-item reveal-up delay-1" id="faqItem3">
          <button class="faq-question" aria-expanded="false">
            <span>What are the overages?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            <p>Overages are charged per 1,000 events beyond your plan's monthly limit. Basic: \$0.05, Advanced: \$0.04, Premium: \$0.03 per 1,000 additional events.</p>
          </div>
        </div>
        <div class="faq-item reveal-up delay-2" id="faqItem4">
          <button class="faq-question" aria-expanded="false">
            <span>What makes NOLIX better than other popular trackers?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            <p>NOLIX offers military-grade security, real-time processing, proprietary deep-drill reporting, and support for 30+ platforms — all in a single unified interface. Our performance at scale is unmatched.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ BLOG ═══════════════════ -->
  <section class="blog" id="blog">
    <div class="section-container">
      <div class="blog-header">
        <div>
          <div class="section-tag reveal-up">BLOG</div>
          <h2 class="section-title reveal-up delay-1">Blog</h2>
        </div>
        <a href="/waitlist" class="btn-outline reveal-up delay-1" id="viewAllArticlesBtn">VIEW ALL ARTICLES <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
      </div>
      <div class="blog-grid">
        <div class="blog-card reveal-up delay-1" id="blogCard1">
          <div class="blog-img" style="background:linear-gradient(135deg,#1e3a5f,#0d1f36)">
            <div class="blog-img-content"><div class="blog-img-icon">📱</div></div>
            <div class="blog-category-tag">TIPS & TRICKS</div>
          </div>
          <div class="blog-content">
            <h3 class="blog-title">How to Make Landing Pages Optimized for...</h3>
            <p class="blog-excerpt">A lander is a crucial part of any performance marketing campaign.</p>
            <a href="/waitlist" class="blog-read-more" id="readMoreBtn1">Read More →</a>
          </div>
        </div>
        <div class="blog-card reveal-up delay-2" id="blogCard2">
          <div class="blog-img" style="background:linear-gradient(135deg,#1f3a1e,#0d200d)">
            <div class="blog-img-content"><div class="blog-img-icon">📋</div></div>
            <div class="blog-category-tag">CASE STUDY</div>
          </div>
          <div class="blog-content">
            <h3 class="blog-title">Case Study: Why Adextrem Moved From a...</h3>
            <p class="blog-excerpt">In this case study, you'll learn about AdExtrem and their business needs.</p>
            <a href="/waitlist" class="blog-read-more" id="readMoreBtn2">Read More →</a>
          </div>
        </div>
        <div class="blog-card reveal-up delay-3" id="blogCard3">
          <div class="blog-img" style="background:linear-gradient(135deg,#3a1f1e,#200d0d)">
            <div class="blog-img-content"><div class="blog-img-icon">📈</div></div>
            <div class="blog-category-tag">TIPS & TRICKS</div>
          </div>
          <div class="blog-content">
            <h3 class="blog-title">How to Improve Banner Ads Optimized for...</h3>
            <p class="blog-excerpt">Back in the early days of the Internet, advertising was a lot simpler affair.</p>
            <a href="/waitlist" class="blog-read-more" id="readMoreBtn3">Read More →</a>
          </div>
        </div>
        <div class="blog-card reveal-up delay-4" id="blogCard4">
          <div class="blog-img" style="background:linear-gradient(135deg,#1e1a3a,#0d0d20)">
            <div class="blog-img-content"><div class="blog-img-icon">🎬</div></div>
            <div class="blog-category-tag">WEBINAR</div>
          </div>
          <div class="blog-content">
            <h3 class="blog-title">Online Video Ads in 2025: Notable Trends to Watch</h3>
            <p class="blog-excerpt">There is no faster growing advertising format in the world than online video.</p>
            <a href="/waitlist" class="blog-read-more" id="readMoreBtn4">Read More →</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ CTA BANNER ═══════════════════ -->
  <section class="cta-banner">
    <div class="cta-glow"></div>
    <div class="section-container cta-container">
      <div class="cta-left reveal-left">
        <h2 class="cta-title">Ready to Scale Your<br /><span class="cyan-text">Ad Campaigns?</span></h2>
        <p class="cta-sub">Join 50,000+ marketers who trust NOLIX to track, optimize, and scale their advertising.</p>
      </div>
      <div class="cta-right reveal-right">
        <a href="/waitlist" class="btn-primary large" id="ctaStartBtn">START FREE TRIAL <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></a>
        <p class="cta-note">No credit card required · Cancel anytime</p>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ FOOTER ═══════════════════ -->
  <footer class="footer">
    <div class="footer-top">
      <div class="footer-logo">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" /></svg>
        <span class="logo-text" style="display:flex;align-items:center;font-weight:900;letter-spacing:1px;font-size:1.1rem;"><span style="color:#fff">NOLI</span><span style="color:#EF4444">X</span></span>
      </div>
    </div>
    <nav class="footer-nav">
      <a href="#features" id="footerFeatures">FEATURES</a>
      <a href="/waitlist" id="footerPricing">PRICING</a>
      <a href="#faq" id="footerFaq">FAQ</a>
      <a href="#blog" id="footerBlog">BLOG</a>
      <a href="/waitlist" id="footerTerms">TERMS & CONDITIONS</a>
      <a href="/waitlist" id="footerPrivacy">PRIVACY POLICY</a>
      <a href="/waitlist" id="footerDisclaimer">DISCLAIMER</a>
      <a href="/waitlist" id="footerContact">CONTACT US</a>
    </nav>
    <div class="footer-bottom">
      <p>© 2025 NOLIX. All rights reserved.</p>
    </div>
  </footer>

  <button class="back-to-top" id="backToTop" aria-label="Back to top">↑</button>

  
` }} />
      <Script src="/iso-app.js" strategy="lazyOnload" />
    </>
  );
}
