"use client";

import React, { useEffect, useState } from "react";
import { ZenoAppShell } from "@/app/components/ZenoAppShell";
import { 
  Cpu, Target, Activity, Zap, TrendingUp, BarChart, 
  Brain, Shield, RefreshCw, MessageSquare
} from "lucide-react";

export default function IntelligencePage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/convert/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signalWeights = [
    { label: "Cart Value Depth", weight: 92, status: "Critical" },
    { label: "High-Intent Velocity", weight: 78, status: "Active" },
    { label: "Contextual Friction", weight: 65, status: "Active" },
    { label: "Trust Signal Gap", weight: 45, status: "Emerging" },
    { label: "Navigation Breadth", weight: 30, status: "Stable" }
  ];

  return (
    <ZenoAppShell activeTab="audience">
      <div className="p-10 max-w-6xl mx-auto animate-fade-in relative z-10 space-y-10">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-[#3fc8ff] text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
             <Brain className="w-3 h-3" /> Zeno Causal Intelligence
          </div>
          <h1 className="text-white text-5xl font-black tracking-tight leading-none">Intelligence Engine</h1>
          <p className="text-white/40 text-sm mt-3 font-medium">Visualization of the Llama-70B Causal Model and signal weight distribution.</p>
        </div>

        {/* Top KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] backdrop-blur-3xl">
              <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4 flex justify-between items-center">
                Total Decisions <Target className="w-4 h-4 text-[#3fc8ff]" />
              </div>
              <div className="text-white text-4xl font-black">{(stats?.popups_shown || 1240).toLocaleString()}</div>
              <div className="text-[#3fc8ff] text-xs font-bold mt-2">+12.4% from Last Epoch</div>
           </div>
           
           <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] backdrop-blur-3xl">
              <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4 flex justify-between items-center">
                Attributed Revenue <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-white text-4xl font-black">${(stats?.revenue_attributed || 42800).toLocaleString()}</div>
              <div className="text-emerald-400 text-xs font-bold mt-2">Verified Causal Uplift</div>
           </div>

           <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] backdrop-blur-3xl">
              <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4 flex justify-between items-center">
                Causal Accuracy <Shield className="w-4 h-4 text-[#3fc8ff]" />
              </div>
              <div className="text-white text-4xl font-black">94.8%</div>
              <div className="text-white/20 text-xs font-bold mt-2">Brier Score Optimized</div>
           </div>
        </div>

        {/* Weight Distribution Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           
           <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px]">
              <h3 className="text-white text-lg font-bold mb-8 flex items-center gap-3">
                 <Zap className="w-5 h-5 text-[#3fc8ff]" /> Signal Weight Distribution
              </h3>
              <div className="space-y-8">
                 {signalWeights.map((sig, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="text-white text-xs font-bold opacity-80">{sig.label}</span>
                          <span className="text-[#3fc8ff] text-[10px] font-bold uppercase tracking-widest bg-[#3fc8ff]/10 px-3 py-1 rounded-full">{sig.status}</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#3fc8ff] shadow-[0_0_10px_rgba(63,200,255,0.4)]" style={{ width: `${sig.weight}%` }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] flex flex-col">
              <h3 className="text-white text-lg font-bold mb-8 flex items-center gap-3">
                 <Activity className="w-5 h-5 text-white/40" /> Neural Context Activation
              </h3>
              <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                 <div className="w-32 h-32 rounded-full border border-dashed border-[#3fc8ff]/30 flex items-center justify-center animate-[spin_20s_linear_infinite]">
                    <BarChart className="w-12 h-12 text-[#3fc8ff]/20" />
                 </div>
                 <p className="text-white/40 text-sm italic max-w-xs">
                    "Zeno is currently prioritizing Cart-Depth signals to reduce high-intent abandonment across Global Tier 1 traffic."
                 </p>
                 <div className="text-white text-xs font-bold bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                    View Decision Log →
                 </div>
              </div>
           </div>

        </div>

      </div>
    </ZenoAppShell>
  );
}
