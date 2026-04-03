"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import ZenoChat from "@/app/components/ZenoChat";

// ─────────────────────────────────── Types ────────────────────────────────────
type TodaySummary = { analyzed: number; actions_taken: number; conversions: number; revenue: number; discounts_avoided: number };
type Session = {
  id: string; session_id: string; ab_variant: string; created_at: string;
  intent_level: string; intent_score: number; friction_detected: string | null;
  show_popup: boolean; offer_type: string | null; action_taken: string | null;
  converted: boolean; order_value: number | null; discount_avoided: boolean;
  business_explanation: string; traffic_source: string; cart_status: string; device: string;
};
type Stats = {
  total_sessions: number; high_intent_sessions: number; popups_shown: number;
  total_conversions: number; cvr_pct: number; offer_rate_pct: number;
  revenue_attributed: number; revenue_lift_est: string;
  discount_avoided_count: number; discount_saved_pct: number;
  today: TodaySummary; top_action: string | null; top_action_cvr: number;
  intent_distribution: { intent_level: string; count: string }[];
  friction_distribution: { friction_detected: string; count: string }[];
  ab_results: { variant: string; offer_type: string; impressions: number; conversions: number }[];
  insights: string[];
  sessions: Session[];
};

// ─────────────────────────────── Helpers ─────────────────────────────────────
const INTENT_COLOR: Record<string, string> = { high: "#10b981", medium: "#f59e0b", low: "#f43f5e" };
const ACTION_LABEL: Record<string, string> = {
  do_nothing: "✋ Wait", urgency: "⏰ Urgency", popup_info: "💡 Info",
  discount_5: "🎁 5% Off", discount_10: "💰 10% Off", discount_15: "🔥 15% Off",
  free_shipping: "🚚 Free Ship", bundle: "🎁 Bundle",
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt$(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : n > 0 ? `$${n.toFixed(0)}` : "$0";
}

// ─────────────────────────────── Component ───────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "sessions" | "ab">("overview");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null); // null on server to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s max
      const res = await fetch("/api/convert/stats", { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setStats(await res.json());
      } else {
        setError("Failed to load data — " + res.status);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Request timed out. Check that Docker (PostgreSQL) is running.");
      } else {
        setError("Could not connect to API.");
      }
    } finally {
      setLoading(false);
      setLastRefresh(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }

  useEffect(() => {
    setMounted(true);
    load();
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [mounted]);

  const exportCSV = () => { window.location.href = "/api/convert/sessions?limit=200&format=csv"; };

  const abGrouped = (stats?.ab_results ?? []).reduce((acc, r) => {
    if (!acc[r.variant]) acc[r.variant] = { impressions: 0, conversions: 0 };
    acc[r.variant].impressions += r.impressions; acc[r.variant].conversions += r.conversions;
    return acc;
  }, {} as Record<string, { impressions: number; conversions: number }>);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <a href="/" className={styles.logo}><span className={styles.logoIcon}></span> NOLI<span>X</span></a>
            <a href="/zeno" className={styles.zenoNavLink}>🧠 Zeno</a>
            <nav className={styles.nav}>
              {(["overview","sessions","ab"] as const).map(t => (
                <button key={t} className={`${styles.navBtn} ${tab===t ? styles.navActive : ""}`}
                  onClick={() => setTab(t)}>
                  { t === "overview" ? "📊 Overview" : t === "sessions" ? "📜 History" : "⚗️ A/B Test" }
                </button>
              ))}
            </nav>
            <div className={styles.headerRight}>
              {lastRefresh && <span className={styles.refreshInfo}>Updated {lastRefresh}</span>}
              <button id="refresh-btn" className={styles.btnRefresh} onClick={load}>🔄</button>
              <button id="export-btn" className={styles.btnExport} onClick={exportCSV}>⬇️ Export</button>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {loading && !stats && <div className={styles.loadingState}><div className={styles.loadSpinner} /><p>Loading…</p></div>}

          {!loading && !stats && (
            <div className={styles.emptyState}>
              <span>📊</span>
              <h2>No Data Yet</h2>
              <p>Open the <a href="/">Landing Page Demo</a> and run your first analysis to see revenue data here.</p>
            </div>
          )}

          {stats && tab === "overview" && (
            <>
              {/* Daily Summary Card */}
              <div className={styles.dailySummary}>
                <div className={styles.dailyTitle}>⚡ What we did for you today</div>
                <div className={styles.dailyGrid}>
                  <DailyStat icon="👥" value={stats.today.analyzed} label="Analyzed" />
                  <DailyStat icon="🎯" value={stats.today.actions_taken} label="Actions Taken" />
                  <DailyStat icon="✅" value={stats.today.conversions} label="NOLIed" color="#10b981" />
                  <DailyStat icon="💰" value={fmt$(stats.today.revenue)} label="Revenue" color="#ff003c" />
                  <DailyStat icon="🛡️" value={stats.today.discounts_avoided} label="Discounts Saved" color="#f59e0b" />
                </div>
              </div>

              {/* Core Stats Row */}
              <div className={styles.statsGrid}>
                <StatCard icon="👥" label="Total Sessions"   value={stats.total_sessions} />
                <StatCard icon="⚡" label="High Intent"      value={stats.high_intent_sessions} color="#f59e0b" />
                <StatCard icon="🎯" label="Offers Shown"     value={stats.popups_shown} color="#ff003c" />
                <StatCard icon="✅" label="Conversions"      value={stats.total_conversions} color="#10b981" />
                <StatCard icon="📈" label="CVR %"            value={`${stats.cvr_pct}%`} color="#10b981" />
                <StatCard icon="💰" label="Revenue Attr."    value={fmt$(stats.revenue_attributed)} color="#ff003c" />
              </div>

              {/* Discount Protection + Top Action */}
              <div className={styles.twoCol}>
                <div className={styles.discountCard}>
                  <div className={styles.discountIcon}>🛡️</div>
                  <div className={styles.discountNum}>{stats.discount_saved_pct}%</div>
                  <div className={styles.discountLabel}>of buyers converted<br/>WITHOUT a discount</div>
                  <div className={styles.discountSub}>
                    {stats.discount_avoided_count} conversions at full margin —
                    system avoided unnecessary discounts {stats.discount_avoided_count} times.
                  </div>
                </div>
                <div className={styles.topActionCard}>
                  <div className={styles.topActionLabel}>🏆 Best Performing Action</div>
                  <div className={styles.topActionName}>{ACTION_LABEL[stats.top_action ?? ""] ?? stats.top_action ?? "—"}</div>
                  <div className={styles.topActionCvr}>CVR: <strong>{stats.top_action_cvr}%</strong></div>
                  <div className={styles.revLiftBadge}>Est. Revenue Lift: {stats.revenue_lift_est}</div>
                </div>
              </div>

              {/* Insights */}
              {stats.insights.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>🧠 Zeno&apos;s Assessment</div>
                  <div className={styles.insightsList}>
                    {stats.insights.map((ins, i) => (
                      <div key={i} className={styles.insightItem}>
                        <span className={styles.insightDot} />
                        {ins}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Intent Distribution */}
              <div className={styles.sectionTitle}>🎯 Intent Distribution</div>
              <div className={styles.intentDist}>
                {stats.intent_distribution.map(d => {
                  const total = stats.intent_distribution.reduce((s, x) => s + Number(x.count), 0);
                  const pct = total > 0 ? Math.round((Number(d.count) / total) * 100) : 0;
                  return (
                    <div key={d.intent_level} className={styles.intentBar}>
                      <div className={styles.intentBarLabel}>
                        <span style={{ color: INTENT_COLOR[d.intent_level], fontWeight: 700, textTransform: "capitalize" }}>{d.intent_level}</span>
                        <span className={styles.dimText}>{d.count} visitors</span>
                      </div>
                      <div className={styles.intentBarTrack}><div className={styles.intentBarFill} style={{ width: `${pct}%`, background: INTENT_COLOR[d.intent_level] }} /></div>
                      <span className={styles.intentBarPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {stats && tab === "sessions" && (
            <>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>📜 Decision History</div>
                <span className={styles.sectionCount}>{stats.sessions.length} sessions</span>
              </div>
              {stats.sessions.length === 0 ? (
                <div className={styles.emptyTable}>No sessions yet.</div>
              ) : (
                <div className={styles.sessionList}>
                  {stats.sessions.map(s => (
                    <div key={s.id} className={`${styles.sessionCard} ${s.converted ? styles.sessionNOLIed : ""}`}>
                      <div className={styles.sessionTop}>
                        <span className={styles.intentPill} style={{ color: INTENT_COLOR[s.intent_level], borderColor: INTENT_COLOR[s.intent_level]+"40", background: INTENT_COLOR[s.intent_level]+"12" }}>
                          {s.intent_level} · {s.intent_score}
                        </span>
                        <span className={styles.actionPill}>{ACTION_LABEL[s.action_taken ?? s.offer_type ?? ""] ?? "—"}</span>
                        {s.converted && <span className={styles.convBadge}>✅ NOLIed{s.order_value ? ` · $${s.order_value}` : ""}</span>}
                        {s.discount_avoided && s.converted && <span className={styles.savedBadge}>🛡️ Full margin</span>}
                        <span className={styles.sessionTime}>{timeAgo(s.created_at)}</span>
                      </div>
                      <div className={styles.sessionExplain}>{s.business_explanation}</div>
                      <div className={styles.sessionMeta}>
                        <span>{s.traffic_source.replace("_"," ")}</span>·<span>{s.cart_status.replace("_"," ")}</span>·<span>{s.device}</span>
                        {s.friction_detected && s.friction_detected !== "none" && <span className={styles.frictionTag}>⚠️ {s.friction_detected.replace("_"," ")}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {stats && tab === "ab" && (
            <>
              <div className={styles.sectionTitle}>⚗️ A/B Test Results</div>
              <div className={styles.abGrid}>
                {(["A","B"] as const).map(v => {
                  const d = abGrouped[v] ?? { impressions: 0, conversions: 0 };
                  const cvr = d.impressions > 0 ? +((d.conversions / d.impressions) * 100).toFixed(1) : 0;
                  const isWinner = v === (
                    (abGrouped["A"]?.conversions ?? 0) >= (abGrouped["B"]?.conversions ?? 0) ? "A" : "B"
                  ) && (d.conversions > 0);
                  return (
                    <div key={v} className={`${styles.abCard} ${isWinner ? styles.abWinner : ""}`}>
                      <div className={styles.abHeader}>
                        <span className={styles.abVariant}>Variant {v}</span>
                        {isWinner && <span className={styles.abWinBadge}>🏆 Winner</span>}
                      </div>
                      <div className={styles.abStats}>
                        <div><div className={styles.abVal}>{d.impressions}</div><div className={styles.abLbl}>Shown</div></div>
                        <div><div className={styles.abVal}>{d.conversions}</div><div className={styles.abLbl}>NOLIed</div></div>
                        <div><div className={`${styles.abVal} ${styles.abCvr}`}>{cvr}%</div><div className={styles.abLbl}>CVR</div></div>
                      </div>
                      <div className={styles.abNote}>
                        {v === "B" ? "Emotional / Urgent copy" : "Rational / Direct copy"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {stats && <ZenoChat context={stats as unknown as Record<string, unknown>} />}
      {!stats && !loading && <ZenoChat context={{}} />}
    </div>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statVal} style={color ? { color } : {}}>{value}</div>
      <div className={styles.statLbl}>{label}</div>
    </div>
  );
}

function DailyStat({ icon, value, label, color }: { icon: string; value: string | number; label: string; color?: string }) {
  return (
    <div className={styles.dailyStat}>
      <span className={styles.dailyIcon}>{icon}</span>
      <span className={styles.dailyVal} style={color ? { color } : {}}>{value}</span>
      <span className={styles.dailyLbl}>{label}</span>
    </div>
  );
}
