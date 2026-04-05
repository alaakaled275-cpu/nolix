"use client";

import { useEffect, useRef, useState } from "react";

type KPICardProps = {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendUp?: boolean;
  color?: string;
  delay?: number;
};

export default function KPICard({
  label,
  value,
  icon,
  trend,
  trendUp = true,
  color = "#6366f1",
  delay = 0,
}: KPICardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      ref={ref}
      style={{
        animationDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-6 hover:border-white/[0.12] hover:bg-[rgba(20,20,36,0.8)] transition-all duration-300 cursor-default"
    >
      {/* Glow accent */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.07] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-500"
        style={{ background: color }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl">{icon}</span>
          {trend && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                trendUp
                  ? "text-emerald-400 bg-emerald-400/10"
                  : "text-red-400 bg-red-400/10"
              }`}
            >
              {trendUp ? "↑" : "↓"} {trend}
            </span>
          )}
        </div>
        <div
          className="text-3xl font-bold tracking-tight mb-1"
          style={{ color }}
        >
          {value}
        </div>
        <div className="text-sm text-slate-400 font-medium">{label}</div>
      </div>
    </div>
  );
}
