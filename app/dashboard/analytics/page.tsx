"use client";

import { useEffect, useState } from "react";
import type { StatsData } from "./types";
import KPICard from "./components/KPICard";
import ConversionsChart from "./components/ConversionsChart";
import IntentPieChart from "./components/IntentPieChart";
import FrictionBarChart from "./components/FrictionBarChart";
import InsightsSection from "./components/InsightsSection";
import TopActionCard from "./components/TopActionCard";
import SessionsTable from "./components/SessionsTable";
import { FullDashboardSkeleton } from "./components/Skeletons";

function fmt$(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/convert/stats", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Request timed out. Is the database running?");
      } else {
        setError("Failed to load analytics data.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-dark-950">
      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[rgba(5,5,8,0.8)] backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-lg font-bold tracking-tight text-white hover:opacity-80 transition-opacity"
            >
              NOLI<span className="text-indigo-400">X</span>
            </a>
            <div className="w-px h-6 bg-white/10" />
            <span className="text-sm font-medium text-slate-400">
              Analytics
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all"
            >
              Dashboard
            </a>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all disabled:opacity-40"
              id="refresh-analytics-btn"
            >
              🔄 Refresh
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* ── Page Header ── */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
            Analytics{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Overview
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            Real-time conversion intelligence · auto-refreshes every 60s
          </p>
        </div>

        {/* ── Loading State ── */}
        {loading && !stats && <FullDashboardSkeleton />}

        {/* ── Error State ── */}
        {!loading && error && !stats && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] backdrop-blur-xl p-12 text-center">
            <span className="text-4xl mb-4 block">⚠️</span>
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <button
              onClick={fetchStats}
              className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && stats && stats.total_sessions === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-16 text-center">
            <span className="text-5xl mb-4 block">📊</span>
            <h2 className="text-xl font-semibold text-white mb-2">
              No Data Yet
            </h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Run your first analysis from the{" "}
              <a href="/" className="text-indigo-400 hover:text-indigo-300">
                Landing Page
              </a>{" "}
              to see conversion data here.
            </p>
          </div>
        )}

        {/* ── Dashboard Content ── */}
        {stats && stats.total_sessions > 0 && (
          <div className="space-y-8">
            {/* ── KPI Cards ── */}
            <section id="kpi-section">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KPICard
                  icon="👥"
                  label="Total Sessions"
                  value={stats.total_sessions.toLocaleString()}
                  color="#6366f1"
                  trend="+12%"
                  trendUp
                  delay={0}
                />
                <KPICard
                  icon="📈"
                  label="Conversion Rate"
                  value={`${stats.cvr_pct}%`}
                  color="#10b981"
                  trend="+3.2%"
                  trendUp
                  delay={60}
                />
                <KPICard
                  icon="💰"
                  label="Revenue Attributed"
                  value={fmt$(stats.revenue_attributed)}
                  color="#f59e0b"
                  trend="+18%"
                  trendUp
                  delay={120}
                />
                <KPICard
                  icon="🎯"
                  label="Offer Rate"
                  value={`${stats.offer_rate_pct}%`}
                  color="#a855f7"
                  delay={180}
                />
                <KPICard
                  icon="🛡️"
                  label="Discounts Saved"
                  value={`${stats.discount_saved_pct}%`}
                  color="#22d3ee"
                  trend="+5%"
                  trendUp
                  delay={240}
                />
                <KPICard
                  icon="⚡"
                  label="High Intent"
                  value={stats.high_intent_sessions.toLocaleString()}
                  color="#ec4899"
                  delay={300}
                />
              </div>
            </section>

            {/* ── Charts Section ── */}
            <section id="charts-section">
              {/* Full-width conversions chart */}
              <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-6 mb-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white">
                    Conversions Over Time
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sessions and conversions by date
                  </p>
                </div>
                <ConversionsChart sessions={stats.sessions} />
              </div>

              {/* Two-column charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white">
                      Intent Distribution
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visitor intent levels breakdown
                    </p>
                  </div>
                  <IntentPieChart data={stats.intent_distribution} />
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white">
                      Friction Points
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Where visitors get stuck
                    </p>
                  </div>
                  <FrictionBarChart data={stats.friction_distribution} />
                </div>
              </div>
            </section>

            {/* ── Insights + Top Action ── */}
            <section id="insights-section">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Insights take 2/3 */}
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-lg font-semibold text-white">
                      🧠 AI Insights
                    </h2>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 bg-emerald-400/[0.08] px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <InsightsSection insights={stats.insights} />
                </div>

                {/* Top Action takes 1/3 */}
                <div>
                  <h2 className="text-lg font-semibold text-white mb-5">
                    🏆 Top Action
                  </h2>
                  <TopActionCard
                    action={stats.top_action}
                    cvr={stats.top_action_cvr}
                    liftEst={stats.revenue_lift_est}
                  />
                </div>
              </div>
            </section>

            {/* ── Sessions Table ── */}
            <section id="sessions-section">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    📜 Recent Sessions
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last {stats.sessions.length} visitor interactions
                  </p>
                </div>
                <span className="text-xs text-slate-500 bg-white/[0.04] px-3 py-1.5 rounded-full">
                  {stats.sessions.length} sessions
                </span>
              </div>
              <SessionsTable sessions={stats.sessions} />
            </section>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            NOLI<span className="text-indigo-400/50">X</span> Analytics
            Dashboard
          </span>
          <span className="text-xs text-slate-600">
            Powered by AI · Real-time
          </span>
        </div>
      </footer>
    </div>
  );
}
