"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { type MetricData } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

interface MetricCardProps {
  data: MetricData;
  icon: React.ReactNode;
  loading?: boolean;
}

export default function MetricCard({ data, icon, loading }: MetricCardProps) {
  const isPositive = data.change >= 0;

  return (
    <div className={styles.metricCard}>
      <div className={styles.metricCardTop}>
        <div className={styles.metricIcon}>{icon}</div>
        <div className={`${styles.metricBadge} ${isPositive ? styles.metricBadgeUp : styles.metricBadgeDown}`}>
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{isPositive ? "+" : ""}{data.change}%</span>
        </div>
      </div>
      <div className={styles.metricValue}>
        {data.prefix && <span className={styles.metricPrefix}>{data.prefix}</span>}
        {data.value}
        {data.suffix && <span className={styles.metricSuffix}>{data.suffix}</span>}
      </div>
      <div className={styles.metricLabel}>{data.label}</div>
    </div>
  );
}
