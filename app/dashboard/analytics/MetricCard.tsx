"use client";

import React from "react";
import { type MetricData } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      {up ? (
        <path d="M5 1L9 7H1L5 1Z" />
      ) : (
        <path d="M5 9L1 3H9L5 9Z" />
      )}
    </svg>
  );
}

function MetricIcon({ icon }: { icon: MetricData["icon"] }) {
  const icons: Record<MetricData["icon"], React.ReactNode> = {
    revenue: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    users: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    churn: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    conversion: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  };
  return <>{icons[icon]}</>;
}

export default function MetricCard({ metric }: { metric: MetricData }) {
  const isUp = metric.change >= 0;
  // For churn, going down is good
  const isPositive = metric.icon === "churn" ? !isUp : isUp;

  return (
    <div className={styles.metricCard}>
      <div className={styles.metricCardTop}>
        <div className={styles.metricIcon}>
          <MetricIcon icon={metric.icon} />
        </div>
        <div className={`${styles.metricBadge} ${isPositive ? styles.metricBadgeUp : styles.metricBadgeDown}`}>
          <TrendArrow up={isUp} />
          {Math.abs(metric.change)}%
        </div>
      </div>
      <div className={styles.metricValue}>
        {metric.prefix && <span className={styles.metricPrefix}>{metric.prefix}</span>}
        {metric.value}
        {metric.suffix && <span className={styles.metricSuffix}>{metric.suffix}</span>}
      </div>
      <div className={styles.metricLabel}>{metric.label}</div>
    </div>
  );
}
