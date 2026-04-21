"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Server, ShieldCheck, Zap, KeyRound } from "lucide-react";
import { setCookie } from "cookies-next";

export default function ActivateClient({ workspaceId, publicKey }: { workspaceId: string, publicKey: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [scriptUrl, setScriptUrl] = useState("");

  useEffect(() => {
    setScriptUrl(`https://nolix-koe6.vercel.app/master.js`);
    setCookie("workspace_id", workspaceId, { maxAge: 60 * 60 * 24 * 30 });
    setCookie("public_key", publicKey, { maxAge: 60 * 60 * 24 * 30 });
  }, [workspaceId, publicKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`<script src="${scriptUrl}" data-key="${publicKey}" async></script>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/check-install?key=${publicKey}`);
          const data = await res.json();
          if (data.active) {
             clearInterval(interval);
             setStep(3);
             setTimeout(() => {
                setStep(4);
                setCookie("zeno_state", "ACTIVE", { maxAge: 60 * 60 * 24 * 30 });
                setTimeout(() => {
                  router.push("/intelligence");
                }, 2000);
             }, 3000);
          }
        } catch(e) {}
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [step, publicKey, router]);

  return (
    <div className="flex w-full min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      
      {/* 1. Left Sidebar (Enterprise Grade) */}
      <div className="hidden lg:flex w-[480px] bg-[#0A0A0C] border-r border-white/5 flex-col justify-between p-12 relative overflow-hidden shrink-0">
         {/* Background ambient glow */}
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />

         {/* Logo */}
         <div className="relative z-10 flex items-center gap-3 mb-16">
           <div className="flex gap-1" style={{ width: '28px', height: '22px' }}>
              <div className="w-2 h-full bg-emerald-500 rounded-sm skew-x-12"></div>
              <div className="w-2 h-full bg-emerald-500/70 rounded-sm skew-x-12 translate-y-1"></div>
              <div className="w-2 h-full bg-emerald-500/40 rounded-sm skew-x-12 translate-y-2"></div>
           </div>
           <span className="font-bold text-white text-2xl tracking-tight shadow-[0_0_15px_rgba(16,185,129,0.3)]">NOLIX</span>
         </div>

         {/* Value Prop Banner */}
         <div className="relative z-10 mb-12">
            <h2 className="text-3xl font-black text-white leading-tight mb-4 tracking-tight">
              Finalize Integration.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Inject the Operator script into your global header to authorize data flow.
            </p>
         </div>

         {/* High-end Abstract UI Elements */}
         <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
               <div className="flex items-center gap-4">
                 <KeyRound className="w-6 h-6 text-sky-400" />
                 <div>
                    <div className="text-white font-bold text-sm">Security Key Generated</div>
                    <div className="text-zinc-500 text-xs mt-0.5 font-mono">{publicKey.substring(0, 15)}...</div>
                 </div>
               </div>
               <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md opacity-50">
               <div className="flex items-center gap-4">
                 <Server className="w-6 h-6 text-zinc-500" />
                 <div>
                    <div className="text-zinc-400 font-bold text-sm">Neural Sync</div>
                    <div className="text-zinc-600 text-xs mt-0.5">Awaiting first payload</div>
                 </div>
               </div>
               {step >= 2 && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
            </div>
         </div>
      </div>

      {/* 2. Right Side: Activation Flow */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 relative overflow-y-auto">
         <div className="w-full max-w-[540px] animate-fade-in-up my-auto">
             
           {/* Target Status Bar */}
           <div className="border border-white/10 rounded-full py-2.5 px-6 flex justify-between items-center bg-[#0a0a0c] mb-12 shadow-[0_0_20px_-5px_rgba(255,255,255,0.05)] w-fit mx-auto lg:mx-0">
             <span className="text-xs font-bold text-zinc-400 tracking-wider">
               SYSTEM LOCK: 
               {step === 1 && <span className="text-white ml-2">AWAITING HANDSHAKE</span>}
               {step === 2 && <span className="text-amber-400 ml-2 animate-pulse">LISTENING ON PORT</span>}
               {step === 3 && <span className="text-sky-400 ml-2 animate-pulse">VERIFYING NEURAL PATHWAYS</span>}
               {step === 4 && <span className="text-emerald-400 ml-2 shadow-[0_0_10px_#10b981]">OPERATOR ACTIVE</span>}
             </span>
           </div>

           {step === 1 && (
             <div className="animate-fade-in-up">
               <h2 className="text-3xl font-black tracking-tight mb-4 flex items-center gap-3 text-white">
                 <span className="text-emerald-500">01</span> Execute Main Payload
               </h2>
               <p className="text-zinc-400 mb-10 text-lg leading-relaxed">
                 Inject this snippet perfectly into the <code>&lt;head&gt;</code> of your application. We actively scan for the first event ping before allowing access.
               </p>

               <div className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] mb-3 uppercase">Integration Vector</div>
               <div className="relative group mb-10">
                  <pre className="font-mono text-[13px] sm:text-sm text-sky-300 bg-[#0a0a0c] border border-white/10 p-6 rounded-2xl overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
{`<script src="${scriptUrl}" data-key="${publicKey}" async></script>`}
                  </pre>
                  <button 
                    onClick={handleCopy}
                    className="absolute right-4 top-4 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl backdrop-blur transition-all border border-white/10 text-white flex items-center gap-2"
                  >
                    {copied ? <span className="text-xs font-bold text-emerald-400 px-2">COPIED</span> : <><Copy className="w-4 h-4" /><span className="text-xs font-bold">COPY</span></>}
                  </button>
               </div>
               
               <button 
                 onClick={() => setStep(2)}
                 className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg py-5 rounded-xl flex items-center justify-center gap-3 tracking-wide transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] group"
               >
                 Verify Handshake <Zap className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
               </button>
             </div>
           )}

           {step === 2 && (
             <div className="border border-amber-500/20 rounded-[2rem] bg-[#0a0a0c] p-12 text-center shadow-[0_0_40px_-10px_rgba(245,158,11,0.15)] animate-fade-in-up">
               <Server className="w-16 h-16 text-amber-500 mx-auto mb-8 animate-pulse" />
               <h2 className="text-3xl font-black tracking-tight text-white mb-3">
                 Listening for signals...
               </h2>
               <p className="text-zinc-400 mb-10 text-lg">Send any event or refresh your application to establish the causal connection.</p>
               <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white text-sm font-bold border-b border-zinc-700 pb-1">ABORT LISTENING</button>
             </div>
           )}

           {step === 3 && (
             <div className="border border-sky-500/20 rounded-[2rem] bg-[#0a0a0c] p-12 text-center shadow-[0_0_40px_-10px_rgba(56,189,248,0.15)] animate-fade-in-up">
               <div className="flex justify-center mb-8">
                  <div className="relative flex h-20 w-20">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60"></span>
                    <span className="relative flex justify-center items-center rounded-full h-20 w-20 border border-sky-400 bg-black">
                       <Zap className="w-8 h-8 text-sky-400" />
                    </span>
                  </div>
               </div>
               <h2 className="text-3xl font-black tracking-tight text-white mb-3">
                 Signal Verified
               </h2>
               <p className="text-sky-400 font-mono text-sm uppercase tracking-widest">Bridging neural architecture...</p>
             </div>
           )}

           {step === 4 && (
             <div className="border border-emerald-500/20 rounded-[2rem] bg-[#0a0a0c] p-12 text-center shadow-[0_0_60px_-10px_rgba(16,185,129,0.2)] animate-fade-in-up">
               <ShieldCheck className="w-24 h-24 text-emerald-400 mx-auto mb-8" />
               <h2 className="text-4xl font-black tracking-tight text-white mb-4">
                 OPERATOR IS ONLINE
               </h2>
               <p className="text-emerald-400 font-mono text-sm uppercase tracking-widest mb-2">Revenue protection protocols active.</p>
               <p className="text-zinc-500 text-sm">Redirecting to Intelligence Core...</p>
             </div>
           )}

         </div>
      </div>
    </div>
  );
}
