"use client";

import React, { useEffect, useState } from "react";
import { Link } from "lucide-react"; // Wait, I will use lucid react for custom icons, better just import commonly used.
import {
  LayoutDashboard, BarChart3, Settings, Code, Users,
  Activity, Zap, Shield, Target, Bell
} from "lucide-react";
import { NetworkSensor } from "@/app/components/NetworkSensor";

// ── Types ────────────────────────────────────────────────────────────────────
interface IntelligenceState {
  last_action: string;
  last_reason: string;
  last_uplift: number;
  last_confidence: number;
  alternatives_rejected: string[];
  decisions_today: number;
  conversions_today: number;
  revenue_protected: number;
  brier_score: number | null;
  brier_label: string;
  drift_detected: boolean;
  drift_direction: string;
}

// ── Sub-components ───────────────────────────────────────────────────────────
const LogoMark = () => (
  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3fc8ff] to-[#0066ff] flex items-center justify-center font-black text-white text-base shadow-[0_0_15px_rgba(0,102,255,0.4)]">
    N
  </div>
);

const StatusDot = ({ active = true }: { active?: boolean }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? "bg-[#3fc8ff] shadow-[0_0_8px_#3fc8ff] animate-pulse" : "bg-slate-600"}`} />
);

// ── ZenoOperatorCard — legacy compatibility ──────────────────────────────────
// We keep this to not break any external pages relying on it currently, but it should not be used in the main cinematic flow.
export function ZenoOperatorCard({
  actionFeed = "Monitoring traffic...",
  statsRow = []
}: {
  actionFeed?: React.ReactNode;
  statsRow?: { value: string; label: string; colorClass: string }[];
}) {
  return null;
}

// ── ZenoAppShell ─────────────────────────────────────────────────────────────
export function ZenoAppShell({
  children,
  activeTab = "dashboard",
  intelData,
}: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode; // ignored now
  activeTab?: string;
  showIntelPanel?: boolean; // ignored now
  intelData?: IntelligenceState;
}) {
  const [loaded, setLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState("operator@nolix.app");

  useEffect(() => {
    setLoaded(true);
    fetch("/api/convert/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user_email) setUserEmail(d.user_email); })
      .catch(() => {});
  }, []);

  const navItems = [
    { id: "dashboard", label: "Terminal",      href: "/dashboard",   icon: LayoutDashboard },
    { id: "analysis",  label: "Vault",         href: "/results",     icon: BarChart3 },
    { id: "install",   label: "Integration",   href: "/activate",    icon: Code },
    { id: "audience",  label: "Intelligence",  href: "/intelligence", icon: Users },
    { id: "settings",  label: "Calibration",   href: "/calibration",  icon: Settings },
  ];

  const userInitial = userEmail?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="min-h-screen bg-[#03050a] flex font-sans text-white overflow-hidden relative">
      <NetworkSensor />

      {/* ── Background Cinematic Glow ── */}
      <div className="fixed bottom-[-10vh] left-1/2 -translate-x-1/2 w-[150vw] h-[40vh] bg-[radial-gradient(ellipse_at_bottom,rgba(0,102,255,0.25)_0%,transparent_60%)] pointer-events-none z-0" />

      {/* ── Glassmorphic Sidebar (The Operator Console) ── */}
      <aside className="w-[260px] h-screen border-r border-white/[0.05] flex flex-col justify-between py-6 px-4 bg-[rgba(10,14,25,0.4)] backdrop-blur-2xl shrink-0 z-20 relative">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-3 px-3 mb-10">
            <LogoMark />
            <div>
              <div className="text-white font-bold text-sm tracking-tight tracking-wider">NOLIX</div>
              <div className="text-white/50 text-[10px] tracking-[0.2em] uppercase mt-0.5">Operator</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-[13px] font-medium group relative overflow-hidden ${
                    isActive
                      ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      : "hover:bg-white/[0.03] text-white/60 hover:text-white"
                  }`}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#3fc8ff] rounded-r-full shadow-[0_0_10px_#3fc8ff]" />}
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#3fc8ff]" : "opacity-60 group-hover:opacity-100"}`} />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Global Stats Snapshot */}
        <div className="mb-6 px-3">
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4">
            <div className="text-white/50 text-[10px] uppercase tracking-widest mb-3 flex items-center justify-between">
              Live Link <StatusDot />
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-white font-bold text-lg leading-none">{intelData?.decisions_today ?? 0}</div>
                <div className="text-white/40 text-[10px] mt-1 uppercase tracking-wider">Epoch Decisions</div>
              </div>
              <div className="w-full h-[1px] bg-white/[0.05]" />
              <div>
                <div className="text-[#3fc8ff] font-bold text-lg leading-none">${(intelData?.revenue_protected ?? 0).toLocaleString()}</div>
                <div className="text-white/40 text-[10px] mt-1 uppercase tracking-wider">Protected AOV</div>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="px-3 py-3 flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl cursor-pointer transition-all border border-white/[0.05]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3fc8ff] to-[#0066ff] flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-[0_0_10px_rgba(0,102,255,0.3)]">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[12px] font-medium truncate">{userEmail}</div>
            <div className="text-[#3fc8ff] text-[10px] font-semibold tracking-[0.1em] uppercase mt-0.5">Secure</div>
          </div>
        </div>
      </aside>

      {/* ── Main Working Area (The Zeno Dimension) ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10 w-full">
        {/* Top Actions Bar (Slim, transparent) */}
        <header className="absolute top-0 right-0 p-6 flex justify-end items-center gap-4 shrink-0 z-50 pointer-events-none">
          <div className="pointer-events-auto relative cursor-pointer bg-white/[0.03] border border-white/[0.1] hover:bg-white/[0.08] p-3 rounded-full transition-all text-white/60 hover:text-white backdrop-blur-md shadow-lg">
            <Bell className="w-5 h-5" />
            <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#3fc8ff] rounded-full shadow-[0_0_8px_#3fc8ff] animate-pulse" />
          </div>
        </header>

        {/* The Cinematic Content flows here */}
        <div className={`w-full h-full transition-all duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}>
           {children}
        </div>
      </main>

    </div>
  );
}
