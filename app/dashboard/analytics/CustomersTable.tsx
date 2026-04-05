"use client";

import React from "react";
import { CUSTOMERS, type Customer } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

export default function CustomersTable() {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Customer</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Orders</th>
            <th className={styles.th} style={{ textAlign: "right" }}>Revenue</th>
            <th className={styles.th}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {CUSTOMERS.map((c) => (
            <tr key={c.id} className={styles.tr}>
              <td className={styles.td}>
                <div className={styles.customerCell}>
                  <div className={`${styles.avatar} ${c.status === "churned" ? styles.avatarChurned : ""}`}>
                    {c.avatar}
                  </div>
                  <div>
                    <div className={styles.customerName}>{c.name}</div>
                    <div className={styles.customerEmail}>{c.email}</div>
                  </div>
                </div>
              </td>
              <td className={styles.td}>
                <span className={`${styles.statusBadge} ${c.status === "active" ? styles.statusActive : styles.statusChurned}`}>
                  <span className={`${styles.statusDot} ${c.status === "active" ? styles.statusDotActive : styles.statusDotChurned}`} />
                  {c.status}
                </span>
              </td>
              <td className={styles.td}>
                <span className={styles.orderCount}>{c.orders}</span>
              </td>
              <td className={styles.td} style={{ textAlign: "right" }}>
                <span className={styles.revenueValue}>${c.revenue.toLocaleString()}</span>
              </td>
              <td className={styles.td}>
                <span className={styles.joinedAt}>{c.joinedAt}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
