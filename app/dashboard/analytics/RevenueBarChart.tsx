"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { type RevenuePoint } from "@/lib/analytics/mockData";
import styles from "./analytics.module.css";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipDot} style={{ background: "#ff003c" }} />
        <span className={styles.tooltipName}>Revenue</span>
        <span className={styles.tooltipValue}>${payload[0].value.toLocaleString()}</span>
      </div>
    </div>
  );
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

export default function RevenueBarChart({ data }: RevenueChartProps) {
  const maxRev = Math.max(...data.map((d) => d.revenue));
  const tickInterval = data.length <= 7 ? 0 : Math.floor(data.length / 6);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => {
            const intensity = 0.45 + 0.55 * (entry.revenue / maxRev);
            return (
              <Cell
                key={`cell-${index}`}
                fill={`rgba(255, 0, 60, ${intensity})`}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
