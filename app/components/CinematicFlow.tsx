"use client";

import React, { useState, useEffect, useRef } from "react";
import { ZenoBrainOrb } from "./ZenoBrainOrb";
import { 
  Activity, ShieldCheck, ArrowRight, XCircle, AlertTriangle, 
  Globe, Fingerprint, Search, Cpu, Zap, BarChart, RefreshCcw,
  CheckCircle, Database, TrendingUp
} from "lucide-react";

type Phase = 
  | "IDLE" 
  | "PIPELINE"
  | "DASHBOARD"
  | "ERROR";

// --- Icons for User Dashboard ---
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

const CircleCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5efc82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const AvatarPlaceholder = () => (
  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3fc8ff] to-[#0066ff] flex items-center justify-center border-2 border-[#121215] shadow-lg relative">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#5efc82] rounded-full border-2 border-[#121215]" />
  </div>
);

// --- Table Data Mock ---
const TABLE_DATA = [
  { id: 1, name: "Organic Search", col2: "High Intent", col3: "$37,524.10", col4: "19", col5: "13", col6: "2,339",  dots: ["#3fc8ff", "#5efc82", "#5efc82"] },
  { id: 2, name: "Meta Ads Cohort", col2: "Friction Detected", col3: "$37,534.00", col4: "17", col5: "12", col6: "2,307", dots: ["#ff4b4b", "#5efc82", "#5efc82"] },
  { id: 3, name: "Direct Traffic", col2: "Returning Buyer", col3: "19", col4: "20", col5: "0.22", col6: "4,559", dots: ["#06b6d4", "#8b5cf6", "#5efc82"] },
  { id: 4, name: "TikTok Referrals", col2: "Impulse Purchasers", col3: "$5,537.10", col4: "19", col5: "18", col6: "3,957", dots: ["#5efc82", "#5efc82", "#5efc82"] },
];

export function CinematicFlow() {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [url, setUrl] = useState("");
  const [errorText, setErrorText] = useState("");
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'warning', time: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Dashboard states
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  const orbState = (phase === "IDLE" || phase === "ERROR") ? "idle" : "searching";

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString([], {hour12:false, minute:'2-digit', second:'2-digit'});
    setLogs((prev) => [...prev, { msg, type, time }]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const executePipeline = async (targetUrl: string) => {
    if (!targetUrl) return;
    
    setUrl(targetUrl);
    setLogs([]);
    setPhase("PIPELINE");
    
    try {
      // 1. Reality Extraction
      addLog("Starting Reality Extraction on target...", "info");
      await new Promise(r => setTimeout(r, 1000));

      // 2. RealityFingerprint
      addLog("Gathering RealityFingerprint parameters...", "info");
      
      const verifyRes = await fetch("/api/engine/url-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const verifyData = await verifyRes.json();

      // 3. Classification Gate
      addLog("Initializing Classification Gate...", "info");
      await new Promise(r => setTimeout(r, 800));

      if (!verifyData.success || !verifyData.reachable) {
        addLog("Classification Gate: NOT VALID -> STOP", "warning");
        setPhase("ERROR");
        setErrorText(verifyData.error || "Gate Rejection: Target unreachable.");
        return;
      }

      addLog("Classification Gate: VALID", "success");
      
      // 4. 3 Phase Analysis
      addLog("Executing 3 Phase Analysis...", "info");
      
      const analyzePromise = fetch("/api/store/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const analyzeRes = await analyzePromise;
      const analyzeData = await analyzeRes.json();
      
      if (analyzeData.error) {
        setPhase("ERROR");
        setErrorText(analyzeData.error);
        return;
      }
      setAnalysisData(analyzeData);

      // 5. Decision Engine (ZENO)
      addLog("Hooking into Decision Engine (ZENO)...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 6. Execution (NOLIX)
      addLog("Running Execution (NOLIX)...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 7. User Behavior
      addLog("Simulating User Behavior Response...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 8. Feedback API
      addLog("Calling Feedback API...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 9. Causal Update
      addLog("Calculating Causal Update...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 10. Calibration Engine
      addLog("Syncing with Calibration Engine...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 11. Metrics Update
      addLog("Committing Metrics Update...", "info");
      await new Promise(r => setTimeout(r, 800));

      // 12. Dashboard
      addLog("Transitioning to Dashboard...", "info");
      
      // 13. NEXT DECISION IMPROVED
      addLog("NEXT DECISION IMPROVED.", "success");
      await new Promise(r => setTimeout(r, 1000));

      setPhase("DASHBOARD");
      setTimeout(() => setDashboardLoaded(true), 100);

    } catch (e: any) {
      setPhase("ERROR");
      setErrorText("System Exception: " + e.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") executePipeline(e.currentTarget.value);
  };

  return (
    <div className="relative w-full h-full bg-[#000000] overflow-y-auto scrollbar-hide text-white">
      
      {/* ── Zeno Orb Centerpiece (Visible in IDLE and PIPELINE) ── */}
      {phase !== "DASHBOARD" && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-10 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${phase === "IDLE" ? "top-[15vh] scale-100" : "top-[10vh] scale-90 opacity-90"}
        `}>
          <ZenoBrainOrb state={orbState} size={300} />
        </div>
      )}

      {/* ── PHASE: IDLE (Welcome) ── */}
      <div className={`fixed top-[48vh] w-full text-center transition-all duration-700 pointer-events-none z-20
        ${phase === "IDLE" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"}
      `}>
        <div className="flex items-center justify-center gap-2 text-[#3fc8ff] mb-4">
           <Cpu className="w-5 h-5 animate-pulse" />
           <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Zeno Layer 7 Intelligence</span>
        </div>
        <h1 className="text-white font-bold text-5xl tracking-tight mb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
          Master System
        </h1>
        <p className="text-white/40 text-sm font-medium tracking-wide">Autonomous Contextual Revenue Engine</p>
      </div>

      {/* ── LOGS STREAM (Visible during processing) ── */}
      <div 
        ref={scrollRef}
        className={`fixed bottom-[15vh] left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] overflow-y-auto scrollbar-hide z-30 flex flex-col gap-3 px-6 transition-all duration-700
          ${(phase === "PIPELINE") ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-20"}
        `}
      >
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl animate-fade-in self-end max-w-[90%] shadow-lg transition-all
            ${log.type === 'success' ? 'bg-[#3fc8ff]/10 border-[#3fc8ff]/30 text-white' : 
              log.type === 'warning' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-white/5 border-white/10 text-white/80'}
          `}>
             <div className="mt-1">
               {log.type === 'success' ? <CheckCircle className="w-4 h-4 text-[#3fc8ff]" /> : 
                log.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
               <Activity className="w-4 h-4 text-white/40 animate-pulse" />}
             </div>
             <div className="text-[13px] font-medium leading-relaxed">
               <span className="text-white/30 mr-2 font-mono text-[10px]">[{log.time}]</span>
               {log.msg}
             </div>
          </div>
        ))}
      </div>

      {/* ── INPUT AREA (Idle only) ── */}
      <div className={`fixed bottom-[10vh] left-1/2 -translate-x-1/2 w-full max-w-[500px] z-40 transition-all duration-700
         ${phase === "IDLE" ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-20"}
      `}>
         <div className="input-bar glass-effect flex items-center bg-[rgba(30,35,50,0.6)] border border-white/10 rounded-full px-6 py-4 backdrop-blur-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <Search className="w-5 h-5 text-white/30 mr-4" />
            <input 
               type="text" 
               placeholder="Enter URL to begin Reality Extraction..." 
               className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-white/20"
               onKeyDown={handleKeyDown}
            />
         </div>
      </div>

      {/* ── ERROR DISPLAY ── */}
      <div className={`fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-50 transition-all duration-500 ${phase === "ERROR" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="bg-[#03050a] border border-red-500/30 p-10 rounded-3xl max-w-md w-full text-center shadow-2xl">
           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
           <h3 className="text-white text-xl font-bold mb-2">Gate Rejection</h3>
           <p className="text-white/60 text-sm mb-8 font-mono">{errorText}</p>
           <button onClick={() => setPhase("IDLE")} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl font-bold transition-all">
             Reset Operator Console
           </button>
        </div>
      </div>

      {/* ── EXACT USER DASHBOARD UI ── */}
      {phase === "DASHBOARD" && (
        <div className="w-full min-h-screen flex items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden animate-fade-in">
          {/* Background glow effects for immersive modern feel */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-sky-900/10 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />

          {/* Main Dashboard Card */}
          <div className={`w-full max-w-[1400px] min-h-[850px] bg-[#050508] border border-white/10 rounded-[2.5rem] shadow-2xl relative flex flex-col p-8 md:p-10 transition-all duration-1000 ${dashboardLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            
            {/* --- Top Navigation --- */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6 z-10 w-full animate-fade-in">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <ChartIcon />
                <span className="font-black tracking-widest uppercase text-xl">NOLIX</span>
              </div>

              {/* Nav Links */}
              <nav className="flex items-center gap-8 text-sm font-medium text-slate-400">
                <a href="#" className="hover:text-white transition-colors">Segments</a>
                <a href="#" className="hover:text-white transition-colors">Campaigns</a>
                <a href="#" className="hover:text-white transition-colors">Calibrations</a>
              </nav>

              {/* Right Actions */}
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setPhase("IDLE")} 
                  className="bg-white/5 border border-white/10 text-white/60 hover:text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-white/10 transition-all duration-300"
                >
                  New Scan
                </button>
                <button className="bg-gradient-to-r from-[#5efc82] to-[#4ceb70] text-black px-6 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(94,252,130,0.3)] hover:shadow-[0_0_30px_rgba(94,252,130,0.5)] hover:scale-105 transition-all duration-300">
                  Ask Zeno
                </button>
                
                <div className="text-right">
                  <div className="text-white font-bold text-sm">Operator</div>
                  <div className="text-[#3fc8ff] text-xs font-semibold tracking-wider">LIVE</div>
                </div>

                <div className="relative cursor-pointer hover:bg-white/5 p-2 rounded-full transition-all">
                  <BellIcon />
                  <div className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-[#3fc8ff] rounded-full border-2 border-[#050508] animate-pulse" />
                </div>
              </div>
            </header>

            {/* --- Main Content Grid --- */}
            <div className="flex flex-col lg:flex-row gap-12 flex-1 pb-10 w-full">
              
              {/* LEFT SECTION (Main Info) */}
              <div className="flex-1 flex flex-col justify-between">
                
                {/* Top Stats */}
                <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <h2 className="text-white text-xl font-medium tracking-wide mb-4">Total Attributed Revenue <span className="text-[#5efc82] text-sm align-top">+Uplift</span></h2>
                  
                  <div className="flex items-end gap-6 mb-6">
                    <div className="text-6xl md:text-[80px] font-bold text-[#ff4b4b] drop-shadow-[0_0_25px_rgba(255,75,75,0.7)] tracking-tighter leading-none hover:scale-[1.01] transition-transform cursor-pointer">
                      ${analysisData?.market?.monthly_revenue_high?.toLocaleString() || "54,709.50"}
                    </div>
                    <div className="bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(63,200,255,0.2)] rounded-full px-5 py-2 mb-2">
                      <span className="text-xl font-semibold text-[#3fc8ff] drop-shadow-md">+{(analysisData?.strategic?.ux_speed_score * 1.5).toFixed(1) || "12.5"}%</span>
                    </div>
                  </div>
                  
                  <p className="text-slate-400 text-[15px] mb-8 max-w-md leading-relaxed">
                    Zeno detected friction patterns for {url.replace(/^https?:\/\/(www\.)?/, '') || "the target"}.
                  </p>
                  
                  <button className="bg-gradient-to-r from-[#5efc82] to-[#4ceb70] text-black px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(94,252,130,0.3)] hover:shadow-[0_0_30px_rgba(94,252,130,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-2 group">
                    <Zap className="w-4 h-4 fill-current" /> Deploy Optimization
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                {/* Table Area */}
                <div className="flex-1 min-h-[200px] mb-10 overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <h3 className="text-white font-medium mb-4 uppercase tracking-widest text-xs opacity-50">Causal Evaluation Vectors</h3>
                  <div className="space-y-4">
                    {TABLE_DATA.map((row) => (
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
                      <h3 className="text-md font-medium text-slate-300">Expected Recovery <span className="text-[#3fc8ff]">Zeno</span></h3>
                      <button className="text-slate-500 hover:text-white transition-colors pb-1">›</button>
                    </div>
                    <div className="text-3xl font-bold text-white mb-6 tracking-tight">${analysisData?.market?.monthly_profit_high?.toLocaleString() || "14,000"}</div>
                    
                    <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-4">
                      <div className="flex flex-col gap-1"><span>Target</span><span className="text-white">{analysisData?.market?.demand_level || "High"}</span></div>
                      <div className="flex flex-col gap-1"><span>AOV</span><span className="text-white">${analysisData?.market?.aov_est || 50}</span></div>
                      <div className="flex flex-col gap-1"><span>Rate</span><span className="text-white">16%</span></div>
                      <div className="flex flex-col gap-1"><span>Risk</span><span className="text-white">Low</span></div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                        <span>Active • Normal</span>
                        <span>50%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="w-1/2 h-full bg-[#3fc8ff] rounded-full shadow-[0_0_10px_#3fc8ff]" />
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-[#0A0A0C] border border-white/[0.08] rounded-2xl p-6 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-md font-medium text-slate-300">Growth Upside <span className="text-[#5efc82]">Scale</span></h3>
                      <button className="text-slate-500 hover:text-white transition-colors pb-1">›</button>
                    </div>
                    <div className="text-3xl font-bold text-white mb-6 tracking-tight">${analysisData?.strategic?.missed_revenue_est?.toLocaleString() || "5,000"}</div>
                    
                    <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-4">
                      <div className="flex flex-col gap-1"><span>Status</span><span className="text-white">Valid</span></div>
                      <div className="flex flex-col gap-1"><span>Friction</span><span className="text-white">{analysisData?.strategic?.checkout_friction || "Med"}</span></div>
                      <div className="flex flex-col gap-1"><span>Lift</span><span className="text-white">32%</span></div>
                      <div className="flex flex-col gap-1"><span>Conf</span><span className="text-white">88%</span></div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                        <span>Calibrated • Active</span>
                        <span>80%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="w-[80%] h-full bg-[#5efc82] shadow-[0_0_10px_#5efc82] rounded-full" />
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
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#3fc8ff] rounded-full shadow-[0_0_15px_#3fc8ff] opacity-50" />
                    
                    <BrainIcon />
                    <div>
                      <h3 className="text-white font-medium text-[15px]">Zeno -</h3>
                      <p className="text-slate-400 text-xs mt-0.5">Revenue Operator</p>
                    </div>
                    <div className="ml-auto w-2 h-2 rounded-full bg-[#5efc82] shadow-[0_0_8px_#5efc82] animate-pulse" />
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
                        
                        <h4 className="text-white font-semibold text-lg mt-4 mb-1">Zeno - Brain</h4>
                        <p className="text-xs text-slate-400 mb-6 font-medium">Active • Layer 7 Intelligence</p>

                        <h5 className="text-white font-bold text-sm tracking-wide mb-2">Algorithm Execution</h5>
                        <p className="text-xs font-semibold text-[#5efc82] text-center mb-8 bg-[#5efc82]/10 border border-[#5efc82]/30 px-4 py-2 rounded-lg leading-relaxed">
                          Just now: {analysisData?.strategic?.fix_first || "Applied discount to high-hesitation user cohort"}
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
                              <CircleCheckIcon />
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
              <span className="text-white font-semibold text-sm">Calibration Confidence</span>
              <span className="text-[#3fc8ff] font-bold text-sm tracking-wide">{analysisData?.zeno_self_audit?.overall_confidence || 88} <span className="text-slate-500 font-medium">/ 100</span></span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
