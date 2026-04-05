"use client";

import React from "react";
import styles from "./analytics.module.css";

type Period = "7d" | "30d" | "90d" | "1y";

const PERIODS: { label: string; value: Period }[] = [
  { label: "7D",  value: "7d"  },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "1Y",  value: "1y"  },
];

interface FilterBarProps {
  activePeriod: Period;
  onChange: (period: Period) => void;
}

export default function FilterBar({ activePeriod, onChange }: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <span className={styles.filterLabel}>Period</span>
      <div className={styles.filterGroup} role="group" aria-label="Time period filter">
        {PERIODS.map(({ label, value }) => (
          <button
            key={value}
            id={`filter-${value}`}
            className={`${styles.filterBtn} ${activePeriod === value ? styles.filterBtnActive : ""}`}
            onClick={() => onChange(value)}
            aria-pressed={activePeriod === value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
