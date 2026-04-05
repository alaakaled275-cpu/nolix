"use client";

import React, { useState, useMemo } from "react";
import MetricCard from "./MetricCard";
import UserGrowthChart from "./UserGrowthChart";
import RevenueBarChart from "./RevenueBarChart";
import FunnelChart from "./FunnelChart";
import InsightCard from "./InsightCard";
import CustomersTable from "./CustomersTable";
import FilterBar from "./FilterBar";
import {
  metricsData,
  userGrowthData,
  revenueData,
  funnelData,
  insightsData,
  customersData,
} from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

type Period = "7d" | "30d" | "90d" | "1y";

function sliceGrowth(period: Period) {
  const counts: Record<Period, number> = { "7d": 7, "30d": 14, "90d": 21, "1y": 28 };
  return userGrowthData.slice(-counts[period]);
}

function sliceRevenue(period: Period) {
  const counts: Record<Period, number> = { "7d": 3, "30d": 4, "90d": 6, "1y": 12 };
  return revenueData.slice(-counts[period]);
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");

  const growthSlice  = useMemo(() => sliceGrowth(period),  [period]);
  const revenueSlice = useMemo(() => sliceRevenue(period), [period]);

  return (
    <div className={styles.page}>
      {/* ── Top Navigation ── */}
      <nav className={styles.topNav} aria-label="Main navigation">
        <div className={styles.topNavInner}>
          <a href="/" className={styles.navBrand} aria-label="NOLIX home">
            <span className={styles.navLogo} aria-hidden />
            <span className={styles.navBrandName}>NOL<span>IX</span></span>
          </a>
          <span className={styles.navSubtitle}>Analytics</span>
          <div className={styles.navRight}>
            <a href="/dashboard" className={styles.navLink}>Dashboard</a>
            <a href="/dashboard/analytics" className={styles.navLink}>Analytics</a>
            <button className={styles.navBtn} id="nav-export-btn">Export</button>
          </div>
        </div>
      </nav>

      <main className={styles.pageInner}>
        {/* ── Page Header ── */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              Analytics <span>Overview</span>
            </h1>
            <p className={styles.pageSubtitle}>
              Real-time SaaS metrics · updated every 5 minutes
            </p>
          </div>
          <FilterBar activePeriod={period} onChange={setPeriod} />
        </header>

        {/* ── AI Insights ── */}
        <section aria-labelledby="insights-heading" className={styles.mb28}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="insights-heading" className={styles.sectionTitle}>AI Insights</h2>
              <p className={styles.sectionSubtitle}>Powered by trend analysis</p>
            </div>
            <span className={styles.aiLabel} aria-hidden>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <circle cx="5" cy="5" r="5" />
              </svg>
              LIVE
            </span>
          </div>
          <div className={styles.insightsGrid}>
            {insightsData.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>

        {/* ── KPI Metric Cards ── */}
        <section aria-labelledby="metrics-heading" className={styles.mb28}>
          <div className={styles.sectionHeader}>
            <h2 id="metrics-heading" className={styles.sectionTitle}>Key Metrics</h2>
          </div>
          <div className={styles.metricsGrid}>
            {metricsData.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </section>

        {/* ── Charts Grid ── */}
        <section aria-labelledby="charts-heading" className={styles.mb28}>
          <h2 id="charts-heading" className="sr-only">Charts</h2>
          <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.sectionTitle}>User Growth</div>
                <div className={styles.sectionSubtitle}>Total &amp; new users over time</div>
              </div>
            </div>
            <UserGrowthChart data={growthSlice} />
          </div>

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>Revenue</div>
                  <div className={styles.sectionSubtitle}>MRR vs ARR</div>
                </div>
              </div>
              <RevenueBarChart data={revenueSlice} />
            </div>

            <div className={styles.chartCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>Conversion Funnel</div>
                  <div className={styles.sectionSubtitle}>Visitor → paying customer</div>
                </div>
              </div>
              <FunnelChart data={funnelData} />
            </div>
          </div>
        </section>

        {/* ── Customers Table ── */}
        <section aria-labelledby="customers-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="customers-heading" className={styles.sectionTitle}>Top Customers</h2>
              <p className={styles.sectionSubtitle}>Sorted by revenue, all plans</p>
            </div>
          </div>
          <CustomersTable customers={customersData} />
        </section>
      </main>
    </div>
  );
}
