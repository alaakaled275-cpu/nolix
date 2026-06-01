"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ActivationFirstResult from "@/app/components/ActivationFirstResult";

export default function OpsPulseDashboard() {
  const [currentPage, setCurrentPage] = useState("admin");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [showReadyDashboard, setShowReadyDashboard] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const onboardingRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem("nolix_onboarding_complete");
    if (completed) {
      setShowReadyDashboard(true);
      const saved = localStorage.getItem("opspulse-theme");
      if (saved === "dark") setTheme("dark");
      return;
    }
    // Load onboarding HTML
    fetch('/onboarding.html')
      .then(res => res.text())
      .then(html => {
        if (!onboardingRef.current) return;
        // Extract Google Fonts link from head and add to document head
        const fontMatch = html.match(/<link[^>]*href="https:\/\/fonts\.googleapis\.com[^>]*>/i);
        if (fontMatch) {
          const existing = document.querySelector('link[href*="fonts.googleapis.com"]');
          if (!existing) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = fontMatch[0].match(/href="([^"]+)"/)?.[1] || '';
            if (link.href) document.head.appendChild(link);
          }
        }
        // Extract style tag content from head and inject into document head
        const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
          const existing = document.querySelector('#onboarding-styles');
          if (!existing) {
            const style = document.createElement('style');
            style.id = 'onboarding-styles';
            style.textContent = styleMatch[1];
            document.head.appendChild(style);
          }
        }
        // Get body content only (strip all boilerplate)
        let bodyContent = html
          .replace(/<!DOCTYPE html>/i, '')
          .replace(/<html[^>]*>/i, '')
          .replace(/<\/html>/i, '')
          .replace(/<head>[\s\S]*?<\/head>/i, '')
          .replace(/<body[^>]*>/i, '')
          .replace(/<\/body>/i, '');
        onboardingRef.current.innerHTML = bodyContent;
        // Re-inject and execute scripts
        const scripts = onboardingRef.current.querySelectorAll('script');
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script');
          newScript.textContent = oldScript.textContent;
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        });
        setOnboardingLoaded(true);
      })
      .catch(err => console.error('Failed to load onboarding:', err));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("opspulse-theme", theme);
  }, [theme]);

  // Listen for onboarding completion
  useEffect(() => {
    if (!onboardingLoaded) return;
    const checkComplete = setInterval(() => {
      if (localStorage.getItem("nolix_onboarding_complete")) {
        setShowReadyDashboard(true);
        clearInterval(checkComplete);
      }
    }, 500);
    return () => clearInterval(checkComplete);
  }, [onboardingLoaded]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }, []);

  const navigate = useCallback((page: string) => {
    setCurrentPage(page);
  }, []);

  const selectMode = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    document.querySelectorAll(".ops-ai-opt").forEach(o => o.classList.remove("selected"));
    el.classList.add("selected");
    const name = el.querySelector(".ops-mode-name")?.textContent || "";
    showToast("Mode changed to: " + name);
  }, [showToast]);

  const updateTargeting = useCallback((v: number) => {
    const valEl = document.getElementById("target-pct-val");
    const cntEl = document.getElementById("target-count");
    if (valEl) valEl.textContent = v + "%";
    if (cntEl) cntEl.textContent = Math.round(0 * v / 100).toLocaleString();
  }, []);

  // If onboarding not complete, show only onboarding HTML (full page)
  if (!showReadyDashboard) {
    return (
      <div style={{ margin: 0, padding: 0 }}>
        <div ref={onboardingRef} />
      </div>
    );
  }

  return (
    <>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>

        {/* HERO - Top bar */}
        <div className="ops-hero-bg">
          <div className="ops-hero-fade" />
          <div className="ops-topbar">
            <div className="ops-logo" onClick={() => navigate("dashboard")}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>NEXOUARA</span>
            </div>

            <div className="ops-nav-icons">
              {[
                { id: "dashboard", icon: <svg key="d" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="5.5" height="5.5" rx="1" /><rect x="7.5" y="1" width="5.5" height="5.5" rx="1" /><rect x="1" y="7.5" width="5.5" height="5.5" rx="1" /><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" /></svg> },
                { id: "intelligence", icon: <svg key="i" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1.5C4.5 1.5 2.5 3.3 2.5 5.5c0 1.3.7 2.5 1.7 3.2L4 11h6l-.2-2.3C10.8 8 11.5 6.8 11.5 5.5 11.5 3.3 9.5 1.5 7 1.5z" /><line x1="5" y1="12.5" x2="9" y2="12.5" /></svg> },
                { id: "visitors", icon: <svg key="v" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="5" cy="5" r="2" /><path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" /><circle cx="10" cy="4" r="1.5" /><path d="M10.5 8.5c1.8.2 3 1.5 3 3" /></svg> },
                { id: "experiments", icon: <svg key="e" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M5 2v5L2 12h10L9 7V2" /><line x1="4" y1="2" x2="10" y2="2" /></svg> },
                { id: "pricing", icon: <svg key="p" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1L1 7l6 6 6-6z" /><circle cx="9.5" cy="4.5" r="1" /></svg> },
                { id: "alerts", icon: <svg key="a" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1.5C4.8 1.5 3 3.3 3 5.5V8L1.5 9.5v.5h11V10L11 8.5V5.5C11 3.3 9.2 1.5 7 1.5z" /><path d="M5.5 10.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5" /></svg> },
                { id: "reports", icon: <svg key="r" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="1" width="10" height="12" rx="1.5" /><line x1="4.5" y1="4.5" x2="9.5" y2="4.5" /><line x1="4.5" y1="7" x2="9.5" y2="7" /><line x1="4.5" y1="9.5" x2="7" y2="9.5" /></svg> },
                { id: "calibration", icon: <svg key="c" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="2" /><path d="M7 1v1.5M7 11.5V13M13 7h-1.5M2.5 7H1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1M11.2 11.2l-1.1-1.1M3.9 3.9L2.8 2.8" /></svg> },
                { id: "integrations", icon: <svg key="g" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M5.5 8.5a3 3 0 004.2 0l1.5-1.5a3 3 0 000-4.2 3 3 0 00-4.2 0L5.5 4.3" /><path d="M8.5 5.5a3 3 0 00-4.2 0L2.8 7a3 3 0 000 4.2 3 3 0 004.2 0l1.5-1.5" /></svg> },
                { id: "payouts", icon: <svg key="y" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="3" width="12" height="8" rx="1.5" /><line x1="1" y1="6" x2="13" y2="6" /><line x1="3.5" y1="9" x2="5.5" y2="9" /><line x1="7" y1="9" x2="9" y2="9" /></svg> },
                { id: "revshare", icon: <svg key="s" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="5.5" /><line x1="4" y1="10" x2="10" y2="4" /><circle cx="5" cy="5" r="1" fill="currentColor" /><circle cx="9" cy="9" r="1" fill="currentColor" /></svg> },
                { id: "admin", icon: <svg key="x" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1L1 4v6l6 3 6-3V4L7 1z"/><path d="M7 1v12M1 4l6 3 6-3"/></svg> },
              ].map(nav => (
                <button
                  key={nav.id}
                  className={`ops-nav-btn${currentPage === nav.id ? " active" : ""}`}
                  onClick={() => navigate(nav.id)}
                >
                  {nav.icon}
                  {(nav.id === "alerts") && <span className="ops-notif-badge" />}
                </button>
              ))}
            </div>

            <div className="ops-nav-right">
              <button
                className="ops-theme-btn"
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              >
                {theme === "light" ? (
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="2.5" /><line x1="7" y1="1" x2="7" y2="2.5" /><line x1="7" y1="11.5" x2="7" y2="13" /><line x1="1" y1="7" x2="2.5" y2="7" /><line x1="11.5" y1="7" x2="13" y2="7" /></svg>
                ) : (
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="ops-body">
          {/* PAGE: DASHBOARD */}
          <div className={`ops-page${currentPage === "dashboard" ? " active" : ""}`}>
            <DashboardPage showToast={showToast} navigate={navigate} />
          </div>

          {/* PAGE: INTELLIGENCE */}
          <div className={`ops-page${currentPage === "intelligence" ? " active" : ""}`}>
            <IntelligencePage showToast={showToast} navigate={navigate} selectMode={selectMode} updateTargeting={updateTargeting} />
          </div>

          {/* PAGE: VISITORS */}
          <div className={`ops-page${currentPage === "visitors" ? " active" : ""}`}>
            <VisitorsPage showToast={showToast} navigate={navigate} />
          </div>

          {/* PAGE: EXPERIMENTS */}
          <div className={`ops-page${currentPage === "experiments" ? " active" : ""}`}>
            <ExperimentsPage showToast={showToast} />
          </div>

          {/* PAGE: PRICING */}
          <div className={`ops-page${currentPage === "pricing" ? " active" : ""}`}>
            <PricingPage showToast={showToast} />
          </div>

          {/* PAGE: ALERTS */}
          <div className={`ops-page${currentPage === "alerts" ? " active" : ""}`}>
            <AlertsPage showToast={showToast} navigate={navigate} />
          </div>

          {/* PAGE: REPORTS */}
          <div className={`ops-page${currentPage === "reports" ? " active" : ""}`}>
            <ReportsPage showToast={showToast} />
          </div>

          {/* PAGE: CALIBRATION */}
          <div className={`ops-page${currentPage === "calibration" ? " active" : ""}`}>
            <CalibrationPage showToast={showToast} />
          </div>

          {/* PAGE: INTEGRATIONS */}
          <div className={`ops-page${currentPage === "integrations" ? " active" : ""}`}>
            <IntegrationsPage showToast={showToast} />
          </div>

          {/* PAGE: PAYOUTS */}
          <div className={`ops-page${currentPage === "payouts" ? " active" : ""}`}>
            <PayoutsPage showToast={showToast} />
          </div>

          {/* PAGE: REVSHARE */}
          <div className={`ops-page${currentPage === "revshare" ? " active" : ""}`}>
            <RevsharePage showToast={showToast} navigate={navigate} />
          </div>

          {/* PAGE: ADMIN (STORES LIST) */}
          <div className={`ops-page${currentPage === "admin" ? " active" : ""}`}>
            <AdminStoresPage showToast={showToast} />
          </div>
        </div>
      </div>

      {/* TOAST */}
      <div className={`ops-toast${toast ? " show" : ""}`}>{toast}</div>

      <style jsx>{`
        /* Dashboard styles only - onboarding styles are loaded from HTML */
      `}</style>
    </>
  );
}

/* ── PAGE DATA - Ready for real data ── */

/* ── SECTIONS ── */
function DashboardPage({ showToast, navigate }: { showToast: (m: string) => void; navigate: (p: string) => void }) {
  const [storeUrl, setStoreUrl] = useState("");
  const [dashData, setDashData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"real" | "demo">("demo");
  const [analysisResult, setAnalysisResult] = useState<{ loading: boolean; shown: boolean; score: number; visitors: number; conv: number }>({ loading: false, shown: false, score: 0, visitors: 0, conv: 0 });

  // Load dashboard data on mount
  useEffect(() => {
    const store = localStorage.getItem("nolix_store_domain") || "demo.myshopify.com";
    setStoreUrl(store);
    setDataLoading(true);
    fetch(`/api/dashboard-data?store=${encodeURIComponent(store)}`)
      .then(r => r.json())
      .then(d => {
        setDashData(d);
        setDataSource(d._demo ? "demo" : "real");
        setDataLoading(false);
      })
      .catch(() => setDataLoading(false));
  }, []);

  const runAnalysis = useCallback((urlOverride?: string) => {
    const target = (urlOverride || storeUrl).trim();
    if (!target) return;
    setAnalysisResult({ loading: true, shown: true, score: 0, visitors: 0, conv: 0 });
    // Navigate to results page for real analysis
    const domain = target.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    localStorage.setItem("nolix_store_domain", domain);
    window.open(`/results?store=${encodeURIComponent(domain)}`, "_blank");
    setAnalysisResult({ loading: false, shown: false, score: 0, visitors: 0, conv: 0 });
  }, [storeUrl]);

  // Computed metrics from dashData
  const metrics = dashData ? {
    totalSessions: dashData.total_sessions ?? 0,
    highIntent: dashData.high_intent_sessions ?? 0,
    popupsShown: dashData.popups_shown ?? 0,
    conversions: dashData.total_conversions ?? 0,
    cvrPct: dashData.cvr_pct ?? 0,
    revenueAttributed: dashData.revenue_attributed ?? 0,
    revenueLift: dashData.revenue_lift_est ?? "—",
    todayAnalyzed: dashData.today?.analyzed ?? 0,
    todayActions: dashData.today?.actions_taken ?? 0,
    todayConversions: dashData.today?.conversions ?? 0,
    todayRevenue: dashData.today?.revenue ?? 0,
    discountAvoided: dashData.discount_avoided_count ?? 0,
    discountSavedPct: dashData.discount_saved_pct ?? 0,
    intentDistribution: dashData.intent_distribution ?? [],
    frictionDistribution: dashData.friction_distribution ?? [],
    insights: dashData.insights ?? [],
    sessions: dashData.sessions ?? [],
  } : null;

  return (
    <>
      <ActivationFirstResult />
      {/* Quick Analysis Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 16px", background: "var(--surface-hover)", borderRadius: "var(--radius-md)", border: "0.5px solid var(--border)" }}>
        <svg viewBox="0 0 14 14" fill="none" stroke="var(--accent-blue)" strokeWidth="1.3" width="18" height="18"><circle cx="7" cy="7" r="5.5" /><line x1="7" y1="4" x2="7" y2="7" /><line x1="7" y1="10" x2="7" y2="10.5" /></svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Analyze store</span>
        <input type="text" placeholder="yourshop.com" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") runAnalysis(); }} style={{ flex: 1, padding: "6px 12px", fontSize: 12, border: "0.5px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-solid)", color: "var(--text-primary)", outline: "none", minWidth: 180 }} />
        <button className="ops-btn-sm ops-btn-primary" onClick={() => runAnalysis()} style={{ whiteSpace: "nowrap" }}>Analyze →</button>
      </div>
      {/* Data Source Banner */}
      {dataSource === "demo" && dashData && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(245,158,11,0.07)", border: "0.5px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-md)", marginBottom: 12, fontSize: 11, color: "#f59e0b" }}>
          <span>⚡</span>
          <span><strong>Demo Mode</strong> — Data seeded for <strong>{dashData.store}</strong>. Install Nolix script to see real data.</span>
          <a href={`/results?store=${encodeURIComponent(dashData.store || "")}`} style={{ marginLeft: "auto", color: "#f59e0b", textDecoration: "underline", cursor: "pointer", fontSize: 11 }}>Run real analysis →</a>
        </div>
      )}

      <div className="ops-live-bar">
        {[
          { bg: "#e8f5e9", c: "#2e7d32", d: "M2 12c0-2.8 2.2-5 5-5s5 2.2 5 5", p: "M7 5a2.5 2.5 0 100-5 2.5 2.5 0 000 5", val: dataLoading ? "…" : (metrics?.todayAnalyzed ?? 0).toLocaleString(), lbl: "Today Analyzed", dot: true },
          { bg: "#fff3e0", c: "#e65100", d: "M7 2L2 12h10L7 2z", val: dataLoading ? "…" : (metrics?.todayActions ?? 0).toLocaleString(), lbl: "Interventions", ext: "M7 6v3M7 10.5h0" },
          { bg: "#e3f2fd", c: "#1565c0", d: "M2,10 5,6 8,8 12,3", val: dataLoading ? "…" : (metrics?.cvrPct ?? 0) + "%", lbl: "Offer CVR" },
          { bg: "#f3e5f5", c: "#6a1b9a", d: "M1.5 1.5h11v11h-11z", val: dataLoading ? "…" : (metrics?.totalSessions ?? 0).toLocaleString(), lbl: "Total Sessions", ext: "M7 4v6M4 7h6" },
        ].map((m, i) => (
          <div key={i} className="ops-live-metric">
            <div className="ops-lm-icon" style={{ background: m.bg }}>
              <svg viewBox="0 0 14 14" fill="none" stroke={m.c} strokeWidth="1.4" width="16" height="16">
                <path d={m.d} /><path d={m.ext || ""} />
                {m.p && <circle cx="7" cy="2.5" r="2.5" />}
              </svg>
            </div>
            <div className="ops-lm-data">
              <div className="ops-lm-val" style={m.c !== "#2e7d32" ? { color: m.c } : undefined}>{m.val}</div>
              <div className="ops-lm-lbl">{m.dot && <span className="ops-live-dot" />}{m.lbl}</div>
            </div>
          </div>
        ))}
        <div className="ops-live-metric" style={{ background: "var(--accent-red-bg)", borderColor: "rgba(224,69,69,0.2)" }}>
          <div className="ops-lm-icon" style={{ background: "rgba(224,69,69,0.1)" }}>
            <svg viewBox="0 0 14 14" fill="none" stroke="var(--accent-red)" strokeWidth="1.4" width="16" height="16"><path d="M7 1.5C4.8 1.5 3 3.3 3 5.5V8L1.5 9.5v.5h11V10L11 8.5V5.5C11 3.3 9.2 1.5 7 1.5z" /><path d="M5.5 10.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5" /></svg>
          </div>
          <div className="ops-lm-data">
            <div className="ops-lm-val" style={{ color: "var(--accent-red)" }}>{metrics?.frictionDistribution?.find((f: any) => f.friction_detected === "stuck_cart")?.count ?? 0}</div>
            <div className="ops-lm-lbl">Cart Abandoned</div>
          </div>
        </div>
      </div>

      {/* Net Incremental Revenue */}
      <div className="ops-card" style={{ padding: "32px 40px", background: "linear-gradient(135deg, var(--surface-solid) 0%, var(--surface-hover) 100%)", border: "1px solid var(--border-md)", borderRadius: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 28 }}>Net Incremental Revenue <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>Generated by ZenoAI</span></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          {[
            { l: "Today", v: dataLoading ? "…" : "+$" + (metrics?.todayRevenue ?? 0).toLocaleString() },
            { l: "Total Revenue", v: dataLoading ? "…" : "+$" + (metrics?.revenueAttributed ?? 0).toLocaleString(), c: "var(--accent-green)" },
            { l: "Revenue Lift", v: dataLoading ? "…" : (metrics?.revenueLift ?? "—") },
            { l: "Total Sessions", v: dataLoading ? "…" : (metrics?.totalSessions ?? 0).toLocaleString() },
            { l: "Analyzed Today", v: dataLoading ? "…" : (metrics?.todayAnalyzed ?? 0).toLocaleString() },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 120, paddingRight: i < 4 ? 24 : 0, borderRight: i < 4 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>{s.l}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: (s as any).c || "var(--text-primary)", fontFamily: "var(--font-display)" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { t: "Analyzed Traffic", v: dataLoading ? "…" : (metrics?.totalSessions ?? 0).toLocaleString(), d: "Total visitors examined", c: "var(--accent-blue)" },
          { t: "Smart Interventions", v: dataLoading ? "…" : (metrics?.popupsShown ?? 0).toLocaleString(), d: "AI actions taken", c: "var(--accent-purple)" },
          { t: "Conversions", v: dataLoading ? "…" : (metrics?.conversions ?? 0).toLocaleString(), d: "Influenced by system", c: "var(--accent-green)" },
          { t: "Discounts Avoided", v: dataLoading ? "…" : (metrics?.discountAvoided ?? 0).toLocaleString(), d: `${metrics?.discountSavedPct ?? 0}% of orders, no discount needed`, c: "var(--accent-yellow)" },
        ].map((k, i) => (
          <div key={i} className="ops-card" style={{ borderTop: `3px solid ${k.c}`, padding: 24, borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>{k.t}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{k.v}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontWeight: 500 }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* Chart & Engine */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 24 }}>
        <div className="ops-card" style={{ display: "flex", flexDirection: "column", padding: 24, borderRadius: 16 }}>
          <div className="ops-section-hdr">
            <div className="ops-section-title">Revenue: AI vs Holdout</div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 600 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-blue)" }} /> AI Managed (80%)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border-md)" }} /> Natural Holdout (20%)</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 220, position: "relative", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", marginTop: 10, marginLeft: 20, marginBottom: 10 }}>
            <div style={{ position: "absolute", left: -25, bottom: -6, fontSize: 9, color: "var(--text-muted)" }}>0</div>
            <div style={{ position: "absolute", left: -25, top: "48%", fontSize: 9, color: "var(--text-muted)" }}>5k</div>
            <div style={{ position: "absolute", left: -25, top: -6, fontSize: 9, color: "var(--text-muted)" }}>10k</div>
            <div style={{ position: "absolute", width: "100%", height: 1, background: "var(--border)", opacity: 0.5, top: "50%" }} />
            <svg style={{ position: "absolute", width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 100">
              <polyline points="0,80 20,75 40,82 60,78 80,85 100,81" fill="none" stroke="var(--accent-blue)" strokeWidth="2" />
              <polyline points="0,88 20,86 40,90 60,87 80,91 100,89" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="2,2" opacity="0.6" />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="ops-card" style={{ flex: 1, padding: 24, borderRadius: 16 }}>
            <div className="ops-section-title" style={{ marginBottom: 16 }}>Visitor Intent Distribution</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, height: "100%" }}>
              <div style={{ position: "relative", width: 90, height: 90, borderRadius: "50%", background: "conic-gradient(var(--border-md) 0% 100%)" }}>
                <div style={{ position: "absolute", top: 18, left: 18, right: 18, bottom: 18, background: "var(--surface-solid)", borderRadius: "50%" }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {[{ l: "High Intent", c: "var(--accent-green)", p: 24 }, { l: "Hesitant", c: "var(--accent-yellow)", p: 31 }, { l: "Browsing", c: "var(--border-md)", p: 45 }].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" }}><span className="ops-dot" style={{ background: item.c }} />{item.l}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{item.p}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ops-card" style={{ flex: 1, padding: 24, borderRadius: 16 }}>
            <div className="ops-section-title" style={{ marginBottom: 16 }}>RTL Confidence Engine</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { l: "Causal Confidence", c: "var(--accent-green)", p: 78 },
                { l: "Data Integrity", c: "var(--accent-blue)", p: 92 },
                { l: "Profit Protection", c: "var(--accent-purple)", p: 85 },
              ].map((bar, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, fontWeight: 700 }}>
                    <span style={{ color: "var(--text-primary)" }}>{bar.l}</span><span style={{ color: bar.c }}>{bar.p}%</span>
                  </div>
                  <div className="ops-prog-bg" style={{ height: 6 }}>
                    <div className="ops-prog-fill" style={{ width: `${bar.p}%`, background: bar.c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Decision Feed */}
      <div className="ops-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16 }}>
        <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-hover)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ops-live-dot" style={{ width: 8, height: 8 }} /> Real-Time Decision Feed
          </div>
          <button className="ops-btn-sm ops-btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => showToast("Feed paused")}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="2" height="10" /><rect x="9" y="2" width="2" height="10" /></svg> Pause
          </button>
        </div>
        <div>
          {/* Real data will be loaded from API - empty for now */}
        </div>
      </div>
    </>
  );
}

function IntelligencePage({ showToast, navigate, selectMode, updateTargeting }: { showToast: (m: string) => void; navigate: (p: string) => void; selectMode: (el: HTMLElement | null) => void; updateTargeting: (v: number) => void }) {
  const [intel, setIntel] = useState({ decisions: 47, autoApproved: 31, pendingReview: 5, accuracy: 94.2, coverage: 62, receivingOffers: 18, totalUsers: 29, acceptanceRate: 24, budgetUsed: 18, budgetSpent: 342, budgetTotal: 1900 });
  const initialActions = [
    { action: "Offer triggered", details: "15% discount → visitor #s7k2" },
    { action: "Offer triggered", details: "10% discount → returning user #m4n9" },
    { action: "Chat initiated", details: "Visitor #p3q1 on page >180s" },
    { action: "Exit popup shown", details: "Exit intent detected on visitor #r2t8" },
    { action: "Auto-approved", details: "20% discount → cart abandoner #v5w3" },
    { action: "Hesitation alert", details: "Score 0.83 → visitor #x9y4" },
    { action: "Offer accepted", details: "Visitor #k1j6 converted with 15% off" },
    { action: "Upsell triggered", details: "Visitor #h8g2 viewed 6+ pages" },
  ];
  const [feed, setFeed] = useState<{ time: string; action: string; details: string }[]>([
    { time: "just now", action: initialActions[0].action, details: initialActions[0].details },
    { time: "12s ago", action: initialActions[1].action, details: initialActions[1].details },
    { time: "27s ago", action: initialActions[2].action, details: initialActions[2].details },
    { time: "41s ago", action: initialActions[3].action, details: initialActions[3].details },
    { time: "58s ago", action: initialActions[4].action, details: initialActions[4].details },
  ]);

  useEffect(() => {
    const iv = setInterval(() => {
      setIntel(s => ({
        decisions: s.decisions + Math.floor(Math.random() * 3),
        autoApproved: s.autoApproved + (Math.random() > 0.6 ? 1 : 0),
        pendingReview: Math.max(0, s.pendingReview + (Math.random() > 0.7 ? 1 : -1)),
        accuracy: +(94.2 + (Math.random() - 0.5) * 0.8).toFixed(1),
        coverage: Math.min(100, s.coverage + (Math.random() > 0.5 ? 1 : -1)),
        receivingOffers: s.receivingOffers + (Math.random() > 0.7 ? 1 : 0),
        totalUsers: s.totalUsers + Math.floor(Math.random() * 2),
        acceptanceRate: Math.min(40, Math.max(10, s.acceptanceRate + (Math.random() > 0.5 ? 1 : -1))),
        budgetUsed: Math.min(100, s.budgetUsed + (Math.random() > 0.8 ? 1 : 0)),
        budgetSpent: s.budgetSpent + Math.floor(Math.random() * 15),
        budgetTotal: 1900,
      }));
      setFeed(prev => {
        const action = initialActions[Math.floor(Math.random() * initialActions.length)];
        const newEntry = { time: "just now", action: action.action, details: action.details };
        return [newEntry, ...prev.slice(0, 19)].map((e, i) => i === 0 ? e : { ...e, time: e.time.replace(/(\d+)(s ago)/, (_, n, u) => (parseInt(n) + 4) + u) });
      });
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="ops-intel-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
      <div className="ops-card">
        <div className="ops-section-hdr">
          <div><div className="ops-section-title">AI Engine Status</div><div className="ops-section-sub">Current operational mode</div></div>
          <span className="ops-badge ops-badge-green"><span className="ops-dot ops-dot-green" />Online</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--surface-hover)", borderRadius: "var(--radius-md)", marginBottom: 12, border: "0.5px solid var(--border)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#1a3010,#2d5016)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.3"><path d="M7 1.5C4.5 1.5 2.5 3.3 2.5 5.5c0 1.3.7 2.5 1.7 3.2L4 11h6l-.2-2.3C10.8 8 11.5 6.8 11.5 5.5 11.5 3.3 9.5 1.5 7 1.5z" /><line x1="5" y1="12.5" x2="9" y2="12.5" /></svg>
          </div>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}>ASSIST Mode</div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>AI suggests, human approves</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[{ l: "Decisions today", v: intel.decisions.toString() }, { l: "Auto-approved", v: intel.autoApproved.toString(), c: "#2e7d32" }, { l: "Pending review", v: intel.pendingReview.toString(), c: "#e65100" }, { l: "Accuracy rate", v: intel.accuracy + "%" }].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
              <span style={{ color: "var(--text-secondary)" }}>{s.l}</span>
              <span style={{ fontWeight: 600, color: s.c || "inherit" }}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ops-card">
        <div className="ops-section-hdr"><div><div className="ops-section-title">Conversion Control</div><div className="ops-section-sub">Real-time targeting</div></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { l: "Targeting Coverage", v: intel.coverage + "%", w: intel.coverage, c: "ops-prog-yellow" },
            { l: "Users Receiving Offers", v: intel.receivingOffers + " / " + intel.totalUsers, w: Math.round(intel.receivingOffers / intel.totalUsers * 100), c: "ops-prog-blue" },
            { l: "Offer Acceptance Rate", v: intel.acceptanceRate + "%", w: intel.acceptanceRate, c: "ops-prog-green" },
            { l: "Budget Used", v: intel.budgetUsed + "%", w: intel.budgetUsed, c: "ops-prog-red" },
          ].map((b, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{b.l}</span><span style={{ fontSize: 12, fontWeight: 600 }}>{b.v}</span></div>
              <div className="ops-prog-bg"><div className={`ops-prog-fill ${b.c}`} style={{ width: `${b.w}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="ops-card">
        <div className="ops-section-hdr"><div className="ops-section-title">Live Decision Feed</div><span style={{ fontSize: 10, color: "var(--text-muted)" }}><span className="ops-live-dot" />Real-time</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
          {feed.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 8px", background: i === 0 ? "var(--surface-hover)" : "transparent", borderRadius: "var(--radius-sm)", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap", minWidth: 40 }}>{entry.time}</span>
              <span style={{ color: "var(--accent-green)", fontWeight: 600, whiteSpace: "nowrap" }}>{entry.action}</span>
              <span style={{ color: "var(--text-secondary)" }}>{entry.details}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ops-card" style={{ gridColumn: "1/-1" }}>
        <div className="ops-section-hdr"><div><div className="ops-section-title">AI Mode Configuration</div><div className="ops-section-sub">Choose how the AI engine operates</div></div><button className="ops-btn-sm ops-btn-yellow" onClick={() => showToast("Mode saved!")}>Save Changes</button></div>
        <div className="ops-ai-grid">
          {[
            { icon: "🔕", name: "OFF", desc: "Only manual rules. Full human control, no AI involvement." },
            { icon: "🤝", name: "ASSIST", desc: "AI suggests actions, human approves before execution.", sel: true },
            { icon: "⚡", name: "AUTO", desc: "AI executes decisions autonomously within set parameters." },
          ].map((m, i) => (
            <div key={i} className={`ops-ai-opt${m.sel ? " selected" : ""}`} onClick={e => selectMode(e.currentTarget)}>
              <div className="ops-mode-icon">{m.icon}</div>
              <div className="ops-mode-name">{m.name}</div>
              <div className="ops-mode-desc">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="ops-card" style={{ gridColumn: "1/2" }}>
        <div className="ops-section-hdr"><div><div className="ops-section-title">Decision Rules</div><div className="ops-section-sub">Conditional logic engine</div></div><button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Rule editor opened")}>+ Add Rule</button></div>
        {[
          { n: "01", t: 'IF hesitation_score > 0.70 → trigger_offer(15%)', s: "Active", sc: "green", tog: true },
          { n: "02", t: 'IF exit_intent == true → show_popup()', s: "Active", sc: "green", tog: true },
          { n: "03", t: 'IF time_on_page > 180s → send_chat()', s: "Active", sc: "green", tog: true },
          { n: "04", t: 'IF cart_value > $0.00 → discount(20%)', s: "Paused", sc: "orange", tog: false },
          { n: "05", t: 'IF returning_user == true → offer(10%)', s: "Active", sc: "green", tog: true },
          { n: "06", t: 'IF scroll_depth < 30% → skip()', s: "Disabled", sc: "gray", tog: false },
          { n: "07", t: 'IF new_visitor AND cart > $0.00 → offer(5%)', s: "Active", sc: "green", tog: true },
          { n: "08", t: 'IF page_views > 5 → upsel_trigger()', s: "Paused", sc: "orange", tog: false },
        ].map((rule, i) => (
          <div key={i} className="ops-rule-item">
            <div className="ops-rule-left"><span className="ops-rule-num">{rule.n}</span><span className="ops-rule-text" dangerouslySetInnerHTML={{ __html: rule.t.replace(/IF/g, '<span class="kw">IF</span>').replace(/→/g, '<span class="kw"> → </span>').replace(/>/g, '<span class="kw">&gt;</span>').replace(/==/g, '<span class="kw"> == </span>').replace(/0\.70/g, '<span class="val">0.70</span>').replace(/\$0\.00/g, '<span class="val">$0.00</span>').replace(/true/g, '<span class="val">true</span>').replace(/30%/g, '<span class="val">30%</span>').replace(/180s/g, '<span class="val">180s</span>').replace(/5/g, '<span class="val">5</span>').replace(/trigger_offer\(15%\)/g, '<span class="act">trigger_offer(15%)</span>').replace(/show_popup\(\)/g, '<span class="act">show_popup()</span>').replace(/send_chat\(\)/g, '<span class="act">send_chat()</span>').replace(/discount\(20%\)/g, '<span class="act">discount(20%)</span>').replace(/offer\(10%\)/g, '<span class="act">offer(10%)</span>').replace(/skip\(\)/g, '<span class="act">skip()</span>').replace(/offer\(5%\)/g, '<span class="act">offer(5%)</span>').replace(/upsel_trigger\(\)/g, '<span class="act">upsel_trigger()</span>') }} /></div>
            <div className="ops-rule-actions" style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span className={`ops-badge ops-badge-${rule.sc}`}>{rule.s}</span>
              <div className={`ops-toggle${rule.tog ? " on" : ""}`} onClick={e => e.currentTarget.classList.toggle("on")} />
            </div>
          </div>
        ))}
      </div>
      <div className="ops-card" style={{ gridColumn: "2/-1" }}>
        <div className="ops-section-hdr"><div><div className="ops-section-title">Conversion Control</div><div className="ops-section-sub">🔥 Core targeting parameters</div></div><button className="ops-btn-sm ops-btn-yellow" onClick={() => showToast("Settings applied!")}>Apply</button></div>
        <div className="ops-cc-grid">
          <div className="ops-cc-item" style={{ gridColumn: "1/-1" }}>
            <div className="ops-cc-lbl">% of Users to Target</div>
            <div className="ops-slider-wrap">
              <div className="ops-slider-hdr"><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>0%</span><span className="ops-slider-val" id="target-pct-val">30%</span><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>100%</span></div>
              <input type="range" min="0" max="100" defaultValue={30} onChange={e => updateTargeting(Number(e.target.value))} />
              <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: 4 }}>Currently targeting <strong style={{ color: "var(--text-primary)" }} id="target-count">{intel.totalUsers}</strong> of {intel.totalUsers} live users</div>
            </div>
          </div>
          {[
            { l: "Min Discount", v: 10, mx: 50, id: "min-disc-val" },
            { l: "Max Discount", v: 25, mx: 50, id: "max-disc-val" },
            { l: "Hesitation Threshold", v: 60, mx: 100, id: "hes-thresh-val", fmt: (v: number) => (v / 100).toFixed(2) },
          ].map((s, i) => (
            <div key={i} className="ops-cc-item">
              <div className="ops-cc-lbl">{s.l}</div>
              <div className="ops-slider-wrap">
                <div className="ops-slider-hdr"><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>0</span><span className="ops-slider-val" id={s.id}>{s.fmt ? s.fmt(s.v) : s.v + "%"}</span><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.mx}</span></div>
                <input type="range" min="0" max={s.mx} defaultValue={s.v} onChange={e => { const el = document.getElementById(s.id); if (el) el.textContent = s.fmt ? s.fmt(Number(e.target.value)) : e.target.value + "%"; }} />
              </div>
            </div>
          ))}
          <div className="ops-cc-item" style={{ gridColumn: "1/-1" }}>
            <div className="ops-cc-lbl">Targeting Conditions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {["High hesitation score", "Exit intent detected", "New visitors only", "Cart abandonment"].map((cond, i) => (
                <div key={i} className="ops-toggle-wrap">
                  <div className={`ops-toggle${i !== 2 ? " on" : ""}`} onClick={e => e.currentTarget.classList.toggle("on")} />
                  <span className="ops-toggle-lbl">{cond}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: "#f8f8f6", borderRadius: "var(--radius-md)", border: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Monthly Discount Budget</span><span className={`ops-badge ${intel.budgetUsed > 50 ? "ops-badge-red" : "ops-badge-yellow"}`}>{intel.budgetUsed}% Used</span></div>
          <div className="ops-prog-bg"><div className="ops-prog-fill ops-prog-red" style={{ width: `${intel.budgetUsed}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}><span>${intel.budgetSpent.toLocaleString()} / ${intel.budgetTotal.toLocaleString()} used</span><button className="ops-btn-sm ops-btn-yellow" onClick={() => showToast("Budget extended!")}>Extend Budget</button></div>
        </div>
      </div>
    </div>
  );
}

function VisitorsPage({ showToast, navigate }: { showToast: (m: string) => void; navigate: (p: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Total Sessions", v: "1,247", b: "Today", bc: "green" },
          { l: "Avg Time on Page", v: "2m 34s", b: "±12s", bc: "yellow" },
          { l: "Avg Scroll Depth", v: "47%", b: "Above avg", bc: "green" },
          { l: "High Hesitation", v: "186", b: "24 flagged", bc: "red", top: "2px solid #ef5350" },
          { l: "Offers Sent", v: "94", b: "12 accepted", bc: "green" },
        ].map((s, i) => (
          <div key={i} className="ops-stat-mini" style={s.top ? { borderTop: s.top } : undefined}>
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div className="ops-stat-mini-val" style={s.l === "High Hesitation" ? { color: "#ef5350" } : undefined}>{s.v}</div>
            <div className="ops-stat-mini-sub">
              <span className={`ops-badge ops-badge-${s.bc}`}>{s.b}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="ops-card">
          <div className="ops-section-hdr"><div className="ops-section-title">Page Performance — Hesitation Map</div><button className="ops-btn-sm ops-btn-outline">Export</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px", gap: 8, padding: "4px 0", borderBottom: "0.5px solid var(--border)" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Page</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Hesitation Distribution</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Avg Score</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sessions</span>
            </div>
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No results</div>
          </div>
        </div>
        <div className="ops-card">
          <div className="ops-section-title" style={{ marginBottom: 12 }}>Behavior Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "Scroll Hesitation", p: 72, c: "ops-prog-purple", lvl: "High", lc: "var(--accent-purple)" },
              { l: "Click Delay", p: 55, c: "ops-prog-yellow", lvl: "Moderate", lc: "var(--accent-orange)" },
              { l: "Mouse Velocity", p: 40, c: "ops-prog-green", lvl: "Normal", lc: "var(--accent-green)" },
              { l: "Exit Intent Rate", p: 38, c: "ops-prog-red", lvl: "38%", lc: "var(--accent-red)" },
              { l: "Form Abandonment", p: 22, c: "ops-prog-yellow", lvl: "22%", lc: "var(--accent-orange)" },
            ].map((b, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{b.l}</span>
                  <span style={{ fontWeight: 600, color: b.lc }}>{b.lvl}</span>
                </div>
                <div className="ops-prog-bg"><div className={`ops-prog-fill ${b.c}`} style={{ width: `${b.p}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ops-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>All Visitors</span>
          <div style={{ flex: 1 }} />
          <div className="ops-search-bar"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" width="12" height="12"><circle cx="6" cy="6" r="4" /><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" /></svg><input type="text" placeholder="Search session..." /></div>
          <select className="ops-sel" style={{ width: "auto", fontSize: 11, padding: "5px 10px" }} onChange={e => showToast("Filtering: " + e.target.value)}>
            <option value="all">All Users</option>
            <option value="high">High Hesitation</option>
            <option value="exit">Exit Intent</option>
            <option value="converted">Converted</option>
            <option value="offer">Received Offer</option>
          </select>
          <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("CSV exported!")}>Export CSV</button>
        </div>
        <div className="ops-visitor-grid" style={{ borderBottom: "0.5px solid var(--border)", cursor: "default" }}>
          <span className="ops-vgh" />
          <span className="ops-vgh">Session ID</span>
          <span className="ops-vgh">Current Page</span>
          <span className="ops-vgh">Time</span>
          <span className="ops-vgh">Scroll</span>
          <span className="ops-vgh">Clicks</span>
          <span className="ops-vgh">Leak Risk</span>
          <span className="ops-vgh">Offer</span>
          <span className="ops-vgh">Action</span>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No results</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Showing 10 of 1,247 sessions</span>
          <div style={{ display: "flex", gap: 4 }}><button className="ops-btn-sm ops-btn-outline">← Prev</button><button className="ops-btn-sm ops-btn-primary">Next →</button></div>
        </div>
      </div>
    </>
  );
}

function ExperimentsPage({ showToast }: { showToast: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/experiments/results")
      .then(res => res.json())
      .then(d => {
        setData(d.variants || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#fff" }}>جلب نتائج التعلم والتجارب...</div>;

  const control = data?.find((v: any) => v.name === "Control") || { shown: 0, conversions: 0, cvr: 0, revenue: 0 };
  const variantA = data?.find((v: any) => v.name !== "Control") || { shown: 0, conversions: 0, cvr: 0, revenue: 0 };

  const totalUsers = (control.shown || 0) + (variantA.shown || 0);
  const bestCvr = Math.max(control.cvr || 0, variantA.cvr || 0);
  const totalRev = (control.revenue || 0) + (variantA.revenue || 0);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Active Tests", v: "1", b: "Running", bc: "green" },
          { l: "Best Conversion", v: bestCvr + "%", b: bestCvr === control.cvr ? "Control Wins" : "Variant Wins", bc: "green" },
          { l: "Total Users Tested", v: totalUsers.toLocaleString(), b: "Live DB", bc: "blue" },
          { l: "Revenue Impact", v: "$" + totalRev.toFixed(2), b: "↑ from tests", bc: "green" },
        ].map((s, i) => (
          <div key={i} className="ops-stat-mini">
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div className="ops-stat-mini-val">{s.v}</div>
            <div className="ops-stat-mini-sub"><span className={`ops-badge ops-badge-${s.bc}`}>{s.b}</span></div>
          </div>
        ))}
      </div>
      <div className="ops-exp-card">
        <div className="ops-exp-hdr">
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>ZenoAI Offer Timing Test</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Testing the impact of immediate vs delayed offers on revenue per user.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ops-badge ops-badge-green"><span className="ops-dot ops-dot-green" />Running</span>
            <button className="ops-btn-sm ops-btn-outline">Details</button>
          </div>
        </div>
        <div className="ops-exp-variants">
          {[
            { lbl: "Variant A — Control", name: "Immediate Offer", cr: control.cvr + "%", crl: "Conversion Rate", win: control.cvr >= variantA.cvr },
            { lbl: "Variant B — AI Test", name: "Hesitation Delayed Offer", cr: variantA.cvr + "%", crl: "Conversion Rate", win: variantA.cvr > control.cvr },
          ].map((v, vi) => (
            <div key={vi} className={`ops-variant-box${v.win ? " winner" : ""}`}>
              {v.win && <div className="ops-winner-badge">🏆 Winner</div>}
              <div className="ops-var-lbl">{v.lbl}</div>
              <div className="ops-var-name">{v.name}</div>
              <div className="ops-var-cr">{v.cr}</div>
              <div className="ops-var-cr-lbl">{v.crl}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ border: "1.5px dashed var(--border-md)", borderRadius: "var(--radius-lg)", padding: 24, textAlign: "center", cursor: "pointer" }} onClick={() => showToast("New Experiment wizard opening...")}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🧪</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Create New Experiment</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>A/B test any variable: popup design, discount %, timing, messaging, targeting</div>
        <button className="ops-btn-sm ops-btn-primary" style={{ margin: "12px auto 0", display: "inline-flex" }}>+ New Experiment</button>
      </div>
    </>
  );
}

function PricingPage({ showToast }: { showToast: (m: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Avg Discount Given", v: "12.4%", b: "This week", bc: "yellow" },
          { l: "Revenue Saved", v: "$894.00", b: "Protected", bc: "green" },
          { l: "Offers Triggered", v: "203", b: "This month", bc: "blue" },
          { l: "Conversion Lift", v: "18.4%", b: "Vs baseline", bc: "green" },
        ].map((s, i) => (
          <div key={i} className="ops-stat-mini" style={i === 0 ? { borderTop: "2px solid #f5c518" } : undefined}>
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div className="ops-stat-mini-val">{s.v}</div>
            <div className="ops-stat-mini-sub"><span className={`ops-badge ops-badge-${s.bc}`}>{s.b}</span></div>
          </div>
        ))}
      </div>
      <div className="ops-pricing-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ops-card">
            <div className="ops-section-hdr"><div><div className="ops-section-title">Dynamic Discount Rules</div><div className="ops-section-sub">Conditional pricing engine</div></div><button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Add rule dialog")}>+ Add Rule</button></div>
            {[
              { icon: "M6 2L1 10h10L6 2z", ic: "#ffebee", sc: "#ef5350", t: "High Hesitation + Exit", c: "score > 0.70 AND exit_intent", disc: "20%", tog: true },
              { icon: "M6 3.5v2.5l2 1.5", ic: "#fff3e0", sc: "#ff9800", t: "Long Session", c: "time_on_page > 180s", disc: "15%", tog: true },
              { icon: "M2 6h8M7 3l3 3-3 3", ic: "#e8f5e9", sc: "#4caf50", t: "Returning User", c: "returning == true", disc: "10%", tog: true },
              { icon: "M1.5 3h9v6h-9z", ic: "#e3f2fd", sc: "#2196f3", t: "High Cart Value", c: "cart_value > $0.00", disc: "12%", tog: false },
              { icon: "M6 4a2 2 0 100-4 2 2 0 000 4", ic: "#f3e5f5", sc: "#9c27b0", t: "New Visitor", c: "new_visitor == true AND cart > $0.00", disc: "5%", tog: true },
              { icon: "M6 6a4.5 4.5 0 100-9 4.5 4.5 0 000 9", ic: "#f0f0ee", sc: "#9a9a96", t: "Default", c: "All other users", disc: "0%", tog: false },
            ].map((rule, i) => (
              <div key={i} className="ops-discount-rule">
                <div className="ops-dr-left">
                  <div className="ops-dr-icon" style={{ background: rule.ic }}>
                    <svg viewBox="0 0 12 12" fill="none" stroke={rule.sc} strokeWidth="1.3" width="12" height="12"><path d={rule.icon} /></svg>
                  </div>
                  <div>
                    <div className="ops-dr-title">{rule.t}</div>
                    <div className="ops-dr-cond">{rule.c}</div>
                  </div>
                </div>
                <div><div className="ops-discount-tag">{rule.disc}<br /><span className="ops-disc-label">Discount</span></div></div>
                <div className={`ops-toggle${rule.tog ? " on" : ""}`} onClick={e => e.currentTarget.classList.toggle("on")} style={{ marginLeft: 8 }} />
              </div>
            ))}
          </div>
          <div className="ops-card">
            <div className="ops-section-title" style={{ marginBottom: 12 }}>Discount Distribution</div>
            {[
              { l: "No Offer (0%)", p: 70, c: "ops-prog-dark" },
              { l: "5% Discount", p: 6, c: "ops-prog-green" },
              { l: "10% Discount", p: 9, c: "ops-prog-green" },
              { l: "12-15% Discount", p: 9, c: "ops-prog-yellow" },
              { l: "20% Discount", p: 6, c: "ops-prog-red" },
            ].map((d, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{d.l}</span><span style={{ fontWeight: 600 }}>{d.p}% of users</span>
                </div>
                <div className="ops-prog-bg"><div className={`ops-prog-fill ${d.c}`} style={{ width: `${d.p}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ops-pricing-sim">
            <div className="ops-sim-title">🎯 Pricing Simulator — Test rules live</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { l: "Hesitation Score", id: "sim-hes", def: 75, max: 100, fmt: (v: number) => (v / 100).toFixed(2) },
                { l: "Cart Value", id: "sim-cart", def: 150, max: 500, fmt: (v: number) => "$" + v },
                { l: "Time on Page (seconds)", id: "sim-time", def: 90, max: 400, fmt: (v: number) => v + "s" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>{s.l}</div>
                  <input type="range" min="0" max={s.max} defaultValue={s.def} style={{ width: "100%" }} onChange={e => { const el = document.getElementById(s.id + "-val"); if (el) el.textContent = s.fmt ? s.fmt(Number(e.target.value)) : e.target.value; }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "white", marginTop: 3 }}><span id={s.id + "-val"}>{s.fmt ? s.fmt(s.def) : s.def}</span></div>
                </div>
              ))}
              {[{ l: "Exit Intent", id: "sim-exit" }, { l: "Returning User", id: "sim-returning", def: true }, { l: "New Visitor", id: "sim-new" }].map((t, i) => (
                <div key={i}>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>{t.l}</div>
                  <div className="ops-toggle-wrap">
                    <div className={`ops-toggle${t.def ? " on" : ""}`} id={t.id} onClick={e => e.currentTarget.classList.toggle("on")} />
                    <span className="ops-toggle-lbl" style={{ color: "rgba(255,255,255,0.6)" }}>{t.def ? "Yes" : "Detected"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ops-sim-result">
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>PRICING DECISION</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f5c518" }}>10% OFF</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Rule match: returning_user = true</div>
            </div>
          </div>
          <div className="ops-card">
            <div className="ops-section-title" style={{ marginBottom: 12 }}>Monthly Revenue Impact</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ textAlign: "center", padding: 12, background: "#f8f8f6", borderRadius: 10, border: "0.5px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Without Engine</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#ef5350" }}>$18,950</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Baseline revenue</div>
              </div>
              <div style={{ textAlign: "center", padding: 12, background: "#e8f5e9", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#2e7d32", marginBottom: 4 }}>With Engine</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#2e7d32" }}>$25,562</div>
                <div style={{ fontSize: 10, color: "#4caf50" }}>+34.9% lift</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AlertsPage({ showToast, navigate }: { showToast: (m: string) => void; navigate: (p: string) => void }) {
  return (
    <>
      <div className="ops-alerts-summary">
        {[
          { l: "Critical", v: "1", c: "#ef5350", cls: "ops-alert-critical" },
          { l: "Warnings", v: "3", c: "#ff9800", cls: "ops-alert-warning" },
          { l: "Informational", v: "5", c: "#2196f3", cls: "ops-alert-info" },
          { l: "Resolved Today", v: "8", c: "#4caf50", cls: "ops-alert-ok" },
        ].map((s, i) => (
          <div key={i} className={`ops-alert-sum-card ${s.cls}`}>
            <div className="ops-alert-sum-num" style={{ color: s.c }}>{s.v}</div>
            <div className="ops-alert-sum-lbl">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="ops-alert-filter-bar" style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { l: "All (9)", v: "all" },
          { l: "🔴 Critical (1)", v: "critical" },
          { l: "🟠 Warnings (3)", v: "warning" },
          { l: "🔵 Info (5)", v: "info" },
          { l: "✅ Resolved", v: "resolved" },
        ].map((f, i) => (
          <div key={i} className={`ops-filter-chip${i === 0 ? " active" : ""}`} onClick={e => {
            document.querySelectorAll(".ops-filter-chip").forEach(c => c.classList.remove("active"));
            e.currentTarget.classList.add("active");
            const items = document.querySelectorAll(".ops-alert-full-item");
            items.forEach(item => {
              const el = item as HTMLElement;
              if (f.v === "all") { el.style.display = ""; return; }
              if (f.v === "critical") el.style.display = el.classList.contains("critical") ? "" : "none";
              else if (f.v === "warning") el.style.display = el.classList.contains("warning") ? "" : "none";
              else if (f.v === "info") el.style.display = el.classList.contains("info") ? "" : "none";
              else if (f.v === "resolved") el.style.display = el.classList.contains("ok") ? "" : "none";
            });
          }}>{f.l}</div>
        ))}
        <div style={{ flex: 1 }} />
        <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("All alerts marked as read")}>Mark All Read</button>
        <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("Alert config opened")}>Configure Alerts</button>
      </div>
      <div id="alerts-list">
        {/* Real alerts will be loaded from API */}
      </div>
    </>
  );
}

function ReportsPage({ showToast }: { showToast: (m: string) => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Analytics & Reports</div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Performance overview · April 2026</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="ops-report-tabs">
            {["Daily", "Weekly", "Monthly"].map((t, i) => (
              <div key={i} className={`ops-report-tab${i === 0 ? " active" : ""}`} onClick={e => {
                document.querySelectorAll(".ops-report-tab").forEach(t => t.classList.remove("active"));
                e.currentTarget.classList.add("active");
                showToast("View: " + t);
              }}>{t}</div>
            ))}
          </div>
          <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("PDF exporting...")}>Export PDF</button>
          <button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Generating full report...")}>Generate Report</button>
        </div>
      </div>
      <div className="ops-kpi-row">
        {[
          { l: "Total Revenue", v: "$18,950", b: "↑ 34.9%", bc: "green", t: "2px solid #4caf50" },
          { l: "Conversion Rate", v: "2.5%", b: "↑ 2.1%", bc: "blue", t: "2px solid #2196f3" },
          { l: "Total Sessions", v: "1,247", b: "↑ 12%", bc: "yellow", t: "2px solid #f5c518" },
          { l: "AI Decisions", v: "47", b: "94.2% accurate", bc: "purple", t: "2px solid #9c27b0" },
        ].map((s, i) => (
          <div key={i} className="ops-stat-mini" style={{ borderTop: s.t }}>
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div className="ops-stat-mini-val">{s.v}</div>
            <div className="ops-stat-mini-sub"><span className={`ops-badge ops-badge-${s.bc}`}>{s.b}</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="ops-chart-area">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Revenue vs Conversion</div><div style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: 2 }}>Daily performance — April 2026</div></div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="ops-legend-item"><div className="ops-legend-dot profit" />Revenue</div>
              <div className="ops-legend-item"><div className="ops-legend-dot loss" />Conversion</div>
            </div>
          </div>
          <div className="ops-chart-ph">
            {[45, 30, 60, 40, 50, 35, 75, 55, 65, 42, 90, 68, 80, 60].map((h, i) => (
              <div key={i} className="ops-ch-bar" style={{
                background: i % 2 === 0 ? "#8bc34a" : "var(--text-primary)",
                height: `${h}%`,
                opacity: i % 2 === 1 ? 0.6 : undefined,
              }} />
            ))}
          </div>
        </div>
        <div className="ops-chart-area">
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>AI Performance</div>
          <div style={{ fontSize: "10.5px", color: "var(--text-secondary)" }}>Decision accuracy breakdown</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "Correct Decisions", v: "94.2%", c: "#2e7d32", p: 94, cl: "ops-prog-green" },
              { l: "Offer Acceptance", v: "24.3%", c: "#1565c0", p: 24.3, cl: "ops-prog-blue" },
              { l: "False Positives", v: "5.8%", c: "#e65100", p: 5.8, cl: "ops-prog-red" },
              { l: "Revenue Lift", v: "34.9%", c: "#2e7d32", p: 34.9, cl: "ops-prog-green" },
            ].map((b, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{b.l}</span>
                  <span style={{ fontWeight: 600, color: b.c }}>{b.v}</span>
                </div>
                <div className="ops-prog-bg"><div className={`ops-prog-fill ${b.cl}`} style={{ width: `${b.p}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CalibrationPage({ showToast }: { showToast: (m: string) => void }) {
  return (
    <div className="ops-calib-grid">
      <div className="ops-card">
        <div className="ops-section-hdr"><div><div className="ops-section-title">Hesitation Scoring Weights</div><div className="ops-section-sub">Tune each signal's contribution</div></div><button className="ops-btn-sm ops-btn-yellow" onClick={() => showToast("Weights saved!")}>Save Weights</button></div>
        {[
          { l: "Scroll Depth", id: "wd-scroll", v: 25 },
          { l: "Time on Page", id: "wd-time", v: 30 },
          { l: "Click Hesitation", id: "wd-click", v: 20 },
          { l: "Mouse Movement", id: "wd-mouse", v: 10 },
          { l: "Exit Intent Signal", id: "wd-exit", v: 35 },
          { l: "Page Return Rate", id: "wd-return", v: 15 },
          { l: "Form Abandonment", id: "wd-form", v: 18 },
          { l: "Back Button Use", id: "wd-back", v: 12 },
        ].map((w, i) => (
          <div key={i} className="ops-weight-item">
            <span className="ops-weight-lbl">{w.l}</span>
            <div className="ops-weight-slider">
              <input type="range" min="0" max="100" defaultValue={w.v} onChange={e => {
                const el = document.getElementById(w.id);
                if (el) {
                  el.textContent = e.target.value;
                  const ids = ["wd-scroll", "wd-time", "wd-click", "wd-mouse", "wd-exit", "wd-return", "wd-form", "wd-back"];
                  let total = ids.reduce((s, id) => s + parseInt(document.getElementById(id)?.textContent || "0"), 0);
                  const tw = document.getElementById("total-weight");
                  if (tw) tw.textContent = String(total);
                }
              }} />
            </div>
            <span className="ops-weight-val" id={w.id}>{w.v}</span>
          </div>
        ))}
        <div style={{ padding: 10, background: "#fff8e1", border: "0.5px solid #ffe082", borderRadius: 8, marginTop: 8 }}>
          <div style={{ fontSize: "10.5px", color: "#f57f17", fontWeight: 500 }}>⚠️ Weight Total: <span id="total-weight">165</span> — Values are automatically normalized to sum to 1.0</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ops-card">
          <div className="ops-section-hdr"><div><div className="ops-section-title">Hesitation Formula</div><div className="ops-section-sub">Current scoring algorithm</div></div><button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("Reset to defaults")}>Reset Default</button></div>
          <div className="ops-formula-box">
            <span className="op">hesitation_score</span> = (<br />
            &nbsp;&nbsp;<span className="var">scroll_depth</span> × <span className="num">0.25</span> +<br />
            &nbsp;&nbsp;<span className="var">time_on_page_norm</span> × <span className="num">0.30</span> +<br />
            &nbsp;&nbsp;<span className="var">click_hesitation</span> × <span className="num">0.20</span> +<br />
            &nbsp;&nbsp;<span className="var">mouse_velocity</span> × <span className="num">0.10</span> +<br />
            &nbsp;&nbsp;<span className="var">exit_intent_signal</span> × <span className="num">0.35</span> +<br />
            &nbsp;&nbsp;<span className="var">page_return_rate</span> × <span className="num">0.15</span> +<br />
            &nbsp;&nbsp;<span className="var">form_abandonment</span> × <span className="num">0.18</span> +<br />
            &nbsp;&nbsp;<span className="var">back_button_rate</span> × <span className="num">0.12</span><br />
            ) / <span className="num">1.65</span> <span style={{ color: "#6272a4" }}> ← auto-normalized</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("Formula validation passed")}>Validate</button>
            <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast("Simulation running...")}>Simulate on Data</button>
            <button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Formula applied live!")}>Apply Formula</button>
          </div>
        </div>
        <div className="ops-card ops-calib-preview" style={{ padding: 18 }}>
          <div className="ops-section-title" style={{ marginBottom: 4 }}>Live Score Preview</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Adjust inputs to preview your Revenue Leak Risk score</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Scroll Depth", id: "cs-scroll", v: 35, max: 100, fmt: (v: number) => v + "%" },
              { l: "Time on Page", id: "cs-time", v: 120, max: 300, fmt: (v: number) => v + "s" },
            ].map((cs, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 120 }}>{cs.l}</span>
                <input type="range" min="0" max={cs.max} defaultValue={cs.v} style={{ flex: 1 }} onChange={e => { const el = document.getElementById(cs.id + "-val"); if (el) el.textContent = cs.fmt(Number(e.target.value)); }} />
                <span style={{ fontSize: 11, fontWeight: 600, width: 30 }} id={cs.id + "-val"}>{cs.fmt(cs.v)}</span>
              </div>
            ))}
            {[
              { l: "Exit Intent", id: "cs-exit" },
              { l: "Form Abandon", id: "cs-form" },
            ].map((t, i) => (
              <div key={i + 2} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 120 }}>{t.l}</span>
                <div className="ops-toggle" id={t.id} onClick={e => e.currentTarget.classList.toggle("on")} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{i === 0 ? "Detected" : "Yes"}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-md)", marginTop: 12 }}>
            <div className="ops-score-circle ops-sc-med" id="score-circle">
              <span id="score-display">0.54</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }} id="score-label">Moderate Hesitation</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }} id="score-action">→ No offer triggered (below 0.60 threshold)</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }} id="score-matching-rule">No rule matched yet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPage({ showToast }: { showToast: (m: string) => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Integrations</div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Connect OpsPulse to your tools and platforms</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="ops-search-bar">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" width="12" height="12"><circle cx="6" cy="6" r="4" /><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" /></svg>
            <input type="text" placeholder="Search integrations..." />
          </div>
          <button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Request submitted!")}>+ Request Integration</button>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Connected (3)</div>
      <div className="ops-integrations-grid" style={{ marginBottom: 16 }}>
        {[
          { logoBg: "#96bf48", logo: "🛍️", name: "Shopify", cat: "E-commerce", status: "Connected", sBadge: "green" },
          { logoBg: "#ffdd57", logo: "📧", name: "Klaviyo", cat: "Email Marketing", status: "Connected", sBadge: "green" },
          { logoBg: "#6772e5", logo: "🔗", name: "Webhooks", cat: "Custom Integration", status: "Active", sBadge: "green" },
        ].map((int, i) => (
          <div key={i} className="ops-int-card">
            <div className="ops-int-hdr">
              <div className="ops-int-logo" style={{ background: int.logoBg, color: int.logoBg === "#ffdd57" ? "#1a1a1a" : undefined }}>{int.logo}</div>
              <div>
                <div className="ops-int-name">{int.name}</div>
                <div className="ops-int-cat">{int.cat}</div>
              </div>
              <span className={`ops-badge ops-badge-${int.sBadge}`} style={{ marginLeft: "auto" }}><span className="ops-dot ops-dot-green" />{int.status}</span>
            </div>
            <div className="ops-int-desc">
              {["Sync product catalog, track cart events, apply dynamic discounts directly to Shopify checkout flow.", "Trigger email flows based on hesitation signals. Send personalized offers to cart abandoners automatically.", "Send real-time events to any endpoint. Configurable payloads with HMAC signature verification."][i]}
            </div>
            <div className="ops-int-footer">
              <div />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="ops-btn-sm ops-btn-outline" onClick={() => showToast(`${int.name} config opened`)}>Configure</button>
                <button className="ops-btn-sm ops-btn-red" onClick={() => showToast(`Disconnected from ${int.name}`)}>Disconnect</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Available Integrations</div>
      <div className="ops-integrations-grid" style={{ marginBottom: 16 }}>
        {[
          { logoBg: "#f2f2f0", logo: "🔵", name: "WooCommerce", cat: "E-commerce" },
          { logoBg: "#e8f4fd", logo: "📊", name: "Google Analytics 4", cat: "Analytics" },
          { logoBg: "#fff3cd", logo: "💬", name: "Intercom", cat: "Customer Support" },
          { logoBg: "#e8f5e9", logo: "📣", name: "Mailchimp", cat: "Email Marketing" },
          { logoBg: "#fde8e8", logo: "🛒", name: "BigCommerce", cat: "E-commerce", badge: "Coming Soon", bBadge: "yellow" },
          { logoBg: "#f0f0ee", logo: "🔌", name: "Zapier", cat: "Automation", badge: "Coming Soon", bBadge: "yellow" },
        ].map((int, i) => (
          <div key={i} className="ops-int-card" style={{ opacity: 0.8 }}>
            <div className="ops-int-hdr">
              <div className="ops-int-logo" style={{ background: int.logoBg }}>{int.logo}</div>
              <div>
                <div className="ops-int-name">{int.name}</div>
                <div className="ops-int-cat">{int.cat}</div>
              </div>
              <span className={`ops-badge ${int.bBadge ? `ops-badge-${int.bBadge}` : "ops-badge-gray"}`} style={{ marginLeft: "auto" }}>{int.badge || "Not Connected"}</span>
            </div>
            <div className="ops-int-desc">
              {["WordPress-based store integration. Track product views, cart events, and apply conditional discounts.", "Push hesitation events and AI decisions to GA4. Build custom reports in Looker Studio.", "Trigger proactive chat when hesitation is detected. Route high-value sessions to live agents.", "Add hesitating users to targeted email campaigns. Segment by score range and behavior patterns.", "Native BigCommerce integration for enterprise stores. Full cart and checkout event tracking.", "Connect OpsPulse to 5,000+ apps. Automate workflows triggered by hesitation events and AI decisions."][i]}
            </div>
            <div className="ops-int-footer">
              <button className="ops-btn-sm ops-btn-primary" style={{ width: "100%" }} onClick={() => showToast(`Connecting to ${int.name}...`)}>
                {int.badge === "Coming Soon" ? "Join Waitlist" : "Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PayoutsPage({ showToast }: { showToast: (m: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Available Balance", v: "$384", c: "#2e7d32", top: "2px solid #4caf50" },
          { l: "Pending Balance", v: "$128", c: "var(--text-muted)" },
          { l: "Total Paid (All Time)", v: "$2,456" },
          { l: "Next Payout Date", v: "Jun 1", top: "2px solid #f5c518" },
        ].map((s, i) => (
          <div key={i} className="ops-stat-mini" style={s.top ? { borderTop: s.top } : undefined}>
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div className="ops-stat-mini-val" style={{ color: s.c || "var(--text-primary)", fontSize: i === 3 ? 18 : undefined }}>{s.v}</div>
            {i === 0 && <div className="ops-stat-mini-sub"><button className="ops-btn-sm ops-btn-green" onClick={() => showToast("Payout requested!")}>Request Payout →</button></div>}
          </div>
        ))}
      </div>
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "var(--radius-lg)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 700, color: "white", letterSpacing: 0.5 }}>stripe</div>
          <div><div style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>Your Stripe account is connected and verified.</div></div>
        </div>
        <span className="ops-badge ops-badge-green"><span className="ops-dot ops-dot-green" />CONNECTED</span>
      </div>
    </>
  );
}

function RevsharePage({ showToast, navigate }: { showToast: (m: string) => void; navigate: (p: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Total Revenue Generated", v: "$18,950", b: "This month", bc: "green", top: "2px solid #4caf50" },
          { l: "Your Share (20%)", v: "$3,790", b: "Guaranteed", bc: "purple", top: "2px solid #9c27b0", c: "#7c3aed" },
          { l: "Paid to You", v: "$2,456", b: "Lifetime", bc: "blue", top: "2px solid #2196f3", c: "#1565c0" },
          { l: "Pending Payout", v: "$1,334", b: "Earning", bc: "yellow", top: "2px solid #f5c518", c: "#b8860b" },
        ].map((s, i) => (
          <div key={i} className="ops-card" style={{ borderTop: s.top, position: "relative", overflow: "hidden", padding: 18 }}>
            <div className="ops-stat-mini-lbl">{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.c || "var(--text-primary)", letterSpacing: "-0.5px" }}>{s.v}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <span className={`ops-badge ops-badge-${s.bc}`}>{s.b}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#111", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div><div style={{ fontSize: 14, fontWeight: 700, color: "white", letterSpacing: 0.3 }}>YOUR 20% IS GUARANTEED & AUTOMATED</div></div>
          <span style={{ background: "#4caf50", color: "white", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 0.5 }}>20% GUARANTEED</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
          {[
            { icon: "M6 3.5v2.5l2 1.5", t: "Automated", d: "No Manual Action" },
            { icon: "M7 5a2.5 2.5 0 100-5 2.5 2.5 0 000 5", t: "Secure", d: "Bank-level Security" },
            { icon: "M6 3.5v2.5", t: "Transparent", d: "100% Visibility" },
          ].map((attr, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(76,175,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#4caf50" strokeWidth="1.3">
                  <path d={attr.icon} />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "white" }}>{attr.t}</div>
                <div style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.4)" }}>{attr.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AdminStoresPage({ showToast }: { showToast: (m: string) => void }) {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stores')
      .then(r => r.json())
      .then(d => {
        setStores(d.stores || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="ops-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16 }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-hover)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)" }}>
          <span className="ops-live-dot" />
          SYSTEM BRAIN: LIVE STORES
        </div>
      </div>
      
      <div className="ar-table-scroll" style={{ maxHeight: "60vh" }}>
        <table className="ops-tbl">
          <thead>
            <tr>
              <th>Store Domain</th>
              <th>Account</th>
              <th>Stripe Status</th>
              <th>Plan</th>
              <th>Active</th>
              <th>System Data</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>Loading Database Records...</td>
              </tr>
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>No stores found.</td>
              </tr>
            ) : (
              stores.map((s, i) => (
                <tr key={i}>
                  <td><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.store_domain}</div></td>
                  <td>{s.email || <span style={{ color: "var(--text-muted)", fontSize: 10 }}>Unclaimed</span>}</td>
                  <td>
                    {s.subscription_status === 'active' ? (
                      <span className="ops-badge ops-badge-green">ACTIVE</span>
                    ) : s.subscription_status === 'trialing' ? (
                      <span className="ops-badge ops-badge-blue">TRIAL</span>
                    ) : (
                      <span className="ops-badge ops-badge-gray">{s.subscription_status || "NONE"}</span>
                    )}
                  </td>
                  <td><span className="ops-badge ops-badge-purple" style={{ textTransform: 'uppercase' }}>{s.plan || "UNKNOWN"}</span></td>
                  <td>
                    {s.active ? (
                      <span className="ops-dot ops-dot-green" />
                    ) : (
                      <span className="ops-dot ops-dot-red" />
                    )}
                  </td>
                  <td><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-secondary)" }}>{s.session_count} Events</span></td>
                  <td>
                    <button className="ops-btn-sm ops-btn-primary" onClick={() => showToast("Account management triggered for " + s.store_domain)}>Manage</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
