"use client";
import { useState, useEffect } from "react";
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
    desc: "Zeno fetches your real page data and scans for revenue leaks.",
  },
  {
    icon: "💰",
    num: "03",
    title: "Get Zeno Health Score",
    desc: "Receive a 0–100 score with a breakdown of exactly what to fix.",
  },
];

const TRUST = [
  { icon: "⚡", text: "Real analysis in 15 seconds" },
  { icon: "🔒", text: "No access to your store needed" },
  { icon: "🎯", text: "AI-powered, not guesswork" },
];

type ValidationState =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "unreachable"
  | "analyzing";

export default function ConvertAIPage() {
  const [url, setUrl] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [validDomain, setValidDomain] = useState("");
  const [isShopify, setIsShopify] = useState(false);
  const [validationDebounce, setValidationDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Live URL format hint (client-side only, before API call)
  const looksLikeUrl = url.trim().length > 3 && url.includes(".");

  // Clear error when user types
  function handleUrlChange(val: string) {
    setUrl(val);
    if (validationState === "invalid" || validationState === "unreachable") {
      setValidationState("idle");
      setErrorMessage("");
    }

    // Debounced validation after 800ms of no typing
    if (validationDebounce) clearTimeout(validationDebounce);
    if (val.trim().length > 4 && val.includes(".")) {
      const t = setTimeout(() => validateUrl(val, false), 900);
      setValidationDebounce(t);
    }
  }

  async function validateUrl(rawUrl: string, isSubmit: boolean): Promise<boolean> {
    setValidationState("validating");
    setErrorMessage("");

    try {
      const res = await fetch("/api/validate-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = await res.json();

      if (data.valid) {
        setValidDomain(data.domain);
        setIsShopify(data.isShopify ?? false);
        setValidationState("valid");
        return true;
      } else {
        setValidationState(data.error === "unreachable" || data.error === "timeout" ? "unreachable" : "invalid");
        setErrorMessage(data.message ?? "Invalid URL. Please enter a valid store website.");
        return false;
      }
    } catch {
      setValidationState("invalid");
      setErrorMessage("Something went wrong. Please try again.");
      return false;
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    // If already validated, go straight to results
    if (validationState === "valid" && validDomain) {
      setValidationState("analyzing");
      const params = new URLSearchParams({ store: validDomain });
      window.location.href = `/results?${params.toString()}`;
      return;
    }

    // Validate first
    const ok = await validateUrl(url, true);
    if (!ok) return;

    // Then navigate
    setValidationState("analyzing");
    const domain = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    const params = new URLSearchParams({ store: domain });
    window.location.href = `/results?${params.toString()}`;
  }

  const isLoading = validationState === "validating" || validationState === "analyzing";
  const hasError = validationState === "invalid" || validationState === "unreachable";
  const isReady = validationState === "valid";

  return (
    <div className={styles.page}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.nav}>
            <div className={styles.logo}>
              Nolix<span className={styles.logoAccent}>.ai</span>
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
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            Zeno Health Score — Real Analysis, Not Guesswork
          </div>

          <h1 className={styles.heroTitle}>
            Find out your store&apos;s{" "}
            <span className={styles.gradient}>real revenue leaks</span>
          </h1>
          <p className={styles.heroSub}>
            Enter your store URL and Zeno will fetch real page data, score your
            store 0–100, and tell you exactly what&apos;s losing you money.
          </p>

          {/* ── ANALYZER INPUT ── */}
          <form
            className={styles.analyzerForm}
            onSubmit={handleAnalyze}
            id="analyzer-form"
          >
            <div
              className={`${styles.inputWrap} ${
                hasError ? styles.inputError : isReady ? styles.inputValid : ""
              }`}
            >
              <span className={styles.inputIcon}>
                {isLoading ? (
                  <span className={styles.spinnerSmall} />
                ) : isReady ? (
                  "✅"
                ) : hasError ? (
                  "❌"
                ) : (
                  "🌐"
                )}
              </span>
              <input
                id="store-url-input"
                type="text"
                className={styles.urlInput}
                placeholder="Enter your store URL (e.g. yourstore.com)"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
              />
              <button
                id="analyze-btn"
                type="submit"
                className={styles.analyzeBtn}
                disabled={isLoading || !url.trim()}
              >
                {validationState === "validating" ? (
                  <>
                    <span className={styles.btnSpinner} />
                    Checking…
                  </>
                ) : validationState === "analyzing" ? (
                  <>
                    <span className={styles.btnSpinner} />
                    Analyzing…
                  </>
                ) : isReady ? (
                  <>View Score →</>
                ) : (
                  "Analyze My Store →"
                )}
              </button>
            </div>

            {/* Error message */}
            {hasError && errorMessage && (
              <div className={styles.errorBanner} role="alert">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Valid confirmation */}
            {isReady && !hasError && (
              <div className={styles.validBanner}>
                <span>✅</span>
                <span>
                  <strong>{validDomain}</strong> verified
                  {isShopify ? " · Shopify store detected" : ""}
                  {" · Click the button to see your Zeno Health Score"}
                </span>
              </div>
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

      {/* ── ZENO HEALTH SCORE PREVIEW ── */}
      <section className={styles.previewSection}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>What You Get</div>
          <h2 className={styles.previewTitle}>
            Your Zeno Health Score — a real breakdown of your store
          </h2>
          <p className={styles.previewSub}>
            Not generic advice. Real signals extracted from your actual store page.
          </p>

          <div className={styles.healthScorePreview}>
            <div className={styles.healthScoreCard}>
              <div className={styles.healthScoreLocked}>
                <div className={styles.scoreLockOverlay}>
                  🔒 Analyze your store to unlock
                </div>
                <div className={styles.scoreCircle}>
                  <div className={styles.scoreNumber}>??</div>
                  <div className={styles.scoreLabel}>/ 100</div>
                </div>
                <div className={styles.scoreTitle}>Zeno Health Score</div>
              </div>
              <div className={styles.scoreBreakdown}>
                {[
                  { label: "Conversion Performance", pts: "?/25" },
                  { label: "Checkout Friction", pts: "?/25" },
                  { label: "Trust Signals", pts: "?/25" },
                  { label: "Offer Optimization", pts: "?/25" },
                ].map((b) => (
                  <div key={b.label} className={styles.breakdownRow}>
                    <span className={styles.breakdownLabel}>{b.label}</span>
                    <span className={styles.breakdownPts}>{b.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.previewIssues}>
              {[
                { icon: "🔒", label: "Trust signals audit" },
                { icon: "🛒", label: "Checkout friction score" },
                { icon: "📱", label: "Mobile readiness check" },
                { icon: "💰", label: "Revenue loss estimate" },
                { icon: "🤖", label: "Zeno's #1 fix for you" },
              ].map((item) => (
                <div key={item.label} className={styles.previewIssueRow}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  <span className={styles.previewLock}>🔒</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaBox}>
            <div className={styles.ctaGlow} aria-hidden />
            <h2 className={styles.ctaTitle}>
              Stop guessing. Get your real score.
            </h2>
            <p className={styles.ctaSub}>
              Zeno analyzes your actual store page — not industry averages.
              See your score in 15 seconds.
            </p>
            <a href="#analyzer" className={styles.analyzeBtn} id="cta-analyze-btn">
              Get My Zeno Score — It&apos;s Free →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.logo}>
            Nolix<span className={styles.logoAccent}>.ai</span>
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
