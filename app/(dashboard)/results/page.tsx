"use client";

import { useZenoMetrics } from "@/lib/zeno-hooks";
import { CyberCard } from "@/app/components/ui/CyberCard";
import { BarChart3, TrendingUp, DollarSign, Wallet, Activity, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from "framer-motion";

export default function ResultsPage() {
  const metrics = useZenoMetrics();
  const [mounted, setMounted] = useState(false);

  // Recharts hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = [
    { name: 'Mon', baseline: 4000, zeno: 4000 },
    { name: 'Tue', baseline: 4500, zeno: 4900 },
    { name: 'Wed', baseline: 4200, zeno: 4800 },
    { name: 'Thu', baseline: 5000, zeno: 6100 },
    { name: 'Fri', baseline: 5200, zeno: 6800 },
    { name: 'Sat', baseline: 6000, zeno: 8400 },
    { name: 'Sun', baseline: 6500, zeno: 9800 },
  ];

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-sky-400" />
            Revenue Impact
          </h1>
          <p className="text-zinc-500 max-w-2xl text-[15px]">
            Measuring the exact delta between baseline performance and ZENO's causal intervention. Show money, not logs.
          </p>
        </div>
        <div className="text-right hidden md:block">
           <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Protected Volume</div>
           <div className="text-2xl font-black text-white">$142,850.00</div>
        </div>
      </div>

      <div className="space-y-8">
         {/* Top KPIs */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Causal Lift (7d)", value: `+$${metrics.incrementalRevenue.toLocaleString()}`, sub: "Recovered from predicted exits", icon: TrendingUp, color: "text-emerald-400", glow: "rgba(16, 185, 129, 0.1)" },
              { label: "Margin Retained", value: `$${metrics.retainedMargin.toLocaleString()}`, sub: "Saved by holding strict UI pricing", icon: Wallet, color: "text-sky-400", glow: "rgba(56, 189, 248, 0.1)" },
              { label: "Intervention Rate", value: `${metrics.interventionRate}%`, sub: "Users receiving dynamic offers", icon: Activity, color: "text-amber-400", glow: "rgba(245, 158, 11, 0.1)" },
              { label: "Avg Offer ROI", value: `${metrics.avgOfferRoi}x`, sub: "Revenue per $1 discounted", icon: DollarSign, color: "text-indigo-400", glow: "rgba(99, 102, 241, 0.1)" },
            ].map((stat, i) => (
              <CyberCard key={i} className="p-6" glowColor={stat.glow} delay={i + 1}>
                 <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight w-24">{stat.label}</div>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                 </div>
                 <div className="text-3xl font-black text-white tracking-tight mb-2">{stat.value}</div>
                 <div className="text-[11px] text-zinc-400 font-medium leading-relaxed">{stat.sub}</div>
              </CyberCard>
            ))}
         </div>

         {/* Giant Revenue Graph (Recharts implementation) */}
         <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-8 relative overflow-hidden h-[450px] flex flex-col group"
         >
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-500/5 blur-[150px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-start relative z-10 mb-8">
               <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Cumulative Incremental Revenue</h3>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">Baseline vs Zeno Intevention (Trailing 7 Days)</p>
               </div>
               <div className="flex items-center gap-4 bg-[#111] border border-white/5 px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-white tracking-wider"><div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"/> ZENO</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 tracking-wider"><div className="w-2 h-2 rounded-full bg-zinc-700"/> BASELINE</div>
               </div>
            </div>

            <div className="flex-1 w-full relative z-10">
               {mounted && (
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorZeno" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#52525b" stopOpacity={0.2}/>
                         <stop offset="95%" stopColor="#52525b" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                     <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                     <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                     <Tooltip 
                       contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                       itemStyle={{ fontWeight: 'bold' }}
                     />
                     <Area type="monotone" dataKey="baseline" stroke="#52525b" strokeWidth={2} fillOpacity={1} fill="url(#colorBase)" />
                     <Area type="monotone" dataKey="zeno" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorZeno)" activeDot={{ r: 6, fill: '#38bdf8', stroke: '#000', strokeWidth: 2 }} />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
            </div>
         </motion.div>

         {/* Top Strategies Table */}
         <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden"
         >
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <h3 className="text-[13px] text-white font-bold tracking-widest uppercase">Winning Neural Strategies</h3>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="border-b border-white/5 text-zinc-500 text-[10px] tracking-wider uppercase bg-[#050505]/50">
                        <th className="px-6 py-4 font-bold">Strategy Vector</th>
                        <th className="px-6 py-4 font-bold">Interventions</th>
                        <th className="px-6 py-4 font-bold">Conversion Rate (vs Baseline)</th>
                        <th className="px-6 py-4 font-bold text-right">Net Incremental</th>
                     </tr>
                  </thead>
                  <tbody className="text-sm">
                     <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                           <div className="font-bold text-white mb-1 flex items-center gap-2">High-Intent Holdout</div>
                           <div className="text-zinc-500 font-mono text-[10px]">Model overrode UI discount rule.</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-zinc-300">1,240</td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-4">
                              <span className="font-mono text-emerald-400 font-bold">42%</span>
                              <div className="w-48 h-1.5 bg-black rounded-full overflow-hidden flex">
                                 <div className="bg-zinc-600 h-full w-[37%]" title="Baseline 37%" />
                                 <div className="bg-emerald-500 h-full w-[5%]" title="Lift +5%" />
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-5 font-bold text-white text-right font-mono">$18,400</td>
                     </tr>
                     <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                           <div className="font-bold text-white mb-1">Surgical 10% Rescue</div>
                           <div className="text-zinc-500 font-mono text-[10px]">Injected discount exactly at exit velocity.</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-zinc-300">850</td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-4">
                              <span className="font-mono text-sky-400 font-bold">28%</span>
                              <div className="w-48 h-1.5 bg-black rounded-full overflow-hidden flex">
                                 <div className="bg-zinc-600 h-full w-[16%]" />
                                 <div className="bg-sky-400 h-full w-[12%]" />
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-5 font-bold text-white text-right font-mono">$6,250</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </motion.div>

      </div>
    </div>
  );
}
