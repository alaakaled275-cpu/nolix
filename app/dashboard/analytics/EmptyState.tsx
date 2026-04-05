"use client";

import React from "react";
import styles from "./analytics.module.css";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = "No data available",
  description = "Try adjusting your filters or check back later.",
}: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h18v18H3z" rx="2" /><path d="M9 9h6M9 13h4" />
        </svg>
      </div>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyDesc}>{description}</div>
    </div>
  );
}
