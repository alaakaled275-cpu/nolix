"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ZenoAppShell } from "@/app/components/ZenoAppShell";
import { 
  ShieldCheck, Zap, Cpu, Code, Copy, Check, CheckCircle,
  RefreshCw, AlertTriangle, Fingerprint, Terminal, Database
} from "lucide-react";

const ACTIVATION_STEPS = [
  { text: "NOLIX engine operational", delay: 0 },
  { text: "Calibrating traffic interceptors...", delay: 1800 },
  { text: "Causal Intelligence models online", delay: 3200 },
  { text: "Revenue protection array active", delay: 5000 },
];

export default function ActivatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const store = params.get("store") || params.get("url") || "yourstore.com";

  const [activated, setActivated] = useState(false);
  const [activationStep, setActivationStep] = useState(-1);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ALWAYS FORCE VERCEL in the UI so the user can copy the real production script to Shopify
  const SCRIPT_SRC = "https://nolix-koe6.vercel.app/master.js";

  // Script tag for Shopify stores (use liquid variable for the real domain)
  // For non-Shopify sites: replace {{ shop.domain }} with your actual domain
  const scriptTag = `<script src="${SCRIPT_SRC}" data-site="{{ shop.domain }}" async></script>`;

  // For display to non-Shopify sites (fallback):
  const scriptTagGeneric = `<script src="${SCRIPT_SRC}" data-site="${store}" async></script>`;

  function handleActivate() {
    setActivated(true);
    let stepIdx = 0;
    ACTIVATION_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setActivationStep(i);
      }, step.delay + 400);
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function beginVerification() {
    if (loadingVerify) return;
    setLoadingVerify(true);
    setVerifyError(null);
    try {
      // Simulate real verification check
      const res = await fetch("/api/store/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl: store })
      });
      if (!res.ok) throw new Error("Synchronization incomplete. Check script injection.");
      
      router.push("/dashboard");
    } catch (err: any) {
      setVerifyError(err.message);
      setLoadingVerify(false);
    }
  }

  return (
    <ZenoAppShell activeTab="install">
      <div className="p-10 max-w-6xl mx-auto animate-fade-in relative z-10 space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[#3fc8ff] text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
              <Cpu className="w-3 h-3" /> System Integration Protocol
            </div>
            <h1 className="text-white text-5xl font-black tracking-tight leading-none mb-6">Integration Portal</h1>
            <p className="text-white/40 text-[15px] font-medium max-w-lg leading-relaxed">
              To begin autonomous revenue protection, deploy the Causal Vector Layer into your target's technical foundation.
            </p>
          </div>

          {!activated && (
            <div className="w-full md:w-[360px] bg-white/[0.03] border border-white/10 p-8 rounded-[40px] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30" />
               <div className="flex items-center gap-3 text-red-500 mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Target Status: Unprotected</span>
               </div>
               <p className="text-white/40 text-xs leading-relaxed">
                 The Causal Engine is currently restricted. Injected reality fingerprints cannot be verified until the synchronization vector is live.
               </p>
            </div>
          )}
        </div>

        {!activated ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            
            {/* Step 1: Delivery */}
            <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] space-y-8">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#3fc8ff]/10 border border-[#3fc8ff]/20 flex items-center justify-center text-[#3fc8ff] font-bold text-sm">01</div>
                  <h3 className="text-white text-lg font-bold">Deploy Master Vector</h3>
               </div>
               <div className="bg-black/40 border border-white/5 rounded-2xl p-6 relative group overflow-hidden">
                  <div className="text-white/20 text-[10px] font-mono mb-4 uppercase tracking-widest">Script Injection Code</div>
                  <code className="text-[#3fc8ff] text-xs font-mono break-all leading-relaxed block pr-12">
                    {scriptTag}
                  </code>
                  <button 
                    onClick={handleCopy}
                    className="absolute right-4 bottom-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#3fc8ff]" /> : <Copy className="w-4 h-4" />}
                  </button>
               </div>
               <p className="text-white/30 text-xs leading-relaxed italic">
                 "Inject this vector into the global &lt;head&gt; section. Zeno will automatically inherit authorization variables from the site identity."
               </p>
            </div>

            {/* Step 2: Kickoff */}
            <div className="space-y-8 pt-10">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 font-bold text-sm">02</div>
                  <h3 className="text-white text-lg font-bold">Initialize Synchronization</h3>
               </div>
               <button 
                  onClick={handleActivate}
                  className="w-full bg-[#3fc8ff] hover:bg-[#32b0e6] text-black font-black py-6 rounded-[30px] flex items-center justify-center gap-4 transition-all shadow-[0_15px_40px_rgba(63,200,255,0.25)] hover:-translate-y-1"
               >
                  BEGIN INITIALIZATION SEQUENCE <Zap className="w-5 h-5 fill-current" />
               </button>
               <div className="flex items-center gap-4 px-6 text-white/30 text-[10px] font-bold uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> SECURE HANDSHAKE PENDING
               </div>
            </div>

          </div>
        ) : (
          /* ACTIVE INITIALIZATION VIEW */
          <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[50px] w-full max-w-2xl mx-auto space-y-10 text-center animate-fade-in">
             <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#3fc8ff] animate-ping" />
                <h2 className="text-white text-2xl font-black tracking-widest uppercase">Synchronization <span className="text-[#3fc8ff]">In Progress</span></h2>
             </div>
             
             <div className="space-y-4 max-w-sm mx-auto">
               {ACTIVATION_STEPS.map((step, i) => (
                 <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-700 ${activationStep >= i ? 'bg-[#3fc8ff]/10 border-[#3fc8ff]/30 opacity-100 translate-x-0' : 'border-transparent opacity-0 -translate-x-4'}`}>
                   <CheckCircle className={`w-4 h-4 ${activationStep >= i ? 'text-[#3fc8ff]' : 'text-white/10'}`} />
                   <span className={`text-[13px] font-medium ${activationStep >= i ? 'text-white' : 'text-white/20'}`}>{step.text}</span>
                 </div>
               ))}
             </div>

             {activationStep >= 3 && (
               <div className="pt-10 animate-slide-up">
                  <button 
                    onClick={beginVerification}
                    disabled={loadingVerify}
                    className={`w-full max-w-sm mx-auto py-5 bg-white/5 border border-white/10 hover:border-[#3fc8ff]/50 rounded-[25px] flex items-center justify-center gap-4 text-white font-bold transition-all ${loadingVerify ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {loadingVerify ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5 text-[#3fc8ff]" />}
                    {loadingVerify ? "ESTABLISHING causal LINK..." : "ENTER MASTER CONSOLE"}
                  </button>
                  {verifyError && (
                    <div className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center justify-center gap-3 animate-head-shake">
                       <AlertTriangle className="w-4 h-4" /> {verifyError}
                    </div>
                  )}
               </div>
             )}
          </div>
        )}

      </div>
    </ZenoAppShell>
  );
}
