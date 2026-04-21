"use client";

import { useState, useEffect } from "react";
import { X, BrainCircuit, Activity } from "lucide-react";

export function ZenoOperatorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({ recovered: 47230, lift: 34, checkouts: 891 });

  // Open the window if they click "Ask Zeno" in the header
  useEffect(() => {
    const btn = document.getElementById("ask-zeno-trigger");
    const openChat = () => setIsOpen(true);
    if (btn) btn.addEventListener("click", openChat);
    return () => { if (btn) btn.removeEventListener("click", openChat); };
  }, []);

  if (!isOpen) {
    // If closed, we can still show a floating minified version or nothing.
    // For this design, maybe just a floating orb if desired, but "Ask Zeno" handles trigger.
    return null;
  }

  return (
    <div className="fixed bottom-8 right-8 w-[380px] bg-[#0c0d0c] border border-white/10 rounded-2xl shadow-[0_20px_50px_-5px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex flex-col font-sans">
      
      {/* Top Header */}
      <div className="bg-zinc-900/50 p-4 border-b border-white/5 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center shadow-inner">
             <BrainCircuit className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Zeno - Revenue Operator</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] text-emerald-500 font-medium">Active • Monitoring 847 visitors</span>
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Operator Body */}
      <div className="p-6 flex flex-col items-center">
        {/* Avatar Placeholder */}
        <div className="w-16 h-16 rounded-full bg-indigo-900/40 border border-indigo-500/20 mb-4 flex items-center justify-center relative overflow-hidden shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]">
           <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Zeno&backgroundColor=transparent" alt="Zeno Avatar" className="w-12 h-12" />
        </div>
        
        <h4 className="text-white font-semibold text-lg mb-1">Zeno - Revenue Operator</h4>
        <p className="text-emerald-400 text-xs font-medium mb-6">Active • Monitoring 847 visitors</p>

        <div className="w-full text-center space-y-2 mb-6">
           <h5 className="text-xs font-bold text-white tracking-widest uppercase">Live Action</h5>
           <p className="text-sm text-zinc-400">Just now: <span className="text-white cursor-pointer hover:underline">Applied 10% discount to hesitant user</span> &rarr; <span className="text-emerald-400">Converted</span></p>
        </div>

        {/* Quick Stats Grid */}
        <div className="w-full grid grid-cols-3 gap-2 border-t border-white/5 pt-6">
           <div className="text-center">
             <div className="text-lg font-bold text-white mb-1">${stats.recovered.toLocaleString()}</div>
             <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase flex flex-col items-center gap-1">
               Recovered
               <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div><div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div></div>
             </div>
           </div>
           <div className="text-center border-x border-white/5">
             <div className="text-lg font-bold text-white mb-1">+{stats.lift}%</div>
             <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase flex flex-col items-center gap-1">
               Conversion Lift
               <div className="flex gap-1"><div className="w-2 h-1.5 rounded-sm bg-white"></div><div className="w-2 h-1.5 rounded-sm bg-zinc-700"></div></div>
             </div>
           </div>
           <div className="text-center">
             <div className="text-lg font-bold text-white mb-1">{stats.checkouts}</div>
             <div className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase flex flex-col items-center gap-1">
               Checkouts
               <Activity className="w-3 h-3 text-emerald-500" />
             </div>
           </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/30">
         <div className="relative">
           <input type="text" placeholder="Instruct Zeno (e.g. increase margins)" className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors" />
         </div>
      </div>
    </div>
  );
}
