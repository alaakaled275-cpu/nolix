"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { Session } from "../types";

type Props = { sessions: Session[] };

export default function ConversionsChart({ sessions }: Props) {
  // Group sessions by date and calculate conversions
  const dataMap = new Map<string, { total: number; converted: number }>();

  sessions.forEach((s) => {
    const date = new Date(s.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const entry = dataMap.get(date) || { total: 0, converted: 0 };
    entry.total++;
    if (s.converted) entry.converted++;
    dataMap.set(date, entry);
  });

  const chartData = Array.from(dataMap.entries())
    .map(([date, v]) => ({
      date,
      conversions: v.converted,
      sessions: v.total,
      rate: v.total > 0 ? +((v.converted / v.total) * 100).toFixed(1) : 0,
    }))
    .reverse();

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No conversion data yet
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sessGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
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
              backdropFilter: "blur(12px)",
            }}
            itemStyle={{ color: "#c9d1d9" }}
          />
          <Area
            type="monotone"
            dataKey="sessions"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#sessGradient)"
            dot={false}
            name="Sessions"
          />
          <Area
            type="monotone"
            dataKey="conversions"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#convGradient)"
            dot={{ r: 3, fill: "#6366f1", stroke: "#0f0f1a", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
            name="Conversions"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
