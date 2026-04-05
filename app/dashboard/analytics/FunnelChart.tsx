"use client";

import React from "react";
import { type FunnelStep } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

interface FunnelChartProps {
  data: FunnelStep[];
}

export default function FunnelChart({ data }: FunnelChartProps) {
  const maxVal = data[0].value;

  return (
    <div className={styles.funnelWrap}>
      {data.map((step, i) => {
        const barWidth = Math.max((step.value / maxVal) * 100, 20);
        const dropOff = i > 0 ? data[i - 1].value - step.value : 0;
        const dropOffPct = i > 0 ? Math.round((dropOff / data[i - 1].value) * 100) : 0;

        return (
          <div key={step.label} className={styles.funnelStep}>
            <div className={styles.funnelMeta}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <div className={styles.funnelRight}>
                {i > 0 && (
                  <span className={styles.funnelDropOff}>
                    -{dropOffPct}% drop
                  </span>
                )}
                <span className={styles.funnelPct}>{step.pct}%</span>
                <span className={styles.funnelVal}>{step.value.toLocaleString()}</span>
              </div>
            </div>
            <div className={styles.funnelTrack}>
              <div
                className={styles.funnelFill}
                style={{
                  width: `${barWidth}%`,
                  background: step.color,
                  boxShadow: `0 0 12px ${step.color}55`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
