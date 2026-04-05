"use client";

import React from "react";
import { type Period } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

interface FilterBarProps {
  period: Period;
  onChange: (p: Period) => void;
}

export default function FilterBar({ period, onChange }: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <span className={styles.filterLabel}>Period:</span>
      <div className={styles.filterGroup}>
        {(["7d", "30d"] as Period[]).map((p) => (
          <button
            key={p}
            id={`filter-${p}`}
            className={`${styles.filterBtn} ${period === p ? styles.filterBtnActive : ""}`}
            onClick={() => onChange(p)}
          >
            {p === "7d" ? "Last 7 days" : "Last 30 days"}
          </button>
        ))}
      </div>
    </div>
  );
}
