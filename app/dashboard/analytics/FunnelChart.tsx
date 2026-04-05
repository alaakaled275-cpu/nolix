"use client";

import React from "react";
import { type FunnelStep } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

export default function FunnelChart({ data }: { data: FunnelStep[] }) {
  const top = data[0]?.value ?? 1;

  return (
    <div className={styles.funnelWrap}>
      {data.map((step, i) => {
        const pct = Math.round((step.value / top) * 100);
        const dropOff =
          i > 0 ? Math.round(((data[i - 1].value - step.value) / data[i - 1].value) * 100) : null;

        return (
          <div key={step.label}>
            <div className={styles.funnelMeta}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <div className={styles.funnelRight}>
                {dropOff !== null && (
                  <span className={styles.funnelDropOff}>−{dropOff}%</span>
                )}
                <span className={styles.funnelPct}>{pct}%</span>
                <span className={styles.funnelVal}>{step.value.toLocaleString()}</span>
              </div>
            </div>
            <div className={styles.funnelTrack}>
              <div
                className={styles.funnelFill}
                style={{ width: `${pct}%`, background: step.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
