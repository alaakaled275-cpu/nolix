"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, Fingerprint, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    } else {
      const saved = localStorage.getItem("zeno_saved_email");
      if (saved) setEmail(saved);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log in");

      localStorage.setItem("zeno_saved_email", email);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 18 19" className="mr-3">
      <path fill="#4285F4" d="M17.64 9.682c0-.636-.056-1.25-.163-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.568 2.684-3.875 2.684-6.615z"></path>
      <path fill="#34A853" d="M9 18.463c2.43 0 4.467-.805 5.956-2.181l-2.908-2.259c-.805.54-1.836.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18.463z"></path>
      <path fill="#FBBC05" d="M3.964 11.172A5.412 5.412 0 0 1 3.682 9.23c0-.671.115-1.32.327-1.928V4.971H.957A8.996 8.996 0 0 0 0 9.231c0 1.451.347 2.827.957 4.073l3.007-2.132z"></path>
      <path fill="#EA4335" d="M9 3.59c1.32 0 2.508.455 3.44 1.346l2.582-2.582C13.463.882 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.971L3.964 7.3c.708-2.128 2.692-3.711 5.036-3.711z"></path>
    </svg>
  );

  return (
    <div className="flex w-full min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      
      {/* 1. Left Sidebar (Enterprise Grade) */}
      <div className="hidden lg:flex w-[480px] bg-[#0A0A0C] border-r border-white/5 flex-col justify-between p-12 relative overflow-hidden shrink-0">
         {/* Background ambient glow */}
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

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
              Reclaim lost revenue.<br />
              With zero friction.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Authenticate into the Intelligence Operator to command your store's neural pricing matrix.
            </p>
         </div>

         {/* High-end Abstract UI Elements */}
         <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md animate-fade-in-up" style={{ animationDelay: '100ms' }}>
               <BrainCircuit className="w-6 h-6 text-emerald-400" />
               <div>
                  <div className="text-white font-bold text-sm">Causal Intelligence</div>
                  <div className="text-zinc-500 text-xs mt-0.5">Automated pricing optimization</div>
               </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md animate-fade-in-up" style={{ animationDelay: '200ms' }}>
               <ShieldCheck className="w-6 h-6 text-emerald-400" />
               <div>
                  <div className="text-white font-bold text-sm">Protected State</div>
                  <div className="text-zinc-500 text-xs mt-0.5">Enterprise-grade security isolation</div>
               </div>
            </div>
         </div>
      </div>

      {/* 2. Right Side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 relative">
         <div className="w-full max-w-[440px] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="mb-10 text-center lg:text-left">
              <Fingerprint className="w-10 h-10 text-emerald-400 mb-6 mx-auto lg:mx-0" />
              <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Sign In</h1>
              <p className="text-zinc-400 text-lg">Enter your access credentials to proceed.</p>
            </div>

            <a href="/api/auth/google/login" className="flex items-center justify-center w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)] mb-8 max-w-[440px] mx-auto lg:mx-0">
               <GoogleIcon />
               Sign in with Google
            </a>

            <div className="flex items-center gap-4 mb-8 w-full max-w-[440px] mx-auto lg:mx-0">
               <div className="h-px bg-white/10 flex-1" />
               <span className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Or Secure Login</span>
               <div className="h-px bg-white/10 flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-[440px] mx-auto lg:mx-0">
               {error && <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm mb-4 flex items-center gap-3"><ShieldAlert className="w-4 h-4"/>{error}</div>}
               
               <div className="space-y-2">
                 <label className="text-zinc-400 text-sm font-bold tracking-wide">Work Email</label>
                 <input 
                   type="email" 
                   required 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                   placeholder="operator@company.com"
                 />
               </div>
               
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <label className="text-zinc-400 text-sm font-bold tracking-wide">Passcode</label>
                   <Link href="/forgot-password" className="text-emerald-500 hover:text-emerald-400 text-xs font-bold transition-colors">Forgot Passcode?</Link>
                 </div>
                 <input 
                   type="password" 
                   required 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                   placeholder="••••••••"
                   autoComplete="current-password"
                 />
               </div>

               <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg py-4 rounded-xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] transition-all mt-4 relative overflow-hidden group"
               >
                 <span className="relative z-10">{loading ? "Verifying..." : "Access Dashboard"}</span>
                 {/* Shine effect */}
                 <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shimmer" />
               </button>
            </form>

            <p className="mt-10 text-center lg:text-left text-zinc-500 text-sm">
              New to Operator Core? <Link href="/signup" className="text-white hover:text-emerald-400 font-bold transition-colors border-b border-white/20 hover:border-emerald-400">Request Access</Link>
            </p>
         </div>
      </div>
    </div>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="M12 8v4"></path>
      <path d="M12 16h.01"></path>
    </svg>
  );
}
