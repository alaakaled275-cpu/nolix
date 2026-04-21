"use client";

import { useEffect, useState } from "react";
import { ChevronDown, BarChart2 } from "lucide-react";

export default function ZenoIntelligenceDashboard() {
  const [stats, setStats] = useState({
    protected_revenue: 54709.50,
    lift: 12.5,
    zeno_score: 78
  });

  const activeStrategies = [
    { name: "Top Prior Value Retain", subtitle: "Anex Receivers", value: "$37,524.10", rank: "19", trend: "18", status: [1,1,0], iconLabel: "2 Rate Claims", metric1: "2,339", metric2: "62" },
    { name: "Tendify", subtitle: "Acute request", value: "$37,534.10", rank: "17", trend: "12", status: [0,1,1], iconLabel: "Autopilot Semi-automark", metric1: "8,299", metric2: "14" },
    { name: "Tonality", subtitle: "Direct Item Shift", value: "1.53%", rank: "19", trend: "28", status: [1,0,1], iconLabel: "Accelerate", metric1: "4,559", metric2: "09" },
    { name: "Target Decision Data", subtitle: "Target Proposed Tactics", value: "$5,537.10", rank: "19", trend: "18", status: [1,1,1], iconLabel: "Auto Ai-Bots", metric1: "$3,957", metric2: "00" }
  ];

  const handleDemoSimulation = async () => {
    // Hidden handler attached if needed, or controlled globally.
    await fetch("/api/demo/simulate", { method: "POST" });
  };

  return (
    <div className="w-full h-full p-4 lg:p-12 font-sans relative">
      
      {/* Top Value Section */}
      <div className="mb-16 mt-8">
        <h2 className="text-zinc-300 text-lg sm:text-xl font-medium tracking-wide mb-4">
          Total Protected Revenue <span className="text-[10px] text-zinc-500 align-top ml-1">TM</span>
        </h2>
        
        <div className="flex flex-col sm:flex-row sm:items-end gap-6 mb-4">
           {/* Huge Glowing Number */}
           <div className="text-6xl sm:text-8xl font-black text-rose-500 tracking-tighter" style={{ textShadow: "0 0 80px rgba(244,63,94,0.4)" }}>
             ${stats.protected_revenue.toLocaleString('en-US', {minimumFractionDigits: 2})}
           </div>
           
           {/* Percentage Badge */}
           <div className="px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xl sm:text-2xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] backdrop-blur-md mb-2 sm:mb-4">
             +{stats.lift}%
           </div>
        </div>

        <p className="text-zinc-400 text-lg mb-8">
          Zeno detected optimal revenue patterns for your portfolio
        </p>

        <button className="bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-lg px-8 py-4 rounded-full transition-all shadow-[0_0_40px_-10px_rgba(52,211,153,0.5)] flex items-center gap-3">
          View Recent Insights <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Middle List Area */}
      <div className="w-full max-w-5xl mb-12">
         <div className="space-y-4 pr-4">
           {activeStrategies.map((strat, idx) => (
             <div key={idx} className="flex items-center justify-between group cursor-default">
               {/* Left Group */}
               <div className="flex items-center gap-4 w-1/3">
                 <div className="flex gap-1.5">
                   <div className={`w-2 h-2 rounded-full ${strat.status[0] ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.7)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'}`}></div>
                   <div className={`w-2 h-2 rounded-full ${strat.status[1] ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-zinc-700'}`}></div>
                   <div className={`w-2 h-2 rounded-full ${strat.status[2] ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-zinc-700'}`}></div>
                 </div>
                 <span className="text-white font-medium group-hover:text-emerald-400 transition-colors">{strat.name}</span>
               </div>
               
               {/* Middle Stats */}
               <div className="flex items-center gap-8 text-sm">
                  <div className="text-zinc-400 w-32 text-right">{strat.subtitle}</div>
                  <div className={`font-bold w-24 text-right ${strat.value.includes('%') ? 'text-zinc-300' : 'text-white'}`}>{strat.value}</div>
                  <div className="text-zinc-500 font-mono w-8 text-center">{strat.rank}</div>
                  <div className="text-zinc-500 font-mono w-8 text-center">{strat.trend}</div>
               </div>

               {/* Right Group */}
               <div className="flex items-center gap-6 w-1/3 justify-end">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    </div>
                    <span className="text-zinc-400 text-sm whitespace-nowrap">{strat.iconLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold">
                     <span className="text-emerald-400">{strat.metric1}</span>
                     <span className="text-zinc-500">{strat.metric2}</span>
                  </div>
               </div>
             </div>
           ))}
         </div>
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
         {/* Card 1 */}
         <div className="bg-[#0f1110] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <ChevronDown className="w-5 h-5 text-zinc-600" />
            </div>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Active Strategy Challenge</h3>
            <div className="text-3xl font-bold text-white mb-6 tracking-tight">$100,000</div>
            
            <div className="grid grid-cols-4 gap-4 text-xs font-medium text-zinc-500 mb-4">
              <div>
                <div className="text-zinc-600 mb-1">Wins</div>
                <div className="text-zinc-300">Target</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">W/L</div>
                <div className="text-zinc-300">0.99</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Total</div>
                <div className="text-zinc-300">$1,320</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Win Rate</div>
                <div className="text-zinc-300">18.5%</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-6 relative">
              <div className="absolute left-0 top-0 h-full w-[16%] bg-white rounded-full"></div>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono mt-2">Anomaly Detected</div>
         </div>

         {/* Card 2 */}
         <div className="bg-[#0f1110] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <ChevronDown className="w-5 h-5 text-zinc-600" />
            </div>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Active Sub-Challenge</h3>
            <div className="text-3xl font-bold text-white mb-6 tracking-tight">$5,000</div>
            
            <div className="grid grid-cols-4 gap-4 text-xs font-medium text-zinc-500 mb-4">
              <div>
                <div className="text-zinc-600 mb-1">Profit</div>
                <div className="text-zinc-300">Locked</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Worth</div>
                <div className="text-zinc-300">$3,500</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Win Rate</div>
                <div className="text-zinc-300">51.0%</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Streak</div>
                <div className="text-zinc-300">7.5</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-6 relative">
              <div className="absolute left-0 top-0 h-full w-[75%] bg-zinc-500 rounded-full"></div>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono mt-2 text-right">Stable</div>
         </div>
      </div>

      {/* Zeno Score Footer Badge */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
         <div className="bg-[#0f1110] border border-white/10 rounded-full px-6 py-2 shadow-2xl flex items-center gap-3 backdrop-blur-xl">
           <span className="text-zinc-400 text-sm font-medium">Zeno Score</span>
           <span className="text-emerald-400 font-bold tracking-wider">{stats.zeno_score}<span className="text-zinc-600">/</span>100</span>
         </div>
      </div>

    </div>
  );
}
