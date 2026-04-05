"use client";

import React from "react";
import styles from "./analytics.module.css";

export function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonLine} ${styles.skeletonIcon}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonValueLg}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonValueSm}`} />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className={styles.skeletonChart}>
      <div className={`${styles.skeletonLine} ${styles.skeletonChartTitle}`} />
      <div className={styles.skeletonChartBody} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className={styles.skeletonRow}>
      <div className={`${styles.skeletonLine} ${styles.skeletonAvatar}`} style={{ borderRadius: "50%" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div className={`${styles.skeletonLine} ${styles.skeletonRowName}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonRowEmail}`} />
      </div>
      <div className={`${styles.skeletonLine} ${styles.skeletonBadge}`} style={{ borderRadius: 20 }} />
      <div className={`${styles.skeletonLine} ${styles.skeletonRowRev}`} />
    </div>
  );
}
