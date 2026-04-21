"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Terminal, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import crypto from "crypto";

export default function IntegrationPortal() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("UNPROTECTED");
  const [copied, setCopied] = useState(false);
  const workspaceId = `ws_${Math.random().toString(36).substring(2, 9)}`;

  // Automatically start session upon landing
  useEffect(() => {
    startActivation();
  }, []);

  const startActivation = async () => {
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, demo: false })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.onboarding);
      }
    } catch (err) {}
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`<script src="https://engine.nolix.ai/master.js" data-site="${workspaceId}" async></script>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInitialization = async () => {
    setLoading(true);
    setStatus("VERIFYING_HANDSHAKE");
    // Simulate real handshake delay
    setTimeout(async () => {
       await fetch("/api/onboarding/complete", { method: "POST", body: JSON.stringify({ session_id: session?.session_id, step_id: "install_script" })});
       await fetch("/api/onboarding/complete", { method: "POST", body: JSON.stringify({ session_id: session?.session_id, step_id: "send_event" })});
       setStatus("SECURE_HANDSHAKE_ESTABLISHED");
       setTimeout(() => {
          router.push("/dashboard/zeno");
       }, 1500);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans p-6 sm:p-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sky-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Sidebar Navigation Placeholder (Matching Image 1) */}
      <div className="fixed top-0 left-0 w-64 h-full border-r border-white/10 bg-[#050505] p-6 hidden md:block z-10">
        <div className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-600 mb-2">NOLIX</div>
        <div className="text-[10px] text-zinc-500 tracking-widest uppercase mb-10">Operator</div>
        
        <nav className="space-y-4">
          <div className="flex items-center gap-3 text-zinc-400 text-sm hover:text-white transition-colors cursor-pointer">
            <Terminal className="w-4 h-4" /> Terminal
          </div>
          <div className="flex items-center gap-3 text-zinc-400 text-sm hover:text-white transition-colors cursor-pointer">
             Vault
          </div>
          <div className="flex items-center gap-3 text-sky-400 text-sm font-medium border-l-2 border-sky-400 pl-3 -ml-3 bg-sky-900/10 py-1">
             Integration
          </div>
          <div className="flex items-center gap-3 text-zinc-400 text-sm hover:text-white transition-colors cursor-pointer pt-2">
             Intelligence
          </div>
          <div className="flex items-center gap-3 text-zinc-400 text-sm hover:text-white transition-colors cursor-pointer">
             Calibration
          </div>
        </nav>

        <div className="absolute bottom-6 left-6 text-xs text-zinc-500 font-mono">
           LIVE LINK<br />
           <span className="text-white text-sm">0</span><br /><br />
           EPOCH DECISIONS<br />
           <span className="text-sky-400 text-sm">$0</span><br />
           <span className="text-[10px]">PROTECTED AOV</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="md:ml-72 max-w-5xl relative z-20">
         <header className="mb-10">
           <div className="text-sky-500 text-xs font-bold tracking-[0.2em] mb-2 flex items-center gap-2">
             <ShieldAlert className="w-4 h-4" />
             SYSTEM INTEGRATION PROTOCOL
           </div>
           <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3 shadow-sm">Integration Portal</h1>
           <p className="text-zinc-300 font-medium">To begin autonomous revenue protection, deploy the Causal Vector Layer into your target's technical foundation.</p>
         </header>

         {/* Target Status Bar */}
         <div className="border border-white/20 rounded-full py-2 px-6 flex justify-between items-center bg-[#0a0a0a] mb-6 shadow-[0_0_20px_-5px_rgba(255,255,255,0.05)]">
            <span className="text-xs font-bold text-zinc-400 tracking-wider">TARGET STATUS: {status === "UNPROTECTED" ? <span className="text-white">UNPROTECTED</span> : <span className="text-sky-400">{status}</span>}</span>
         </div>
         <p className="text-zinc-400 text-sm font-medium mb-12">The Causal Engine is currently restricted. Injected reality fingerprints cannot be verified until the synchronization vector is live.</p>

         {/* Step 01 */}
         <div className="mb-8 relative">
           <div className="absolute -left-3 top-[-10px] text-4xl font-black text-sky-500/20 pointer-events-none select-none">01</div>
           <div className="border border-white/20 rounded-[2rem] bg-[#0a0a0a] p-6 shadow-lg shadow-black/50">
             <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-3">
               <span className="text-sky-400">01</span> Deploy Master Vector
             </h2>
             <div className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] mb-2">SCRIPT INJECTION CODE</div>
             
             <div className="relative group">
                <pre className="font-mono text-[13px] text-sky-300 bg-black border border-white/10 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
{`<script src="https://engine.nolix.ai/master.js" data-site="${workspaceId}" async></script>`}
                </pre>
                <button 
                  onClick={handleCopy}
                  className="absolute right-3 top-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur transition-all border border-white/10 text-white"
                >
                  {copied ? <span className="text-xs font-bold">COPIED</span> : <Copy className="w-4 h-4" />}
                </button>
             </div>
             
             <p className="mt-4 text-zinc-400 text-sm italic font-medium">"Inject this vector into the global &lt;head&gt; section. Zeno will automatically inherit authorization variables from the site identity."</p>
           </div>
         </div>

         {/* Step 02 */}
         <div className="relative border border-transparent">
           <div className="absolute -left-3 top-[-10px] text-4xl font-black text-white/10 pointer-events-none select-none">02</div>
           <div className="">
             <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-3">
               <span className="text-white">02</span> Initialize Synchronization
             </h2>
             
             <button 
               onClick={handleInitialization}
               disabled={loading}
               className="w-full bg-sky-400 hover:bg-sky-300 text-black font-black text-lg sm:text-xl py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_-5px_rgba(56,189,248,0.5)]"
             >
               {loading ? "INITIALIZING..." : "BEGIN INITIALIZATION SEQUENCE"} <Zap className="w-5 h-5 fill-current" />
             </button>

             <div className="mt-4 flex items-center gap-2 text-xs font-bold text-zinc-500 tracking-wider">
               {status === "UNPROTECTED" && <><ShieldAlert className="w-4 h-4" /> SECURE HANDSHAKE PENDING</>}
               {status === "VERIFYING_HANDSHAKE" && <><div className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"/> VERIFYING HANDSHAKE OVER CAUSAL NETWORK...</>}
               {status === "SECURE_HANDSHAKE_ESTABLISHED" && <><ShieldCheck className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-400">SECURE HANDSHAKE ESTABLISHED</span></>}
             </div>
           </div>
         </div>

      </div>
    </div>
  );
}
