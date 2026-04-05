"use client";

import React from "react";
import { Brain, TrendingDown, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { type Insight } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

const iconMap = {
  warning: <AlertTriangle size={16} />,
  positive: <TrendingUp size={16} />,
  info: <Info size={16} />,
};

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className={`${styles.insightCard} ${styles[`insightCard_${insight.type}`]}`}>
      <div className={`${styles.insightIconWrap} ${styles[`insightIcon_${insight.type}`]}`}>
        {iconMap[insight.type]}
      </div>
      <div className={styles.insightBody}>
        <div className={styles.insightTitle}>{insight.title}</div>
        <div className={styles.insightDesc}>{insight.description}</div>
      </div>
      {insight.metric && (
        <div className={`${styles.insightMetric} ${styles[`insightMetric_${insight.type}`]}`}>
          {insight.metric}
        </div>
      )}
    </div>
  );
}
