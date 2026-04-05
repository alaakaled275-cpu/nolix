"use client";

import React from "react";
import { BarChart2 } from "lucide-react";
import styles from "./analytics.module.css";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = "No data available",
  description = "There's nothing to show here yet.",
}: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <BarChart2 size={36} strokeWidth={1.5} />
      </div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDesc}>{description}</p>
    </div>
  );
}
