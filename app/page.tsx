"use client";
import { useState } from "react";
import styles from "./landing.module.css";

const STEPS = [
  {
    icon: "🔗",
    num: "01",
    title: "Enter URL",
    desc: "Paste your store URL — no login, no access needed.",
  },
  {
    icon: "🤖",
    num: "02",
    title: "AI Analyzes Store",
    desc: "Our engine scans your funnel, pricing, UX, and checkout in seconds.",
  },
  {
    icon: "💰",
    num: "03",
    title: "Get Revenue Insights",
    desc: "Receive a clear breakdown of what's leaking revenue and how to fix it.",
  },
];

const TRUST = [
  { icon: "⚡", text: "Instant analysis in 10 seconds" },
  { icon: "🔒", text: "No access to your store needed" },
  { icon: "📦", text: "No installation required" },
];

const SAMPLE_RESULTS = [
  {
    label: "Revenue Opportunity",
    value: "$4,200 / mo",
    detail: "Based on your current traffic and conversion gap",
    color: "#22c55e",
    icon: "💰",
  },
  {
    label: "Conversion Issues",
    value: "7 found",
    detail: "Product page, cart abandonment, trust signals",
    color: "#f59e0b",
    icon: "📉",
  },
  {
    label: "Checkout Friction",
    value: "High",
    detail: "3 friction points blocking purchase completion",
    color: "#ef4444",
    icon: "🚧",
  },
];

export default function ConvertAIPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    
    let targetUrl = url.trim();
    if (!targetUrl) return;

    // Auto-prepend https if missing for parsing
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    try {
      const parsed = new URL(targetUrl);
      // Ensure the hostname has a valid top-level domain (like .com, .net, .store)
      if (!/\.[a-zA-Z]{2,}$/.test(parsed.hostname)) {
        setErrorMsg("Please enter a valid store URL (e.g., mystore.com)");
        return;
      }
    } catch (err) {
      setErrorMsg("Please enter a valid store URL (e.g., mystore.com)");
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ store: targetUrl });
    setTimeout(() => {
      window.location.href = `/results?${params.toString()}`;
    }, 800);
  }

  return (
    <div className={styles.page}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.nav}>
            <div className={styles.logo}>
              Convert<span className={styles.logoAccent}>AI</span>
            </div>
            <a href="#analyzer" className={styles.navCta}>
              Analyze My Store
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className={styles.hero} id="analyzer">
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.container}>
          {/* Eyebrow */}
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            AI-Powered Revenue Analysis
          </div>

          {/* Headline */}
          <h1 className={styles.heroTitle}>
            See how much revenue your store is{" "}
            <span className={styles.gradient}>losing — instantly</span>
          </h1>
          <p className={styles.heroSub}>
            Enter your store URL below and ConvertAI will pinpoint your biggest
            revenue leaks in under 10 seconds. No code. No access.
          </p>

          {/* ── ANALYZER INPUT ── */}
          <form
            className={styles.analyzerForm}
            onSubmit={handleAnalyze}
            id="analyzer-form"
          >
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🌐</span>
              <input
                id="store-url-input"
                type="text"
                className={styles.urlInput}
                placeholder="Enter your store URL (e.g. yourstore.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                id="analyze-btn"
                type="submit"
                className={styles.analyzeBtn}
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <span className={styles.btnSpinner} />
                ) : (
                  "Analyze My Store →"
                )}
              </button>
            </div>

            {errorMsg && (
              <div style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.5rem", textAlign: "center", fontWeight: "500", background: "rgba(239, 68, 68, 0.1)", padding: "0.25rem 0.75rem", borderRadius: "100px", display: "inline-block", alignSelf: "center", justifySelf: "center", width: "fit-content", margin: "1rem auto 0" }}>{errorMsg}</div>
            )}

            {/* Trust badges */}
            <div className={styles.trustRow}>
              {TRUST.map((t) => (
                <div key={t.text} className={styles.trustBadge}>
                  <span>{t.icon}</span>
                  <span>{t.text}</span>
                </div>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* ── 3-STEP FLOW ── */}
      <section className={styles.stepsSection}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>How It Works</div>
          <div className={styles.stepsGrid}>
            {STEPS.map((s, i) => (
              <div key={s.num} className={styles.stepCard}>
                <div className={styles.stepTop}>
                  <div className={styles.stepNum}>{s.num}</div>
                  <div className={styles.stepIcon}>{s.icon}</div>
                </div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className={styles.stepArrow} aria-hidden>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS PREVIEW ── */}
      <section className={styles.previewSection}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>Sample Report</div>
          <h2 className={styles.previewTitle}>
            Here&apos;s what a typical analysis reveals
          </h2>
          <p className={styles.previewSub}>
            Real stores uncover thousands in hidden revenue on their first scan.
          </p>

          <div className={styles.previewGrid}>
            {SAMPLE_RESULTS.map((r) => (
              <div key={r.label} className={styles.previewCard}>
                <div className={styles.previewBlurOverlay} aria-hidden>
                  <div className={styles.lockBadge}>
                    🔒 Analyze your store to unlock
                  </div>
                </div>
                <div className={styles.previewIcon}>{r.icon}</div>
                <div className={styles.previewLabel}>{r.label}</div>
                <div
                  className={styles.previewValue}
                  style={{ color: r.color }}
                >
                  {r.value}
                </div>
                <div className={styles.previewDetail}>{r.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaBox}>
            <div className={styles.ctaGlow} aria-hidden />
            <h2 className={styles.ctaTitle}>
              Stop guessing. Start growing.
            </h2>
            <p className={styles.ctaSub}>
              Your competitors are already optimizing. Don&apos;t let revenue leave
              through the back door.
            </p>
            <a href="#analyzer" className={styles.analyzeBtn} id="cta-analyze-btn">
              Analyze My Store — It&apos;s Free →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.logo}>
            Convert<span className={styles.logoAccent}>AI</span>
          </div>
          <p className={styles.footerTagline}>
            AI-Powered Revenue Analysis for E-Commerce Stores
          </p>
          <div className={styles.footerLinks}>
            <a href="/dashboard">Dashboard</a>
            <a href="#analyzer">Analyze</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
