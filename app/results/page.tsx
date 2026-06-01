"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./styles.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HealthBreakdown {
  conversionPerformance: number;
  checkoutFriction: number;
  trustSignals: number;
  offerOptimization: number;
}

interface AnalysisResult {
  domain: string;
  platform: string;
  healthScore: { total: number; breakdown: HealthBreakdown };
  signals: {
    trust: Record<string, boolean>;
    pricing: Record<string, boolean>;
    checkout: Record<string, boolean>;
    mobile: Record<string, boolean>;
  };
  zenoSummary: string;
  topIssues: Array<{ icon: string; label: string; detail: string; type: string }>;
  topFix: string;
  estimatedRevenueLoss: string;
  conversionEstimate: string;
  limited: boolean;
  analyzedAt: string;
}

// ─── Score color logic ────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

function getScoreLabel(score: number) {
  if (score >= 75) return "Good";
  if (score >= 55) return "Needs Work";
  if (score >= 35) return "Poor";
  return "Critical";
}

// ─── Breakdown bar color ──────────────────────────────────────────────────────
function getBarColor(val: number, max: number) {
  const pct = val / max;
  if (pct >= 0.75) return "#22c55e";
  if (pct >= 0.5) return "#f59e0b";
  return "#ef4444";
}

// ─── Loading steps ────────────────────────────────────────────────────────────
const LOAD_STEPS = [
  { msg: "Resolving domain…", pct: 10 },
  { msg: "Fetching real page content…", pct: 25 },
  { msg: "Extracting trust signals…", pct: 40 },
  { msg: "Analyzing checkout friction…", pct: 55 },
  { msg: "Detecting pricing visibility…", pct: 68 },
  { msg: "Running Zeno AI analysis…", pct: 82 },
  { msg: "Calculating Health Score…", pct: 94 },
  { msg: "Analysis complete.", pct: 100 },
];

// ─── Main Results Component ───────────────────────────────────────────────────
function ResultsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const domain = params.get("store") ?? "";

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadMsg, setLoadMsg] = useState(LOAD_STEPS[0].msg);
  const [loadPct, setLoadPct] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [visibleIssues, setVisibleIssues] = useState<AnalysisResult["topIssues"]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const loadStepRef = useRef(0);
  const loadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Redirect if no domain ──────────────────────────────────────────────────
  useEffect(() => {
    if (!domain) {
      router.push("/");
    }
  }, [domain, router]);

  // ── Loading animation + real fetch ────────────────────────────────────────
  useEffect(() => {
    if (!domain) return;

    // Advance loading bar
    loadIntervalRef.current = setInterval(() => {
      loadStepRef.current += 1;
      const step = LOAD_STEPS[Math.min(loadStepRef.current, LOAD_STEPS.length - 2)];
      setLoadMsg(step.msg);
      setLoadPct(step.pct);
    }, 700);

    // Fetch real analysis
    fetch(`/api/store-analysis?domain=${encodeURIComponent(domain)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.message ?? "Analysis failed");
        }
        return data as AnalysisResult;
      })
      .then((data) => {
        // Finish load animation
        if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
        setLoadMsg(LOAD_STEPS[LOAD_STEPS.length - 1].msg);
        setLoadPct(100);
        setTimeout(() => {
          setAnalysis(data);
          setPhase("ready");
        }, 500);
      })
      .catch((err) => {
        if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
        setErrorMsg(err.message ?? "We couldn't analyze this store. Please try again.");
        setPhase("error");
      });

    return () => {
      if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
    };
  }, [domain]);

  // ── Progressive issue reveal ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "ready" || !analysis) return;
    setVisibleIssues([]);

    analysis.topIssues.forEach((issue, i) => {
      setTimeout(() => {
        setVisibleIssues((prev) => [...prev, issue]);
      }, 200 + i * 200);
    });

    setTimeout(() => setShowDetails(true), 200 + analysis.topIssues.length * 200 + 200);
    setTimeout(() => setShowCta(true), 200 + analysis.topIssues.length * 200 + 600);
  }, [phase, analysis]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadLogoWrap}>
          <span className={styles.loadLogoText}>
            Nolix<span className={styles.loadLogoAccent}>.ai</span>
          </span>
        </div>
        <div className={styles.loadSpinner} />
        <div className={styles.loadMsg}>{loadMsg}</div>
        <div className={styles.loadBarTrack}>
          <div
            className={styles.loadBarFill}
            style={{ width: `${loadPct}%`, transition: "width 0.5s ease" }}
          />
        </div>
        <div className={styles.loadUrl}>{domain}</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorIcon}>⚠️</div>
        <div className={styles.errorTitle}>We couldn&apos;t analyze this store</div>
        <div className={styles.errorMsg}>{errorMsg}</div>
        <a href="/" className={styles.errorBtn}>
          ← Try a different URL
        </a>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULTS SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const { healthScore, topIssues, zenoSummary, topFix, estimatedRevenueLoss, conversionEstimate, signals, platform, limited } = analysis;
  const scoreColor = getScoreColor(healthScore.total);
  const scoreLabel = getScoreLabel(healthScore.total);

  const breakdownItems = [
    { name: "Conversion Performance", score: healthScore.breakdown.conversionPerformance, max: 25 },
    { name: "Checkout Friction", score: healthScore.breakdown.checkoutFriction, max: 25 },
    { name: "Trust Signals", score: healthScore.breakdown.trustSignals, max: 25 },
    { name: "Offer Optimization", score: healthScore.breakdown.offerOptimization, max: 25 },
  ];

  const trustRows = [
    { name: "SSL / Secure", val: signals.trust.hasSSL },
    { name: "Customer Reviews", val: signals.trust.hasReviews },
    { name: "Money-back Guarantee", val: signals.trust.hasMoneyBack },
    { name: "Free Shipping Signal", val: signals.trust.hasFreeShipping },
    { name: "Trust Badge", val: signals.trust.hasTrustBadge },
    { name: "Return Policy", val: signals.trust.hasReturnPolicy },
  ];

  const checkoutRows = [
    { name: "Cart Present", val: signals.checkout.hasCheckout },
    { name: "PayPal / Stripe", val: signals.checkout.hasPaypalOrStripe },
    { name: "Multiple Payments", val: signals.checkout.hasMultiPayment },
    { name: "Multi-step Checkout", val: signals.checkout.hasMultiStep, invert: true },
    { name: "Exit-intent Recovery", val: signals.checkout.hasCartAbandonment },
  ];

  return (
    <div className={styles.page}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.logoLink}>
            Nolix<span className={styles.logoAccent}>.ai</span>
          </a>
          <div className={styles.headerCenter}>
            <span className={styles.liveDot} />
            <span className={styles.liveLabel}>
              Analysis — {domain} · {platform}
            </span>
          </div>
          <button className={styles.btnNew} onClick={() => router.push("/")}>
            ← New Analysis
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ── LIMITED DATA NOTICE ── */}
          {limited && (
            <div className={styles.limitedNotice}>
              <span>⚠️</span>
              <span>
                Partial page data available — some elements couldn&apos;t be fetched.
                Analysis is based on what Zeno could access. Results may be incomplete.
              </span>
            </div>
          )}

          {/* ── ZENO HEALTH SCORE BANNER ── */}
          <div className={styles.healthScoreBanner}>
            {/* Score Circle */}
            <div className={styles.scoreCircleWrap}>
              <div className={styles.scoreCircle} style={{ border: `4px solid ${scoreColor}` }}>
                <span className={styles.scoreValue} style={{ color: scoreColor }}>
                  {healthScore.total}
                </span>
                <span className={styles.scoreMax}>/100</span>
              </div>
              <span className={styles.scoreTag} style={{ color: scoreColor }}>
                {scoreLabel}
              </span>
            </div>

            {/* Breakdown bars */}
            <div className={styles.scoreBreakdownGrid}>
              {breakdownItems.map((item) => (
                <div key={item.name} className={styles.breakdownItem}>
                  <div className={styles.breakdownHeader}>
                    <span className={styles.breakdownName}>{item.name}</span>
                    <span className={styles.breakdownScore}>
                      {item.score}/{item.max}
                    </span>
                  </div>
                  <div className={styles.breakdownBar}>
                    <div
                      className={styles.breakdownFill}
                      style={{
                        width: `${(item.score / item.max) * 100}%`,
                        background: getBarColor(item.score, item.max),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className={styles.scoreSummaryBox}>
              <div className={styles.scoreSummaryTitle}>Zeno Health Score</div>
              <div className={styles.scoreSummaryText}>{zenoSummary}</div>
            </div>
          </div>

          {/* ── ZENO INTRO ── */}
          <div className={styles.zenoIntro}>
            <div className={styles.zenoIntroAvatar}>Z</div>
            <div>
              <div className={styles.zenoIntroName}>Zeno — Revenue Operator</div>
              <div className={styles.zenoIntroText}>
                I analyzed <strong>{domain}</strong> in real-time.
                Your store scored <strong style={{ color: scoreColor }}>{healthScore.total}/100</strong>.{" "}
                {healthScore.breakdown.trustSignals < 13
                  ? "Trust signals are your biggest gap — buyers don't feel safe enough to convert."
                  : healthScore.breakdown.checkoutFriction < 13
                  ? "Checkout friction is killing your revenue — too many barriers between intent and purchase."
                  : "Here are the key issues I found and the single most impactful fix to start with."}
              </div>
            </div>
          </div>

          {/* ── REVENUE OPPORTUNITY ── */}
          <div className={styles.sectionLabel}>💰 Revenue Opportunity</div>
          <div className={styles.opportunityGrid}>
            <div className={`${styles.oppCard} ${styles.oppCardPrimary}`}>
              <div className={styles.oppIcon}>📉</div>
              <div className={`${styles.oppValue}`} style={{ color: "#ef4444" }}>
                {estimatedRevenueLoss}
              </div>
              <div className={styles.oppLabel}>Estimated Monthly Revenue Loss</div>
              <div className={styles.oppSub}>
                Based on real signals extracted from {domain}
              </div>
            </div>
            <div className={styles.oppCard}>
              <div className={styles.oppIcon}>📊</div>
              <div className={`${styles.oppValue} ${styles.oppAmber}`}>
                ~{conversionEstimate}
              </div>
              <div className={styles.oppLabel}>Estimated Current CVR</div>
              <div className={styles.oppSub}>
                Optimized stores at your health score average 3.0%+
              </div>
            </div>
            <div className={styles.oppCard}>
              <div className={styles.oppIcon}>🎯</div>
              <div className={`${styles.oppValue}`} style={{ color: "#7c3aed" }}>
                {healthScore.total}/100
              </div>
              <div className={styles.oppLabel}>Zeno Health Score</div>
              <div className={styles.oppSub}>
                {100 - healthScore.total} points of improvement available
              </div>
            </div>
          </div>

          {/* ── KEY ISSUES ── */}
          <div className={styles.sectionLabel}>
            ⚠️ Key Issues — {topIssues.length} Found
          </div>
          <div className={styles.issuesList}>
            {visibleIssues.map((issue, i) => (
              <div
                key={i}
                className={`${styles.issueItem} ${styles[`issue_${issue.type}` as keyof typeof styles]}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className={styles.issueIcon}>{issue.icon}</span>
                <div>
                  <div className={styles.issueLabel}>{issue.label}</div>
                  <div className={styles.issueDetail}>{issue.detail}</div>
                </div>
              </div>
            ))}
            {visibleIssues.length < topIssues.length && (
              <div className={styles.logLoading}>
                <span className={styles.miniSpinner} /> Scanning…
              </div>
            )}
          </div>

          {/* ── TOP FIX ── */}
          {showDetails && topFix && (
            <div className={styles.topFixBox}>
              <span className={styles.topFixIcon}>🚀</span>
              <div>
                <div className={styles.topFixLabel}>Zeno&apos;s #1 Fix Right Now</div>
                <div className={styles.topFixText}>{topFix}</div>
              </div>
            </div>
          )}

          {/* ── SIGNAL DETAILS ── */}
          {showDetails && (
            <>
              <div className={styles.sectionLabel}>🔍 Signal Breakdown</div>
              <div className={styles.detailsGrid}>
                {/* Trust Signals */}
                <div className={styles.detailCard}>
                  <div className={styles.detailCardTitle}>Trust Signals</div>
                  {trustRows.map((row) => (
                    <div key={row.name} className={styles.signalRow}>
                      <span className={styles.signalName}>{row.name}</span>
                      <span
                        className={
                          row.val
                            ? styles.signalOk
                            : styles.signalMissing
                        }
                      >
                        {row.val ? "✓ Found" : "✗ Missing"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Checkout Signals */}
                <div className={styles.detailCard}>
                  <div className={styles.detailCardTitle}>Checkout & Conversion</div>
                  {checkoutRows.map((row) => {
                    const status = row.invert ? !row.val : row.val;
                    return (
                      <div key={row.name} className={styles.signalRow}>
                        <span className={styles.signalName}>{row.name}</span>
                        <span
                          className={status ? styles.signalOk : styles.signalMissing}
                        >
                          {row.val
                            ? row.invert ? "⚠ Detected" : "✓ Found"
                            : row.invert ? "✓ Not detected" : "✗ Missing"}
                        </span>
                      </div>
                    );
                  })}
                  <div className={styles.signalRow}>
                    <span className={styles.signalName}>Platform</span>
                    <span className={styles.signalOk}>{platform}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CTA ── */}
          {showCta && (
            <div className={styles.ctaSection}>
              <div className={styles.ctaBox}>
                <div className={styles.ctaGlow} aria-hidden />
                <h2 className={styles.ctaTitle}>
                  Ready to fix your {healthScore.total}/100 score?
                </h2>
                <p className={styles.ctaSub}>
                  Connect Nolix and Zeno will start recovering revenue automatically.
                  One script — measurable results within 7 days.
                </p>
                <div className={styles.ctaBtns}>
                  <a
                    href={`/activate?store=${encodeURIComponent(domain)}&score=${healthScore.total}`}
                    className={styles.btnPrimary}
                    id="results-cta-activate-btn"
                  >
                    ✅ Connect My Store — Free
                  </a>
                  <button
                    className={styles.btnSecondary}
                    onClick={() => router.push("/")}
                    id="results-cta-analyze-btn"
                  >
                    ← Analyze Another Store
                  </button>
                </div>
                <div className={styles.ctaTrust}>
                  <span>✓ 14-day free trial</span>
                  <span>✓ No code changes needed</span>
                  <span>✓ Cancel anytime</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Suspense Wrapper (required for useSearchParams in Next.js) ───────────────
export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#050508",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
          }}
        >
          Loading…
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
