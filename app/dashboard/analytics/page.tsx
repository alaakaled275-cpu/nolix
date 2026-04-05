"use client";

import React, { useEffect, useState } from "react";
import {
  DollarSign,
  Users,
  TrendingUp,
  ShoppingCart,
  Brain,
} from "lucide-react";

import styles from "./analytics.module.css";

import FilterBar from "./FilterBar";
import MetricCard from "./MetricCard";
import UserGrowthChart from "./UserGrowthChart";
import RevenueBarChart from "./RevenueBarChart";
import FunnelChart from "./FunnelChart";
import CustomersTable from "./CustomersTable";
import InsightCard from "./InsightCard";
import { SkeletonCard, SkeletonChart, SkeletonRow } from "./Skeleton";

import {
  type Period,
  getMetrics,
  getUserGrowth,
  getRevenue,
  getFunnel,
  getInsights,
} from "@/lib/analytics/mockData";

const METRIC_ICONS = [
  <DollarSign size={18} key="rev" />,
  <Users size={18} key="usr" />,
  <TrendingUp size={18} key="cvr" />,
  <ShoppingCart size={18} key="ord" />,
];

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [loading, setLoading] = useState(true);

  // Simulate a realistic data-fetch delay
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, [period]);

  const metrics   = getMetrics(period);
  const userGrowth = getUserGrowth(period);
  const revenue   = getRevenue(period);
  const funnel    = getFunnel(period);
  const insights  = getInsights(period);

  return (
    <div className={styles.page}>
      {/* ── Navigation ── */}
      <nav className={styles.topNav}>
        <div className={styles.topNavInner}>
          <a href="/dashboard" className={styles.navBrand}>
            <span className={styles.navLogo} />
            <span className={styles.navBrandName}>NOLI<span>X</span></span>
          </a>
          <span className={styles.navSubtitle}>Analytics</span>

          <div className={styles.navRight}>
            <a href="/dashboard" className={styles.navLink}>← Dashboard</a>
            <a href="/zeno" className={styles.navBtn}>🧠 Zeno</a>
          </div>
        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className={styles.pageInner}>

        {/* ── Header + Filter ── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              Revenue <span>Analytics</span>
            </h1>
            <p className={styles.pageSubtitle}>
              Real-time insights for your e-commerce store
            </p>
          </div>
          <FilterBar period={period} onChange={setPeriod} />
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 1. METRIC CARDS                                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className={styles.metricsGrid}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : metrics.map((m, i) => (
                <MetricCard key={m.label} data={m} icon={METRIC_ICONS[i]} />
              ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 2. CHARTS — User Growth + Revenue Bar                               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className={`${styles.chartsGrid} ${styles.mb16}`}>
          {loading ? (
            <>
              <SkeletonChart />
              <SkeletonChart />
            </>
          ) : (
            <>
              <div className={styles.chartCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <div className={styles.sectionTitle}>User Growth</div>
                    <div className={styles.sectionSubtitle}>Total &amp; new users over time</div>
                  </div>
                </div>
                <UserGrowthChart data={userGrowth} />
              </div>

              <div className={styles.chartCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <div className={styles.sectionTitle}>Daily Revenue</div>
                    <div className={styles.sectionSubtitle}>Revenue attributed per day</div>
                  </div>
                </div>
                <RevenueBarChart data={revenue} />
              </div>
            </>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 3. CONVERSION FUNNEL                                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className={`${styles.chartCard} ${styles.chartCardFull} ${styles.mb28}`}>
          {loading ? (
            <SkeletonChart />
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>Conversion Funnel</div>
                  <div className={styles.sectionSubtitle}>
                    Visitors → Add to Cart → Checkout → Purchase
                  </div>
                </div>
                <span className={styles.aiLabel}>
                  {funnel[funnel.length - 1].pct}% overall CVR
                </span>
              </div>
              <FunnelChart data={funnel} />
            </>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 4. AI INSIGHTS                                                      */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className={styles.mb28}>
          <div className={`${styles.sectionHeader} ${styles.mb16}`}>
            <div>
              <div className={styles.sectionTitle}>
                🧠 AI Insights
              </div>
              <div className={styles.sectionSubtitle}>
                Smart recommendations based on your store data
              </div>
            </div>
            <span className={styles.aiLabel}>
              <Brain size={11} />
              Zeno-powered
            </span>
          </div>
          {loading ? (
            <div className={styles.insightsGrid}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={styles.skeletonChart}
                  style={{ height: 72, padding: "16px 18px" }}
                />
              ))}
            </div>
          ) : (
            <div className={styles.insightsGrid}>
              {insights.map((ins) => (
                <InsightCard key={ins.id} insight={ins} />
              ))}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* 5. CUSTOMERS TABLE                                                  */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div>
          <div className={`${styles.sectionHeader} ${styles.mb16}`}>
            <div>
              <div className={styles.sectionTitle}>Customers</div>
              <div className={styles.sectionSubtitle}>Top accounts by lifetime revenue</div>
            </div>
          </div>
          {loading ? (
            <div
              className={styles.tableWrap}
              style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <CustomersTable />
          )}
        </div>

      </div>
    </div>
  );
}
