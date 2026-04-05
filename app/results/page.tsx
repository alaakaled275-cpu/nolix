"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./styles.module.css";
import ZenoChat from "@/app/components/ZenoChat";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FoundationAnalysis {
  business_model: string;
  foundation_score: number;
  judgment: string;
  store_name_verdict: string;
  business_type: string;
  business_type_reasoning: string;
  product_problem: string;
  product_classification: "NEED" | "WANT";
  is_consumable: boolean;
  audience_age: string;
  audience_income: "Low" | "Mid" | "High" | "Mid-High";
  audience_geography: string;
  audience_behavior: "Impulsive" | "Logical" | "Price-sensitive";
  homepage_score: number;
  strengths: string[];
  weaknesses: string[];
}

interface MarketIntelligence {
  market_strength: "Strong" | "Moderate" | "Weak";
  demand_level: "High" | "Medium" | "Low";
  is_saturated: boolean;
  competitor_strength: "Dominant" | "Strong" | "Moderate" | "Fragmented";
  daily_visitors_low: number;
  daily_visitors_high: number;
  monthly_visitors_low: number;
  monthly_visitors_high: number;
  cvr_est: number;
  cvr_reasoning: string;
  monthly_customers_low: number;
  monthly_customers_high: number;
  aov_est: number;
  monthly_revenue_low: number;
  monthly_revenue_high: number;
  profit_margin_pct: number;
  monthly_profit_low: number;
  monthly_profit_high: number;
  valuation_low: number;
  valuation_high: number;
  repeat_purchase: boolean;
  repeat_cycle_days: number | null;
  repeat_purchase_analysis?: string;
  upsell_potential: string | null;
}

interface StrategicAudit {
  is_ad_dependent: boolean;
  has_brand_identity: boolean;
  content_presence: "Strong" | "Moderate" | "Minimal" | "None";
  content_channels: string[];
  ux_speed_score: number;
  ux_navigation_score: number;
  checkout_friction: "High" | "Medium" | "Low";
  checkout_steps_est: number;
  trust_score: number;
  trust_legitimacy: "High" | "Medium" | "Low";
  review_strength: "Strong" | "Moderate" | "Weak" | "None";
  branding_consistency: "High" | "Medium" | "Low";
  strengths: string[];
  weaknesses: string[];
  scenario_best: string;
  scenario_worst: string;
  scenario_realistic: string;
  fix_first: string;
  growth_2x: string;
  growth_10x: string;
  health_score: number;
  health_breakdown_foundation: number;
  health_breakdown_market: number;
  health_breakdown_ux: number;
  health_breakdown_trust: number;
  health_breakdown_revenue_potential: number;
  health_why_not_100: string[];
  health_top_priority: string;
  final_verdict: "\uD83D\uDD25 High potential" | "\u26A0\uFE0F Medium risk" | "\u274C Not recommended";
  action_plan: string[];
  overall_recommendation: string;
}

interface StoreAnalysisResult {
  url: string;
  data_source: "live" | "benchmark";
  business_model: string;
  signals: {
    title: string | null;
    platform: string | null;
    prices: string[];
    lowestPrice: number | null;
    highestPrice: number | null;
    trustKeywords: string[];
    nicheHints: string[];
    wordCount: number;
  };
  foundation: FoundationAnalysis;
  market: MarketIntelligence;
  strategic: StrategicAudit;
  zeno_summary: string;
}

// (Fallback logic removed to enforce strict realism)

// ─── Helper components ─────────────────────────────────────────────────────────
function ScoreCircle({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div className={styles.scoreRing}>
      <div
        className={styles.scoreCircle}
        style={{ "--score-pct": `${pct}%`, "--score-color": color } as React.CSSProperties}
      >
        <div className={styles.scoreCircleInner}>
          <span className={styles.scoreNum}>{score}</span>
        </div>
      </div>
      <span className={styles.scoreOutOf}>out of 10</span>
    </div>
  );
}

function JudgePill({ judgment }: { judgment: string }) {
  const cls = judgment === "Strong foundation" ? styles.judgeStrong
    : judgment === "Weak" ? styles.judgeWeak
    : styles.judgeAverage;
  const icon = judgment === "Strong foundation" ? "🟢" : judgment === "Weak" ? "🔴" : "🟡";
  return <div className={`${styles.judgeVerdict} ${cls}`}>{icon} {judgment}</div>;
}

function BusinessTypePill({ type }: { type: string }) {
  const map: Record<string, string> = {
    Brand: styles.typeBrand,
    Dropshipping: styles.typeDropship,
    Reseller: styles.typeReseller,
    Manufacturer: styles.typeManufact,
    Unknown: styles.typeUnknown,
  };
  const icons: Record<string, string> = {
    Brand: "🏷️", Dropshipping: "📦", Reseller: "🔄", Manufacturer: "🏭", Unknown: "❓",
  };
  return (
    <div className={`${styles.typePill} ${map[type] ?? styles.typeUnknown}`}>
      {icons[type] ?? "❓"} {type}
    </div>
  );
}

function MarketStrengthColor(s: string) {
  return s === "Strong" ? styles.msStrong : s === "Weak" ? styles.msWeak : styles.msModerate;
}

function DemandTagClass(d: string) {
  return d === "High" ? styles.tagHigh : d === "Low" ? styles.tagLow : styles.tagMed;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const storeUrl = params.get("store") ?? "yourstore.com";

  // Phase control
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [loadMsg, setLoadMsg] = useState("Connecting to analysis engine…");
  const [loadPct, setLoadPct] = useState(0);

  // AI analysis state
  const [analysis, setAnalysis] = useState<StoreAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Loading steps — reflect real analysis work
  const loadingSteps = [
    { msg: `Connecting to ${storeUrl}…`, pct: 8 },
    { msg: "Reading homepage signals…", pct: 20 },
    { msg: "Running Foundation Analysis…", pct: 38 },
    { msg: "Running Market Intelligence…", pct: 54 },
    { msg: "Running Deep Strategic Audit…", pct: 70 },
    { msg: "Calculating revenue & valuation…", pct: 84 },
    { msg: "Building investment verdict…", pct: 95 },
    { msg: "Analysis complete.", pct: 100 },
  ];

  // ── Loading animation ──
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < 7) { // 7 corresponds to "Building investment verdict…" at 95%
        setLoadMsg(loadingSteps[i].msg);
        setLoadPct(loadingSteps[i].pct);
        i++;
      } else {
        clearInterval(t); // Hold at 95%
      }
    }, 1800); // Slower interval (1.8s) better matches deep AI processing time
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance to "ready" ONLY when the backend actually finishes
  useEffect(() => {
    if (!analysisLoading && !analysisError) {
      setLoadMsg(loadingSteps[7].msg); // "Analysis complete."
      setLoadPct(100);
      setTimeout(() => setPhase("ready"), 600);
    } else if (!analysisLoading && analysisError) {
      // If error occurs, jump to ready to show the error screen instead of hanging
      setPhase("ready");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisLoading, analysisError]);

  // ── Fetch real AI analysis (runs in background) ──
  useEffect(() => {
    if (!storeUrl) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    fetch("/api/store/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: storeUrl }),
    })
      .then(r => r.json())
      .then((data: any) => {
        if (data.error) {
          setAnalysisError(data.error);
        } else {
          setAnalysis(data as StoreAnalysisResult);
        }
        setAnalysisLoading(false);
      })
      .catch(() => {
        setAnalysisError("Connection required. Zeno needs live data to analyze this store.");
        setAnalysisLoading(false);
      });
  }, [storeUrl]);

  // Animated counters removed payload dependency on mock fallback

  // ─── Loading screen ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadLogoWrap}>
          <span className={styles.loadLogoText}>
            Convert<span className={styles.loadLogoAccent}>AI</span>
          </span>
        </div>
        <div className={styles.loadSpinner} />
        <div className={styles.loadMsg}>{loadMsg}</div>
        <div className={styles.loadBarTrack}>
          <div className={styles.loadBarFill} style={{ width: `${loadPct}%`, transition: "width 0.45s ease" }} />
        </div>
        <div className={styles.loadUrl}>{storeUrl}</div>
      </div>
    );
  }

  // ─── Derived values for AI sections ──────────────────────────────────────────
  const f = analysis?.foundation;
  const m = analysis?.market;
  const s = analysis?.strategic;

  // Zeno intro text
  const zenoIntroText = analysis?.zeno_summary
    ? analysis.zeno_summary
    : `I analyzed ${storeUrl}. Review the strategic audit below.`;

  // ZenoChat analysis object
  const zenoChatAnalysis = analysis ? {
    foundation_score: f?.foundation_score,
    judgment: f?.judgment,
    business_type: f?.business_type,
    business_type_reasoning: f?.business_type_reasoning,
    store_name_verdict: f?.store_name_verdict,
    product_problem: f?.product_problem,
    product_classification: f?.product_classification,
    is_consumable: f?.is_consumable,
    audience_age: f?.audience_age,
    audience_income: f?.audience_income,
    audience_geography: f?.audience_geography,
    audience_behavior: f?.audience_behavior,
    homepage_score: f?.homepage_score,
    strengths: f?.strengths,
    weaknesses: f?.weaknesses,
    market_strength: m?.market_strength,
    demand_level: m?.demand_level,
    monthly_revenue_low: m?.monthly_revenue_low,
    monthly_revenue_high: m?.monthly_revenue_high,
    cvr_est: m?.cvr_est,
    cvr_reasoning: m?.cvr_reasoning,
    aov_est: m?.aov_est,
    monthly_profit_low: m?.monthly_profit_low,
    monthly_profit_high: m?.monthly_profit_high,
    profit_margin_pct: m?.profit_margin_pct,
    valuation_low: m?.valuation_low,
    valuation_high: m?.valuation_high,
    repeat_purchase: m?.repeat_purchase,
    repeat_cycle_days: m?.repeat_cycle_days,
    upsell_potential: m?.upsell_potential,
    // Module 3 — Full Strategic Audit
    is_ad_dependent: s?.is_ad_dependent,
    has_brand_identity: s?.has_brand_identity,
    content_presence: s?.content_presence,
    content_channels: s?.content_channels,
    ux_speed_score: s?.ux_speed_score,
    ux_navigation_score: s?.ux_navigation_score,
    checkout_friction: s?.checkout_friction,
    checkout_steps_est: s?.checkout_steps_est,
    trust_score: s?.trust_score,
    trust_legitimacy: s?.trust_legitimacy,
    review_strength: s?.review_strength,
    branding_consistency: s?.branding_consistency,
    scenario_best: s?.scenario_best,
    scenario_worst: s?.scenario_worst,
    scenario_realistic: s?.scenario_realistic,
    fix_first: s?.fix_first,
    growth_2x: s?.growth_2x,
    growth_10x: s?.growth_10x,
    final_verdict: s?.final_verdict,
    overall_recommendation: s?.overall_recommendation,
    health_score: s?.health_score,
    zeno_summary: analysis.zeno_summary,
    data_source: analysis.data_source,
  } : undefined;

  // ─── Results UI ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/" className={styles.logoLink}>
            Convert<span className={styles.logoAccent}>AI</span>
          </a>
          <div className={styles.headerCenter}>
            <span className={styles.liveDot} />
            <span className={styles.liveLabel}>Store Analysis — {storeUrl}</span>
          </div>
          <button className={styles.btnNew} onClick={() => router.push("/")}>
            ← Analyze Another
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {analysisError ? (() => {
            const isNotEcom = analysisError.includes("not an e-commerce");
            return (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem 0", background: isNotEcom ? "rgba(251,191,36,0.05)" : "rgba(239,68,68,0.05)", borderRadius: "24px", border: `1px solid ${isNotEcom ? "rgba(251,191,36,0.2)" : "rgba(239,68,68,0.15)"}`, margin: "2rem auto", maxWidth: 600 }}>
                <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>{isNotEcom ? "🚫" : "⚠️"}</div>
                <h2 style={{ fontSize: "1.5rem", color: isNotEcom ? "#fbbf24" : "#f87171", marginBottom: 12 }}>
                  {isNotEcom ? "Not an E-Commerce Store" : "Analysis Failed"}
                </h2>
                <p style={{ color: "#9ca3af", marginBottom: 24, fontSize: "1rem", maxWidth: 480, margin: "0 auto 24px auto", lineHeight: 1.7 }}>
                  {analysisError}
                </p>
                {isNotEcom && (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: 24, maxWidth: 420, margin: "0 auto 20px auto" }}>
                    Zeno is designed for e-commerce stores only. Try entering an online store that sells products with pricing.
                  </p>
                )}
                <button className={styles.btnPrimary} onClick={() => router.push("/")} style={{ margin: "0 auto", padding: "12px 28px" }}>
                  ← Try another store
                </button>
              </div>
            );
          })() : (
            <>
              {/* ─── HEADLINE ─── */}
              <div className={styles.resultHeadline}>
                <h1 className={styles.resultH1}>
                  Strategic Analysis:{" "}
                  <span className={styles.lossRange}>
                    {analysis?.signals?.title ? analysis.signals.title.substring(0, 40) : storeUrl}
                  </span>
                </h1>
                <p className={styles.resultSub}>
                  Driven strictly by live data extraction and Zeno's dual-intelligence evaluation model.
                </p>
              </div>

              {/* ─── ZENO INTRO ─── */}
              <div className={styles.zenoIntro}>
                <div className={styles.zenoIntroAvatar}>Z</div>
                <div>
                  <div className={styles.zenoIntroName}>Zeno — Revenue Operator</div>
                  <div className={styles.zenoIntroText}>
                    <strong>{storeUrl}</strong> — {zenoIntroText}
                  </div>
                </div>
              </div>

              {/* ─── ZENO HEALTH SCORE ─── */}
              {s && (
                <div className={styles.healthScoreSection}>
                  <div className={styles.healthScoreTop}>
                    <div className={styles.hsMain}>
                      <div className={styles.hsLabel}>Zeno Health Score</div>
                      <div className={styles.hsValueWrap}>
                        <span className={`${styles.hsValue} ${s.health_score >= 80 ? styles.valGreen : s.health_score >= 50 ? styles.valAmber : styles.valRed}`}>
                          {s.health_score}
                        </span>
                        <span className={styles.hsOutof}>/100</span>
                      </div>
                    </div>
                    <div className={styles.hsPriority}>
                      <div className={styles.hsPriorityLabel}>🚨 Top Priority to Fix</div>
                      <div className={styles.hsPriorityText}>{s.health_top_priority}</div>
                    </div>
                  </div>
                  <div className={styles.hsBars}>
                    {[
                      { l: "Foundation", v: s.health_breakdown_foundation },
                      { l: "Market", v: s.health_breakdown_market },
                      { l: "UX", v: s.health_breakdown_ux },
                      { l: "Trust", v: s.health_breakdown_trust },
                      { l: "Revenue Pot.", v: s.health_breakdown_revenue_potential },
                    ].map(bar => (
                      <div key={bar.l} className={styles.hsBarItem}>
                        <div className={styles.hsBarHeader}>
                          <span>{bar.l}</span>
                          <span>{bar.v}/100</span>
                        </div>
                        <div className={styles.hsBarTrack}>
                          <div
                            className={`${styles.hsBarFill} ${bar.v >= 80 ? styles.barGreen : bar.v >= 50 ? styles.barAmber : styles.barRed}`}
                            style={{ width: `${bar.v}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  MODULE 1 — FOUNDATION ANALYSIS
                  ═══════════════════════════════════════════════════════════════════ */}
          <div className={styles.sectionLabel}>🏗️ Module 1 — Store Foundation Analysis</div>

          {analysisLoading && !analysis ? (
            /* Skeleton while loading */
            <div className={styles.skeletonSection}>
              <div className={styles.analysisPending}>
                <div className={styles.analysisPendingSpinner} />
                Zeno is analyzing the store foundation — this takes 8–12 seconds…
              </div>
              <div className={styles.skeletonLabel}>Foundation Score</div>
              <div className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
              <div className={styles.skeletonLabel}>Business Intelligence</div>
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMed}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarFull}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMed}`} />
            </div>
          ) : f ? (
            <>
              {/* Foundation Score Hero */}
              <div className={styles.foundationHero}>
                <ScoreCircle score={f.foundation_score} />
                <div className={styles.foundationDetails}>
                  <JudgePill judgment={f.judgment} />
                  <div className={styles.foundationTitle}>{f.store_name_verdict}</div>
                  <div className={styles.foundationSub}>
                    Homepage quality: {f.homepage_score}/10 &nbsp;·&nbsp;
                    {f.is_consumable ? "Consumable product (repeat purchase)" : "One-time purchase product"}
                  </div>
                  {analysis?.data_source === "benchmark" && (
                    <div className={styles.benchmarkNote}>
                      ⚠️ Benchmark only — store was unreachable during analysis
                    </div>
                  )}
                </div>
              </div>

              {/* Business + Product + Audience cards */}
              <div className={styles.intelGrid} style={{ marginTop: 14 }}>
                {/* Business Type */}
                <div className={styles.intelCard}>
                  <div className={styles.intelCardLabel}>Business Type</div>
                  <div className={styles.intelCardTitle}>{f.business_type}</div>
                  <div className={styles.intelCardSub}>{f.business_type_reasoning}</div>
                  <BusinessTypePill type={f.business_type} />
                </div>

                {/* Product Analysis */}
                <div className={styles.intelCard}>
                  <div className={styles.intelCardLabel}>Product Analysis</div>
                  <div className={styles.intelCardTitle}>{f.product_problem}</div>
                  <div className={styles.intelCardSub}>
                    {f.is_consumable
                      ? "Consumable — strong repeat purchase potential and LTV."
                      : "One-time purchase — upsell and cross-sell strategy is critical."}
                  </div>
                  <div className={`${styles.needWantTag} ${f.product_classification === "NEED" ? styles.tagNeed : styles.tagWant}`}>
                    {f.product_classification === "NEED" ? "✅ Structural Need" : "⚡ Discretionary Want"}
                  </div>
                </div>

                {/* Target Audience */}
                <div className={styles.intelCard}>
                  <div className={styles.intelCardLabel}>Target Audience</div>
                  <div className={styles.intelCardTitle}>Age {f.audience_age}</div>
                  <div className={styles.intelCardSub}>{f.audience_geography} · {f.audience_behavior} buyers</div>
                  <div className={styles.audienceRow}>
                    <span className={styles.audienceTag}>💰 {f.audience_income} income</span>
                    <span className={styles.audienceTag}>🌍 {f.audience_geography.split("/")[0]}</span>
                    <span className={styles.audienceTag}>{f.audience_behavior === "Impulsive" ? "⚡" : f.audience_behavior === "Logical" ? "🧠" : "💸"} {f.audience_behavior}</span>
                  </div>
                </div>

                {/* Homepage Score */}
                <div className={styles.intelCard}>
                  <div className={styles.intelCardLabel}>Homepage Quality</div>
                  <div className={styles.intelCardTitle}>{f.homepage_score}/10</div>
                  <div className={styles.intelCardSub}>
                    {f.homepage_score >= 7
                      ? "Strong first impression — clear value proposition and trust signals."
                      : f.homepage_score >= 5
                      ? "Average clarity — offer is visible but trust signals are weak."
                      : "Poor homepage quality — visitors won't understand the offer or trust it."}
                  </div>
                  <div className={`${styles.needWantTag} ${f.homepage_score >= 7 ? styles.tagNeed : f.homepage_score >= 5 ? styles.tagWant : styles.judgeWeak}`}
                    style={f.homepage_score < 5 ? { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" } : {}}>
                    {f.homepage_score >= 7 ? "✅ Effective" : f.homepage_score >= 5 ? "⚠️ Needs work" : "🔴 Critical issue"}
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className={styles.swGrid} style={{ marginTop: 14 }}>
                <div className={`${styles.swCard} ${styles.swCardGreen}`}>
                  <div className={`${styles.swCardHeader} ${styles.green}`}>
                    ✅ Strengths
                  </div>
                  <div className={styles.swList}>
                    {(f.strengths ?? []).map((s, i) => (
                      <div key={i} className={styles.swItem}>
                        <div className={`${styles.swDot} ${styles.swDotGreen}`} />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`${styles.swCard} ${styles.swCardRed}`}>
                  <div className={`${styles.swCardHeader} ${styles.red}`}>
                    ⚠️ Weaknesses
                  </div>
                  <div className={styles.swList}>
                    {(f.weaknesses ?? []).map((w, i) => (
                      <div key={i} className={styles.swItem}>
                        <div className={`${styles.swDot} ${styles.swDotRed}`} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════════════
              MODULE 2 — MARKET & REVENUE INTELLIGENCE
              ═══════════════════════════════════════════════════════════════════ */}
          <div className={styles.sectionLabel}>📊 Module 2 — Market & Revenue Intelligence</div>

          {analysisLoading && !analysis ? (
            <div className={styles.skeletonSection}>
              <div className={styles.analysisPending}>
                <div className={styles.analysisPendingSpinner} />
                Running market analysis and revenue estimates…
              </div>
              <div className={`${styles.skeletonBar} ${styles.skeletonBarFull}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMed}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
            </div>
          ) : m ? (
            <>
              {/* Market Strength Banner */}
              <div className={styles.marketBanner}>
                <div className={styles.marketStrengthBadge}>
                  <div className={styles.msBadgeLabel}>Market</div>
                  <div className={`${styles.msBadgeValue} ${MarketStrengthColor(m.market_strength)}`}>
                    {m.market_strength}
                  </div>
                </div>
                <div className={styles.marketTags}>
                  <span className={`${styles.marketTag} ${DemandTagClass(m.demand_level)}`}>
                    📈 {m.demand_level} Demand
                  </span>
                  <span className={`${styles.marketTag} ${m.is_saturated ? styles.tagLow : styles.tagHigh}`}>
                    {m.is_saturated ? "⚠️ Saturated Market" : "✅ Not Yet Saturated"}
                  </span>
                  <span className={`${styles.marketTag} ${styles.tagNeutral}`}>
                    🥊 {m.competitor_strength} Competition
                  </span>
                </div>
              </div>

              {/* Traffic Estimates */}
              <div className={styles.trafficRow} style={{ marginTop: 14 }}>
                <div className={styles.trafficCard}>
                  <div className={styles.trafficCardLabel}>Daily Visitors</div>
                  <div className={styles.trafficCardValue}>
                    {m.daily_visitors_low?.toLocaleString() ?? "N/A"}–{m.daily_visitors_high?.toLocaleString() ?? "N/A"}
                  </div>
                  <div className={styles.trafficCardNote}>Estimated unique daily visits</div>
                </div>
                <div className={styles.trafficCard}>
                  <div className={styles.trafficCardLabel}>Monthly Visitors</div>
                  <div className={styles.trafficCardValue}>
                    {m.monthly_visitors_low?.toLocaleString() ?? "N/A"}–{m.monthly_visitors_high?.toLocaleString() ?? "N/A"}
                  </div>
                  <div className={styles.trafficCardNote}>Based on store quality + niche signals</div>
                </div>
              </div>

              {/* CVR Card */}
              <div className={styles.cvrCard} style={{ marginTop: 14 }}>
                <div>
                  <div className={styles.cvrLabel}>Est. Conversion Rate</div>
                  <div className={styles.cvrValue}>{m.cvr_est}%</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.cvrReasoning}>{m.cvr_reasoning}</div>
                </div>
              </div>

              {/* Revenue Breakdown Table */}
              <div className={styles.revenueTable} style={{ marginTop: 14 }}>
                <div className={styles.revenueTableHeader}>
                  <span>Metric</span>
                  <span>Low est.</span>
                  <span>High est.</span>
                  <span>Note</span>
                </div>
                <div className={styles.revenueTableRow}>
                  <span className={styles.rtMetric}>
                    {f?.business_model === "Content/Media" ? "Active Users (Est.)" : f?.business_model === "SaaS/Tool" ? "Active Subscribers" : "Monthly Customers"}
                  </span>
                  <span className={styles.rtLow}>{m.monthly_customers_low?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtHigh}>{m.monthly_customers_high?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtNote}>
                    {f?.business_model === "Content/Media" ? `At ${m.cvr_est ?? "N/A"}% Ad/Sub CVR` : `At ${m.cvr_est ?? "N/A"}% CVR`}
                  </span>
                </div>
                <div className={styles.revenueTableRow}>
                  <span className={styles.rtMetric}>
                    {f?.business_model === "Content/Media" ? "Est. RPM ($ / 1k views)" : f?.business_model === "SaaS/Tool" ? "ARPU" : "Avg. Order Value (AOV)"}
                  </span>
                  <span className={styles.rtLow}>${m.aov_est ?? "N/A"}</span>
                  <span className={styles.rtHigh}>${m.aov_est ?? "N/A"}</span>
                  <span className={styles.rtNote}>
                    {f?.business_model === "Content/Media" ? "Inferred ad/sponsorship rates" : "Inferred from price signals"}
                  </span>
                </div>
                <div className={styles.revenueTableRow}>
                  <span className={styles.rtMetric}>
                    {f?.business_model === "Content/Media" ? "Ad/Sponsorship Revenue" : f?.business_model === "SaaS/Tool" ? "Monthly MRR" : "Monthly Revenue"}
                  </span>
                  <span className={styles.rtLow}>${m.monthly_revenue_low?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtHigh}>${m.monthly_revenue_high?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtNote}>
                    {f?.business_model === "Content/Media" ? "(Traffic / 1000) × RPM" : "Customers × AOV"}
                  </span>
                </div>
                <div className={styles.revenueTableRow}>
                  <span className={styles.rtMetric}>Monthly Profit ({m.profit_margin_pct ?? "N/A"}% margin)</span>
                  <span className={styles.rtLow}>${m.monthly_profit_low?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtHigh}>${m.monthly_profit_high?.toLocaleString() ?? "N/A"}</span>
                  <span className={styles.rtNote}>
                    {f?.business_model === "Content/Media" ? "Operating margin" : "Est. gross margin"}
                  </span>
                </div>
              </div>

              {/* Repeat Purchase / Upsell */}
              <div className={styles.repeatCard} style={{ marginTop: 14 }}>
                <div className={styles.repeatIcon}>
                  {m.repeat_purchase ? "🔁" : "🎯"}
                </div>
                <div>
                  <div className={styles.repeatTitle}>
                    {f?.business_model === "Content/Media" 
                      ? "Engagement & Ad Revenue" 
                      : m.repeat_purchase 
                        ? "Repeat Purchase Product" 
                        : "One-Time Product — Upsell Strategy Needed"
                    }
                  </div>
                  <div className={styles.repeatDesc}>
                    {f?.business_model === "Content/Media"
                      ? m.repeat_purchase_analysis || "Traffic and content retention drive consistent recurring ad impressions. Scaling unique viewership is paramount."
                      : m.repeat_purchase
                        ? `Customers likely repurchase every ~${m.repeat_cycle_days} days. Strong LTV potential — email retention and subscription offers are high-leverage.`
                        : m.upsell_potential ?? "Focus on upsell at checkout and post-purchase to maximize revenue per customer."
                    }
                  </div>
                  {m.repeat_purchase && m.repeat_cycle_days && (
                    <div className={styles.repeatCycleBadge}>
                      🔄 ~Every {m.repeat_cycle_days} days
                    </div>
                  )}
                </div>
              </div>

              {/* Business Valuation Strip */}
              <div className={styles.valuationStrip} style={{ marginTop: 14 }}>
                <div className={styles.valuationLeft}>
                  <div className={styles.valuationLabel}>Business Valuation Estimate</div>
                  <div className={styles.valuationRange}>
                    ${m.valuation_low?.toLocaleString() ?? "N/A"} – <em>${m.valuation_high?.toLocaleString() ?? "N/A"}</em>
                  </div>
                </div>
                <div className={styles.valuationRight}>
                  <div className={styles.valuationPill}>
                    📐 Based on <span>12–36×</span> monthly profit multiple
                  </div>
                  <div className={styles.valuationPill}>
                    💰 Monthly profit: <span>${m.monthly_profit_low?.toLocaleString() ?? "N/A"}–${m.monthly_profit_high?.toLocaleString() ?? "N/A"}</span>
                  </div>
                  <div className={styles.valuationPill}>
                    📊 Market: <span style={{ color: m.market_strength === "Strong" ? "#22c55e" : m.market_strength === "Weak" ? "#ef4444" : "#f59e0b" }}>{m.market_strength}</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════════════
              MODULE 3 — DEEP STRATEGIC AUDIT
              ═══════════════════════════════════════════════════════════════════ */}
          <div className={styles.sectionLabel}>🔍 Module 3 — Deep Strategic Audit</div>

          {analysisLoading && !analysis ? (
            <div className={styles.skeletonSection}>
              <div className={styles.analysisPending}>
                <div className={styles.analysisPendingSpinner} />
                Running deep strategic audit — marketing, UX, trust, scenarios, growth plan…
              </div>
              <div className={`${styles.skeletonBar} ${styles.skeletonBarFull}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMed}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
            </div>
          ) : s ? (
            <>
              {/* Marketing + UX + Trust 3-col */}
              <div className={styles.intelGrid}>
                {/* Marketing */}
                <div className={styles.marketingCard}>
                  <div className={styles.marketingCardLabel}>📣 Marketing Analysis</div>
                  <div className={styles.marketingRow}>
                    <span className={styles.marketingRowIcon}>📢</span>
                    <span className={styles.marketingRowLabel}>Ad Dependent</span>
                    <span className={`${styles.marketingRowVal} ${s.is_ad_dependent ? styles.valRed : styles.valGreen}`}>
                      {s.is_ad_dependent ? "Yes — risky" : "No — healthy"}
                    </span>
                  </div>
                  <div className={styles.marketingRow}>
                    <span className={styles.marketingRowIcon}>🏷️</span>
                    <span className={styles.marketingRowLabel}>Brand Identity</span>
                    <span className={`${styles.marketingRowVal} ${s.has_brand_identity ? styles.valGreen : styles.valRed}`}>
                      {s.has_brand_identity ? "Present" : "Missing"}
                    </span>
                  </div>
                  <div className={styles.marketingRow}>
                    <span className={styles.marketingRowIcon}>📱</span>
                    <span className={styles.marketingRowLabel}>Content</span>
                    <span className={`${styles.marketingRowVal} ${
                      s.content_presence === "Strong" ? styles.valGreen
                      : s.content_presence === "None" ? styles.valRed : styles.valAmber
                    }`}>{s.content_presence}</span>
                  </div>
                  {(s.content_channels ?? []).length > 0 && (
                    <div className={styles.channelTags}>
                      {(s.content_channels as string[]).map((c, i) => (
                        <span key={i} className={styles.channelTag}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* UX */}
                <div className={styles.marketingCard}>
                  <div className={styles.marketingCardLabel}>🖥️ UX Analysis</div>
                  <div className={styles.scoreBarGroup}>
                    {[
                      { label: "Site Speed", score: s.ux_speed_score },
                      { label: "Navigation", score: s.ux_navigation_score },
                    ].map(({ label, score }) => (
                      <div key={label} className={styles.scoreBarRow}>
                        <span className={styles.scoreBarLabel}>{label}</span>
                        <div className={styles.scoreBarTrack}>
                          <div
                            className={`${styles.scoreBarFill} ${score >= 7 ? styles.barGreen : score >= 5 ? styles.barAmber : styles.barRed}`}
                            style={{ width: `${score * 10}%` }}
                          />
                        </div>
                        <span className={styles.scoreBarNum}>{score}/10</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                    <div className={styles.auditStat}>
                      <div className={`${styles.auditStatValue} ${
                        s.checkout_friction === "Low" ? styles.valGreen
                        : s.checkout_friction === "High" ? styles.valRed : styles.valAmber}`}>
                        {s.checkout_friction}
                      </div>
                      <div className={styles.auditStatLabel}>Friction</div>
                    </div>
                    <div className={styles.auditStat}>
                      <div className={`${styles.auditStatValue} ${
                        s.checkout_steps_est <= 3 ? styles.valGreen
                        : s.checkout_steps_est >= 5 ? styles.valRed : styles.valAmber}`}>
                        {s.checkout_steps_est}
                      </div>
                      <div className={styles.auditStatLabel}>Steps</div>
                    </div>
                  </div>
                </div>

                {/* Trust */}
                <div className={styles.marketingCard}>
                  <div className={styles.marketingCardLabel}>🔒 Trust Analysis</div>
                  <div className={styles.scoreBarGroup}>
                    <div className={styles.scoreBarRow}>
                      <span className={styles.scoreBarLabel}>Trust Score</span>
                      <div className={styles.scoreBarTrack}>
                        <div
                          className={`${styles.scoreBarFill} ${s.trust_score >= 7 ? styles.barGreen : s.trust_score >= 5 ? styles.barAmber : styles.barRed}`}
                          style={{ width: `${s.trust_score * 10}%` }}
                        />
                      </div>
                      <span className={styles.scoreBarNum}>{s.trust_score}/10</span>
                    </div>
                  </div>
                  <div className={styles.marketingRow} style={{ marginTop: 12 }}>
                    <span className={styles.marketingRowIcon}>🧾</span>
                    <span className={styles.marketingRowLabel}>Legitimacy</span>
                    <span className={`${styles.marketingRowVal} ${s.trust_legitimacy === "High" ? styles.valGreen : s.trust_legitimacy === "Low" ? styles.valRed : styles.valAmber}`}>
                      {s.trust_legitimacy}
                    </span>
                  </div>
                  <div className={styles.marketingRow}>
                    <span className={styles.marketingRowIcon}>⭐</span>
                    <span className={styles.marketingRowLabel}>Reviews</span>
                    <span className={`${styles.marketingRowVal} ${s.review_strength === "Strong" ? styles.valGreen : s.review_strength === "None" ? styles.valRed : styles.valAmber}`}>
                      {s.review_strength}
                    </span>
                  </div>
                  <div className={styles.marketingRow}>
                    <span className={styles.marketingRowIcon}>🎨</span>
                    <span className={styles.marketingRowLabel}>Brand Consistency</span>
                    <span className={`${styles.marketingRowVal} ${s.branding_consistency === "High" ? styles.valGreen : s.branding_consistency === "Low" ? styles.valRed : styles.valAmber}`}>
                      {s.branding_consistency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Strategic Strengths & Buyer Blockers */}
              <div className={styles.swGrid} style={{ marginTop: 14 }}>
                <div className={`${styles.swCard} ${styles.swCardGreen}`}>
                  <div className={`${styles.swCardHeader} ${styles.green}`}>💪 Strategic Strengths</div>
                  <div className={styles.swList}>
                    {(s.strengths as string[] ?? []).map((str, i) => (
                      <div key={i} className={styles.swItem}>
                        <div className={`${styles.swDot} ${styles.swDotGreen}`} />
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`${styles.swCard} ${styles.swCardRed}`}>
                  <div className={`${styles.swCardHeader} ${styles.red}`}>🚫 Buyer Blockers</div>
                  <div className={styles.swList}>
                    {(s.weaknesses as string[] ?? []).map((w, i) => (
                      <div key={i} className={styles.swItem}>
                        <div className={`${styles.swDot} ${styles.swDotRed}`} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              <div className={styles.sectionLabel} style={{ marginTop: 32 }}>📈 Investment Scenarios</div>
              <div className={styles.scenariosGrid}>
                <div className={`${styles.scenarioCard} ${styles.scenarioBest}`}>
                  <span className={styles.scenarioIcon}>🚀</span>
                  <div className={styles.scenarioLabel}>Best Case</div>
                  <div className={styles.scenarioText}>{s.scenario_best}</div>
                </div>
                <div className={`${styles.scenarioCard} ${styles.scenarioReal}`}>
                  <span className={styles.scenarioIcon}>📊</span>
                  <div className={styles.scenarioLabel}>Realistic</div>
                  <div className={styles.scenarioText}>{s.scenario_realistic}</div>
                </div>
                <div className={`${styles.scenarioCard} ${styles.scenarioWorst}`}>
                  <span className={styles.scenarioIcon}>⚠️</span>
                  <div className={styles.scenarioLabel}>Worst Case</div>
                  <div className={styles.scenarioText}>{s.scenario_worst}</div>
                </div>
              </div>

              {/* Growth Plan */}
              <div className={styles.sectionLabel} style={{ marginTop: 32 }}>📐 Growth Plan</div>
              <div className={styles.growthGrid}>
                <div className={`${styles.growthCard} ${styles.growthCardFix}`}>
                  <div className={`${styles.growthBadge} ${styles.growthBadgeFix}`}>🔴 Fix First</div>
                  <div className={styles.growthText}>{s.fix_first}</div>
                </div>
                <div className={`${styles.growthCard} ${styles.growthCard2x}`}>
                  <div className={`${styles.growthBadge} ${styles.growthBadge2x}`}>⚡ 2× Performance</div>
                  <div className={styles.growthText}>{s.growth_2x}</div>
                </div>
                <div className={`${styles.growthCard} ${styles.growthCard10x}`}>
                  <div className={`${styles.growthBadge} ${styles.growthBadge10x}`}>🚀 10× Performance</div>
                  <div className={styles.growthText}>{s.growth_10x}</div>
                </div>
              </div>

              {/* Action Plan */}
              <div className={styles.sectionLabel} style={{ marginTop: 32 }}>✅ Zeno Action Plan</div>
              <div className={styles.actionPlanList}>
                {(s.action_plan as string[] ?? []).map((step, i) => (
                  <div key={i} className={styles.actionPlanItem}>
                    <div className={styles.actionPlanNum}>{i + 1}</div>
                    <div className={styles.actionPlanText}>{step.replace(/^\d+\.\s*/, "")}</div>
                  </div>
                ))}
              </div>

              {/* Final Verdict */}
              <div className={styles.sectionLabel} style={{ marginTop: 32 }}>⚖️ Final Investment Verdict</div>
              {(() => {
                const isfire = s.final_verdict?.includes("High");
                const isno = s.final_verdict?.includes("Not");
                const cls = isfire ? styles.verdictFire : isno ? styles.verdictNo : styles.verdictWarning;
                const glowCls = isfire ? styles.verdictFireGlow : isno ? styles.verdictNoGlow : styles.verdictWarningGlow;
                return (
                  <div className={`${styles.verdictBanner} ${cls}`}>
                    <div className={`${styles.verdictGlow} ${glowCls}`} aria-hidden />
                    <span className={styles.verdictEmoji}>{isfire ? "🔥" : isno ? "❌" : "⚠️"}</span>
                    <div className={styles.verdictTitle}>{s.final_verdict}</div>
                    <div className={styles.verdictRec}>{s.overall_recommendation}</div>
                  </div>
                );
              })()}

              {/* ── FINAL CALL TO ACTION ── */}
              <div className={styles.ctaBox} style={{ marginTop: 48, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
                <h2 style={{ fontSize: "24px", color: "#fff", marginBottom: "12px", textAlign: "center" }}>Ready to deploy these fixes?</h2>
                <p style={{ color: "#a1a1aa", fontSize: "16px", textAlign: "center", marginBottom: "28px" }}>
                  Activate NOLIX to instantly implement Zeno's recommended growth plan on {storeUrl}.
                </p>
                <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                  <a href={`/activate?store=${encodeURIComponent(storeUrl)}`} className={styles.btnPrimary}>
                    Activate Engine →
                  </a>
                  <a href="/" className={styles.btnSecondary}>
                    Analyze Another Store
                  </a>
                </div>
              </div>
            </>
          ) : null}
            </>
          )}

        </div>
      </main>

      <ZenoChat
        context={{ total_sessions: m?.monthly_visitors_low || 1000, cvr_pct: m?.cvr_est || 1.5 }}
        storeName={storeUrl}
        storeAnalysis={zenoChatAnalysis}
      />
    </div>
  );
}
