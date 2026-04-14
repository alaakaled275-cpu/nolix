"use client";

import React, { useState, useEffect } from "react";

// --- Icons ---
const ChartIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3v18h18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 9l-5 5-4-4-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <path d="M9.5 2h5" />
    <path d="M12 2v5" />
    <path d="M15 11.5A2.5 2.5 0 0 1 17.5 9h.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.5A2.5 2.5 0 0 1 15 12.5" />
    <path d="M9 11.5A2.5 2.5 0 0 0 6.5 9H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.5A2.5 2.5 0 0 0 9 12.5" />
    <path d="M12 22a8.5 8.5 0 0 1-8-8.5v-1a5.5 5.5 0 0 1 11 0v1" />
    <path d="M12 22a8.5 8.5 0 0 0 8-8.5v-1a5.5 5.5 0 0 0-11 0v1" />
  </svg>
);

const CheckCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5efc82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const AvatarPlaceholder = () => (
  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-pink-600 flex items-center justify-center border-2 border-[#121215] shadow-lg relative">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#5efc82] rounded-full border-2 border-[#121215]" />
  </div>
);

// --- Table Data Mock ---
const TABLE_DATA = [
  { id: 1, name: "Tavi Plot Ua Artell Raytek", col2: "Anex Partners", col3: "$37,524.10", col4: "19", col5: "13", col6: "2,339",  dots: ["#8b5cf6", "#10b981", "#10b981"] },
  { id: 2, name: "Tenddify", col2: "Acole requests", col3: "$37,534.00", col4: "17", col5: "12", col6: "2,307", dots: ["#06b6d4", "#10b981", "#10b981"] },
  { id: 3, name: "Toryatig", col2: "Treet frag Stat . 1.53%", col3: "19", col4: "20", col5: "0.22", col6: "4,559", dots: ["#06b6d4", "#8b5cf6", "#10b981"] },
  { id: 4, name: "Taind Cacdendaste", col2: "Target Proposals Yatyck", col3: "$5,537.10", col4: "19", col5: "18", col6: "3,957", dots: ["#10b981", "#10b981", "#10b981"] },
];

export default function AnalyticsPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background glow effects for immersive modern feel */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Dashboard Card */}
      <div className={`w-full max-w-[1400px] min-h-[850px] bg-[#050508] border border-white/10 rounded-[2.5rem] shadow-2xl relative flex flex-col p-8 md:p-10 transition-all duration-1000 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        
        {/* --- Top Navigation --- */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6 z-10 w-full animate-fade-in">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <ChartIcon />
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Challenges</a>
            <a href="#" className="hover:text-white transition-colors">Payouts</a>
            <a href="#" className="hover:text-white transition-colors">Leaderboard</a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-6">
            <button className="bg-gradient-to-r from-[#5efc82] to-[#4ceb70] text-black px-6 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(94,252,130,0.3)] hover:shadow-[0_0_30px_rgba(94,252,130,0.5)] hover:scale-105 transition-all duration-300">
              Ask Zeno
            </button>
            
            <div className="text-right">
              <div className="text-white font-bold text-sm">Alex Rivera</div>
              <div className="text-[#5efc82] text-xs font-semibold tracking-wider">PRO TRADER</div>
            </div>

            <div className="relative cursor-pointer hover:bg-white/5 p-2 rounded-full transition-all">
              <BellIcon />
              <div className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-[#5efc82] rounded-full border-2 border-[#050508]" />
            </div>
          </div>
        </header>

        {/* --- Main Content Grid --- */}
        <div className="flex flex-col lg:flex-row gap-12 flex-1 pb-10">
          
          {/* LEFT SECTION (Main Info) */}
          <div className="flex-1 flex flex-col justify-between">
            
            {/* Top Stats */}
            <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-white text-xl font-medium tracking-wide mb-4">Total Trading Capital <span className="text-slate-500 text-sm align-top">TM</span></h2>
              
              <div className="flex items-end gap-6 mb-6">
                <div className="text-6xl md:text-[80px] font-bold text-[#ff4b4b] drop-shadow-[0_0_25px_rgba(255,75,75,0.7)] tracking-tighter leading-none hover:scale-[1.01] transition-transform cursor-pointer">
                  $54,709.50
                </div>
                <div className="bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(94,252,130,0.2)] rounded-full px-5 py-2 mb-2">
                  <span className="text-xl font-semibold text-white drop-shadow-md">+12.5%</span>
                </div>
              </div>
              
              <p className="text-slate-400 text-[15px] mb-8 max-w-md leading-relaxed">
                Zeno detected specific trading patterns for your portfolio
              </p>
              
              <button className="bg-gradient-to-r from-[#5efc82] to-[#4ceb70] text-black px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(94,252,130,0.3)] hover:shadow-[0_0_30px_rgba(94,252,130,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-2 group">
                View Recent Insights 
                <span className="group-hover:translate-y-0.5 transition-transform">⌄</span>
              </button>
            </div>

            {/* Table Area */}
            <div className="flex-1 min-h-[200px] mb-10 overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="space-y-4">
                {TABLE_DATA.map((row, i) => (
                  <div key={row.id} className="flex items-center justify-between py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors rounded-lg px-2 group cursor-pointer">
                    <div className="flex items-center gap-3 w-1/3">
                      <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {row.dots.map((color, j) => (
                          <span key={j} className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                        ))}
                      </div>
                      <span className="text-slate-300 text-sm font-medium">{row.name}</span>
                    </div>
                    
                    <div className="w-1/4 text-white text-sm font-medium">{row.col2}</div>
                    
                    <div className="w-1/6 text-white font-bold tracking-wide">{row.col3}</div>
                    
                    <div className="flex items-center gap-6 w-1/4 justify-end text-slate-400 text-sm font-medium">
                      <span>{row.col4}</span>
                      <span>{row.col5}</span>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="w-2 h-2 rounded-full bg-[#5efc82] shadow-[0_0_8px_#5efc82]" />
                        <span className="text-white font-semibold">{row.col6}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              
              {/* Card 1 */}
              <div className="bg-[#0A0A0C] border border-white/[0.08] rounded-2xl p-6 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-md font-medium text-slate-300">Active Score <span className="text-[#5efc82]">Challenge</span></h3>
                  <button className="text-slate-500 hover:text-white transition-colors pb-1">›</button>
                </div>
                <div className="text-3xl font-bold text-white mb-6 tracking-tight">$100,000</div>
                
                <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-4">
                  <div className="flex flex-col gap-1"><span>Total</span><span className="text-white">0.50</span></div>
                  <div className="flex flex-col gap-1"><span>Wins</span><span className="text-white">$340</span></div>
                  <div className="flex flex-col gap-1"><span>Rate</span><span className="text-white">16%</span></div>
                  <div className="flex flex-col gap-1"><span>Risk</span><span className="text-white">Low</span></div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                    <span>Active • Normal</span>
                    <span>50%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#0A0A0C] border border-white/[0.08] rounded-2xl p-6 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-md font-medium text-slate-300">Active Score <span className="text-[#5efc82]">Challenge</span></h3>
                  <button className="text-slate-500 hover:text-white transition-colors pb-1">›</button>
                </div>
                <div className="text-3xl font-bold text-white mb-6 tracking-tight">$5,000</div>
                
                <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-4">
                  <div className="flex flex-col gap-1"><span>Total</span><span className="text-white">2.50</span></div>
                  <div className="flex flex-col gap-1"><span>Wins</span><span className="text-white">$89</span></div>
                  <div className="flex flex-col gap-1"><span>Rate</span><span className="text-white">32%</span></div>
                  <div className="flex flex-col gap-1"><span>Risk</span><span className="text-white">Med</span></div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                    <span>Active • Scaled</span>
                    <span>80%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="w-[80%] h-full bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT SECTION (Floating Card) */}
          <div className="w-full lg:w-[400px] flex shrink-0 animate-slide-left" style={{ animationDelay: '0.4s' }}>
            
            <div className="w-full rounded-[2rem] border border-white/[0.05] bg-gradient-to-b from-[#0c0c0e] to-[#0A0A0C] hover:border-white/10 transition-colors shadow-2xl relative pb-6 h-fit">
              
              {/* Header */}
              <div className="p-6 border-b border-white/[0.05] flex items-center gap-4 relative overflow-hidden">
                {/* Subtle top glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#5efc82] rounded-full shadow-[0_0_15px_#5efc82] opacity-30" />
                
                <BrainIcon />
                <div>
                  <h3 className="text-white font-medium text-[15px]">Zeno -</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Trading Operator</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-[#5efc82] shadow-[0_0_8px_#5efc82]" />
              </div>

              {/* Inner Overlapping Card */}
              <div className="px-5 mt-5">
                <div className="rounded-2xl border border-white/10 bg-[#121215] shadow-2xl relative p-6 mt-2 hover:-translate-y-1 transition-transform duration-500">
                  
                  {/* Close button icon */}
                  <button className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>

                  <div className="flex flex-col items-center pt-2">
                    <AvatarPlaceholder />
                    
                    <h4 className="text-white font-semibold text-lg mt-4 mb-1">Zeno - Revenue Operator</h4>
                    <p className="text-xs text-slate-400 mb-6 font-medium">Active • Monitoring 847 visitors</p>

                    <h5 className="text-white font-bold text-sm tracking-wide mb-2">Live Action</h5>
                    <p className="text-xs font-semibold text-[#5efc82] text-center mb-8 bg-[#5efc82]/10 px-4 py-2 rounded-lg">
                      Just now: Applied 10% discount to hesitant user ~ Convert 89
                    </p>

                    <div className="w-full flex justify-between items-center border-t border-white/[0.06] pt-6 pb-2">
                      <div className="text-center group">
                        <div className="text-white font-bold text-xl mb-1 group-hover:scale-110 transition-transform">$47,230</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Recovered</div>
                        <div className="flex gap-1 justify-center mt-2 opacity-60">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                      </div>
                      
                      <div className="w-px h-12 bg-white/[0.08]" />
                      
                      <div className="text-center group">
                        <div className="text-white font-bold text-xl mb-1 group-hover:scale-110 transition-transform">+34%</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Convert Lift</div>
                        <div className="flex gap-1 justify-center mt-2 opacity-60">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                      </div>
                      
                      <div className="w-px h-12 bg-white/[0.08]" />
                      
                      <div className="text-center group">
                        <div className="text-white font-bold text-xl mb-1 group-hover:scale-110 transition-transform">891</div>
                        <div className="flex items-center gap-1 justify-center">
                          <CheckCircle />
                          <div className="text-[10px] text-[#5efc82] uppercase tracking-widest font-bold">Checkouts</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* BOTTOM BADGE */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-[#0c0c0e] border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] rounded-full px-6 py-2.5 hidden md:flex items-center gap-2 z-20 cursor-pointer hover:border-white/30 transition-colors animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <span className="text-white font-semibold text-sm">Zeno Score</span>
          <span className="text-[#5efc82] font-bold text-sm tracking-wide">78 <span className="text-slate-500 font-medium">/ 100</span></span>
        </div>

      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-left {
          animation: slideLeft 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
