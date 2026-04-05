"use client";

import React from "react";
import { type Insight } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function PositiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const iconMap = {
  warning:  <WarningIcon />,
  positive: <PositiveIcon />,
  info:     <InfoIcon />,
};

export default function InsightCard({ insight }: { insight: Insight }) {
  const t = insight.type;
  return (
    <div className={`${styles.insightCard} ${styles[`insightCard_${t}`]}`}>
      <div className={`${styles.insightIconWrap} ${styles[`insightIcon_${t}`]}`}>
        {iconMap[t]}
      </div>
      <div className={styles.insightBody}>
        <div className={styles.insightTitle}>{insight.title}</div>
        <div className={styles.insightDesc}>{insight.description}</div>
      </div>
      <div className={`${styles.insightMetric} ${styles[`insightMetric_${t}`]}`}>
        {insight.metric}
      </div>
    </div>
  );
}
