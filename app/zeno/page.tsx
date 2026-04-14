"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import ZenoChat from "@/app/components/ZenoChat";

type Stats = {
  total_sessions: number;
  high_intent_sessions: number;
  popups_shown: number;
  total_conversions: number;
  cvr_pct: number;
  offer_rate_pct: number;
  revenue_attributed: number;
  revenue_lift_est: string;
  discount_saved_pct: number;
  discount_avoided_count: number;
  today: { analyzed: number; actions_taken: number; conversions: number; revenue: number; discounts_avoided: number };
  top_action: string | null;
  top_action_cvr: number;
  intent_distribution: { intent_level: string; count: string }[];
  friction_distribution: { friction_detected: string; count: string }[];
  ab_results: { variant: string; offer_type: string; impressions: number; conversions: number }[];
  insights: string[];
  sessions: {
    intent_level: string; intent_score: number; friction_detected: string | null;
    converted: boolean; offer_type: string | null; business_explanation: string;
    traffic_source: string; cart_status: string; device: string;
  }[];
};

interface LearningEntry {
  id: string;
  url: string;
  error_type: string;
  correction_rule: string;
  confidence_before: number;
  confidence_after: number;
  phase: string;
  created_at: string;
}
interface LearningLog {
  entries: LearningEntry[];
  total: number;
  total_confidence_gain: number;
  by_phase: Record<string, number>;
  by_error_type: Record<string, number>;
}

// ── Decision cards generated from real data ─────────────────────────────────
function buildDecisionCards(stats: Stats) {
  const cards = [];
  const topFriction = [...(stats.friction_distribution ?? [])].sort((a, b) => Number(b.count) - Number(a.count))[0];
  const highPct = stats.total_sessions > 0 ? Math.round((stats.high_intent_sessions / stats.total_sessions) * 100) : 0;

  // A/B winner
  const abGrouped = (stats.ab_results ?? []).reduce((acc, r) => {
    if (!acc[r.variant]) acc[r.variant] = { impressions: 0, conversions: 0 };
    acc[r.variant].impressions += r.impressions; acc[r.variant].conversions += r.conversions;
    return acc;
  }, {} as Record<string, { impressions: number; conversions: number }>);
  const cvrA = abGrouped["A"]?.impressions > 0 ? (abGrouped["A"].conversions / abGrouped["A"].impressions) * 100 : 0;
  const cvrB = abGrouped["B"]?.impressions > 0 ? (abGrouped["B"].conversions / abGrouped["B"].impressions) * 100 : 0;
  const winner = cvrA >= cvrB ? "A" : "B";
  const winnerLabel = winner === "A" ? "Rational copy" : "Emotional copy";

  if (stats.cvr_pct < 3 && stats.total_sessions > 5) {
    cards.push({
      icon: "⚠️", type: "warning",
      title: "Checkout leakage detected",
      body: `CVR is ${stats.cvr_pct}% — below the 3% baseline. ${stats.total_sessions - stats.total_conversions} out of ${stats.total_sessions} sessions did not convert. Primary leak is at decision-to-buy.`,
      action: "Activate urgency messages on checkout sessions",
    });
  }

  if (topFriction?.friction_detected === "stuck_cart" && Number(topFriction.count) > 2) {
    cards.push({
      icon: "🛒", type: "warning",
      title: "Cart abandonment pattern",
      body: `${topFriction.count} sessions got stuck in cart without completing checkout. These visitors intended to buy.`,
      action: "Apply a 10% timed discount to stuck-cart visitors",
    });
  }

  if (highPct > 30) {
    cards.push({
      icon: "🧠", type: "insight",
      title: "High-intent traffic detected",
      body: `${highPct}% of visitors (${stats.high_intent_sessions} sessions) showed strong buying signals — paid ads or direct intent. This segment converts at 2–3× the average rate.`,
      action: "Prioritize urgency messages for this segment",
    });
  }

  if (stats.discount_saved_pct > 50) {
    cards.push({
      icon: "🛡️", type: "success",
      title: "Margin protection working",
      body: `${stats.discount_saved_pct}% of buyers converted WITHOUT a discount — the system is preserving margin by holding discounts for visitors who actually need them.`,
      action: "Maintain current incentive threshold — no changes needed",
    });
  }

  if ((abGrouped["A"] || abGrouped["B"]) && Math.abs(cvrA - cvrB) > 1) {
    cards.push({
      icon: "⚗️", type: "decision",
      title: `Variant ${winner} is winning the A/B test`,
      body: `${winnerLabel} converts at ${(winner === "A" ? cvrA : cvrB).toFixed(1)}% vs ${(winner === "A" ? cvrB : cvrA).toFixed(1)}%. The gap is ${Math.abs(cvrA - cvrB).toFixed(1)}pp — statistically meaningful.`,
      action: `Stop splitting. Run Variant ${winner} as default.`,
    });
  }

  if (cards.length === 0) {
    cards.push({
      icon: "👁️", type: "insight",
      title: "Zeno is monitoring",
      body: `${stats.total_sessions} sessions analyzed. Engine is active and watching for behavioral patterns. Insights will surface as data grows.`,
      action: "No action required — continue monitoring",
    });
  }

  return cards;
}

// ── Status cycling ────────────────────────────────────────────────────────────
const STATUS_CYCLE = [
  "Monitoring visitor behavior",
  "Analyzing intent signals",
  "Watching checkout funnel",
  "Revenue engine active",
  "Scanning for drop-off points",
];

export default function ZenoPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusIdx, setStatusIdx] = useState(0);
  const [learningLog, setLearningLog] = useState<LearningLog | null>(null);

  useEffect(() => {
    const isDemo = new URLSearchParams(window.location.search).get("demo") === "true";
    
    const fetchStats = () => {
      fetch(`/api/convert/stats${isDemo ? "?demo=true" : ""}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setStats(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    fetchStats();
    
    // Pulse every 8 seconds for the Live Terminal feel
    const pollInterval = setInterval(fetchStats, 8000);

    fetch("/api/zeno/self-improve?limit=10")
      .then(r => r.json())
      .then(d => setLearningLog(d))
      .catch(() => {});

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % STATUS_CYCLE.length), 3500);
    return () => clearInterval(t);
  }, []);

  const cards = stats ? buildDecisionCards(stats) : [];

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/" className={styles.logo}>Convert<span className={styles.logoAccent}>AI</span></a>
          <nav className={styles.nav}>
            <a href="/dashboard" className={styles.navLink}>Dashboard</a>
            <a href="/zeno" className={`${styles.navLink} ${styles.navActive}`}>Zeno</a>
            <a href="/zeno/learning-log" className={styles.navLink}>Learning Log</a>
          </nav>
          <a href="/dashboard" className={styles.btnBack}>← Dashboard</a>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ── Zeno Identity Header ── */}
          <div className={styles.zenoHeader}>
            <div className={styles.zenoGlow} aria-hidden />
            <div className={styles.zenoIdentity}>
              <div className={styles.zenoAvatarLarge}>Z</div>
              <div>
                <div className={styles.zenoNameLarge}>Zeno</div>
                <div className={styles.zenoTagline}>Revenue Intelligence Operator</div>
              </div>
            </div>
            <div className={styles.zenoLiveStatus}>
              <span className={styles.statusDot} />
              <span className={styles.statusText}>{STATUS_CYCLE[statusIdx]}</span>
            </div>

            {/* Real metrics strip */}
            {stats && (
              <div className={styles.metricsStrip}>
                <div className={styles.metric}>
                  <span className={styles.metricVal}>{stats.total_sessions}</span>
                  <span className={styles.metricLbl}>Sessions</span>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <span className={styles.metricVal}>{stats.cvr_pct}%</span>
                  <span className={styles.metricLbl}>CVR</span>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <span className={styles.metricVal}>{stats.today.actions_taken}</span>
                  <span className={styles.metricLbl}>Actions Today</span>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <span className={styles.metricVal}>${stats.revenue_attributed}</span>
                  <span className={styles.metricLbl}>Revenue Attr.</span>
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className={styles.loadingBlock}>
              <div className={styles.loadSpinner} />
              <span>Zeno is loading store data…</span>
            </div>
          )}

          {/* ── Decision Cards (proactive insights) ── */}
          {!loading && cards.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>🧠 Zeno's Current Assessment</div>
              <div className={styles.cardGrid}>
                {cards.map((c, i) => (
                  <div key={i} className={`${styles.decisionCard} ${styles[`card_${c.type}`]}`}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardIcon}>{c.icon}</span>
                      <span className={styles.cardTitle}>{c.title}</span>
                    </div>
                    <p className={styles.cardBody}>{c.body}</p>
                    <div className={styles.cardAction}>
                      <span className={styles.cardActionLabel}>Zeno recommends</span>
                      <span className={styles.cardActionText}>{c.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Decision Feed (real sessions) ── */}
          {stats && stats.sessions.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>⚡ Live Intelligence Terminal</div>
              <div className={styles.decisionFeed} id="zeno-terminal" style={{ scrollBehavior: 'smooth' }}>
                <div className={styles.terminalHeader}>
                  <div className={`${styles.termDot} ${styles.termDotR}`} />
                  <div className={`${styles.termDot} ${styles.termDotY}`} />
                  <div className={`${styles.termDot} ${styles.termDotG}`} />
                  <div className={styles.termTitle}>ZENO_CORE_v3.0_LIVE_FEED</div>
                </div>
                {stats.sessions.slice(0, 15).map((s, i) => {
                  const intentColor = s.intent_level === "high" ? "#10b981" : s.intent_level === "medium" ? "#f59e0b" : "#f43f5e";
                  return (
                    <div key={i} className={`${styles.feedCard} ${s.converted ? styles.feedCardConverted : ""}`}>
                      <div className={styles.feedCardTop}>
                        <span className={styles.feedTimestamp}>[{new Date().toLocaleTimeString()}]</span>
                        <span className={styles.feedIntent} style={{ color: intentColor }}>[{s.intent_level}_INTENT]</span>
                        <span className={styles.feedAction}>{s.offer_type ?? "NIL_ACTION"}</span>
                        {s.converted && <span className={styles.feedConverted}>SYS_CONVERTED</span>}
                        {s.friction_detected && s.friction_detected !== "none" && (
                          <span className={styles.feedFriction}>FRC_{s.friction_detected.toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.feedExplain}>{s.business_explanation}</div>
                      <div className={styles.feedMeta}>
                        <span>SRC:{s.traffic_source}</span>
                        <span>CART:{s.cart_status}</span>
                        <span>DEV:{s.device}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Learning Log Preview ── */}
          {learningLog && learningLog.total > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                🧠 Zeno Memory — {learningLog.total} Rules Learned
                {learningLog.total_confidence_gain > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                    +{learningLog.total_confidence_gain}% total confidence gained
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {learningLog.entries.slice(0, 4).map((e, i) => (
                  <div key={e.id || i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'capitalize' }}>
                        {e.error_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{e.phase}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#a5b4fc', background: 'rgba(99,102,241,0.06)', borderLeft: '2px solid #6366f1', padding: '6px 10px', borderRadius: '0 6px 6px 0', lineHeight: 1.5 }}>
                      {e.correction_rule}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <a href="/zeno/learning-log" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
                  View Full Learning Log ({learningLog.total} entries) →
                </a>
              </div>
            </div>
          )}

          {/* ── Full-width chat ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>💬 Talk to Zeno</div>
            <div className={styles.chatNote}>
              Zeno has full access to your store data. Ask anything about revenue, behavior, or what to do next.
            </div>
          </div>

        </div>
      </main>

      {/* Zeno floating chat (with full stats context) */}
      {stats && <ZenoChat context={stats as unknown as Record<string, unknown>} />}
      {!stats && !loading && <ZenoChat context={{}} />}
    </div>
  );
}
