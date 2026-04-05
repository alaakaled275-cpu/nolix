"use client";

import React from "react";
import { type Customer } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CustomersTable({ customers }: { customers: Customer[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Customer</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Plan</th>
            <th className={styles.th}>Orders</th>
            <th className={styles.th}>Revenue</th>
            <th className={styles.th}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className={styles.tr}>
              <td className={styles.td}>
                <div className={styles.customerCell}>
                  <div
                    className={`${styles.avatar} ${c.status === "churned" ? styles.avatarChurned : ""}`}
                    aria-hidden
                  >
                    {initials(c.name)}
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
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{c.plan}</span>
              </td>
              <td className={styles.td}>
                <span className={styles.orderCount}>{c.orders}</span>
              </td>
              <td className={styles.td}>
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
