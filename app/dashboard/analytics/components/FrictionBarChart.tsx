"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { FrictionEntry } from "../types";

const FRICTION_COLORS: Record<string, string> = {
  none: "#22d3ee",
  stuck_cart: "#ef4444",
  bounce_risk: "#f59e0b",
  paralysis: "#a855f7",
};

const FRICTION_LABELS: Record<string, string> = {
  none: "None",
  stuck_cart: "Stuck Cart",
  bounce_risk: "Bounce Risk",
  paralysis: "Paralysis",
};

type Props = { data: FrictionEntry[] };

export default function FrictionBarChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: FRICTION_LABELS[d.friction_detected] || d.friction_detected,
    value: Number(d.count),
    key: d.friction_detected,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No friction data yet
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="#3d3d5c"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#3d3d5c"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,15,26,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#f1f5f9",
              fontSize: "12px",
            }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={FRICTION_COLORS[entry.key] || "#6366f1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
