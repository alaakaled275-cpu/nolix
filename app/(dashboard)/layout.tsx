"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, BrainCircuit, BarChart2, ShieldAlert, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { ZenoOperatorChat } from "@/components/ZenoChat";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navLinks = [
    { name: "Intelligence", href: "/intelligence", icon: BrainCircuit },
    { name: "Results", href: "/results", icon: BarChart2 },
    { name: "Calibration", href: "/calibration", icon: ShieldAlert },
    { name: "Integration", href: "/activate", icon: Zap },
  ];

  return (
    <div className="flex h-screen bg-[#000000] text-zinc-300 font-sans overflow-hidden font-['Inter',_sans-serif]">
      
      {/* 1. Sidebar Architecture */}
      <aside className={`${collapsed ? 'w[80px]' : 'w-[280px]'} bg-[#050505] border-r border-white/5 flex flex-col shrink-0 relative z-20 transition-all duration-300`}>
        
        {/* Toggle Button */}
        <button 
           onClick={() => setCollapsed(!collapsed)}
           className="absolute -right-3 top-6 bg-[#0a0a0c] border border-white/10 rounded-full p-1 z-30 hover:bg-white/10 transition-colors"
        >
           {collapsed ? <ChevronRight className="w-3 h-3 text-white"/> : <ChevronLeft className="w-3 h-3 text-white" />}
        </button>

        {/* Logo Area */}
        <div className="h-20 px-6 flex items-center gap-3 border-b border-white/5">
           <div className="flex gap-1" style={{ width: '24px', height: '18px' }}>
              <div className="w-1.5 h-full bg-emerald-500 rounded-sm skew-x-12" />
              <div className="w-1.5 h-full bg-emerald-500/70 rounded-sm skew-x-12 translate-y-1" />
              <div className="w-1.5 h-full bg-emerald-500/40 rounded-sm skew-x-12 translate-y-2" />
           </div>
           {!collapsed && (
             <div className="flex flex-col animate-fade-in-up">
               <span className="font-bold text-white text-lg leading-none mt-1 uppercase tracking-tight">NOLIX</span>
               <span className="text-[10px] text-emerald-400 tracking-wider flex items-center gap-1 font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  ONLINE
               </span>
             </div>
           )}
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href);
            return (
              <div key={link.name} className="relative group">
                <Link 
                  href={link.href} 
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-white/5 text-white shadow-inner border border-white/10' 
                      : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <link.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'} transition-colors`} />
                  {!collapsed && <span className="font-bold text-[13px] tracking-wide uppercase">{link.name}</span>}
                </Link>
                {/* Tooltip for collapsed state */}
                {collapsed && (
                   <div className="absolute left-[80px] top-1/2 -translate-y-1/2 bg-[#111] border border-white/10 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {link.name}
                   </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-screen relative z-10 overflow-hidden bg-[#000000]">
        
        {/* Top HUD Bar */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#020202]/80 backdrop-blur-md sticky top-0 z-40">
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-zinc-500 border border-white/10 rounded px-2 py-0.5 bg-black">WS_491KX2</span>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                 <Activity className="w-3 h-3 text-sky-400" />
                 NETWORK LATENCY: <span className="text-white">18ms</span>
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Global Zeno Floating Chat Operator */}
      <ZenoOperatorChat />
    </div>
  );
}
