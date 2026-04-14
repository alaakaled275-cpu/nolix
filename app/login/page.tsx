"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ZenoAppShell, ZenoOperatorCard } from "@/app/components/ZenoAppShell";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-fill email if passed via URL (e.g. from a verification link or gate)
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // Or read from localStorage if previously saved
      const saved = localStorage.getItem("zeno_saved_email");
      if (saved) setEmail(saved);
    }

    // The Next.js middleware automatically redirects authenticated users to /dashboard.
    // There is no need to manually fetch /api/convert/stats here, which was causing the infinite loop.
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

      // Save email for next time
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

  const rightPanel = (
    <ZenoOperatorCard 
      actionFeed="Awaiting Authorization..."
      statsRow={[
        { value: "-", label: "Recovered", colorClass: "bg-slate-600" },
        { value: "-", label: "Causal Lift", colorClass: "bg-slate-600" }
      ]}
    />
  );

  return (
    <ZenoAppShell activeTab="none" rightPanel={rightPanel}>
      <div className="flex justify-center w-full max-w-xl mx-auto xl:mx-0 xl:justify-start">
        <div className="w-full bg-[#0A0A0C] border border-white/[0.08] p-8 md:p-10 rounded-[2rem] shadow-2xl animate-slide-up relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/10 rounded-full blur-[80px]" />

          <div className="mb-10 relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400">Re-enter the intelligence portal to manage revenue.</p>
          </div>

          <div className="relative z-10">
            <a href="/api/auth/google/login" className="flex items-center justify-center w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-colors shadow-lg mb-6">
              <GoogleIcon />
              Sign in with Google
            </a>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-slate-500 text-sm font-medium">or continue with email</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm mb-4">{error}</div>}
              
              <div className="space-y-1.5">
                <label className="text-slate-400 text-sm font-medium">Email Address</label>
                <input 
                  type="email" 
                  placeholder="you@company.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-slate-400 text-sm font-medium">Password</label>
                  <Link href="/forgot-password" className="text-slate-500 hover:text-white text-xs font-semibold transition-colors">Forgot Password?</Link>
                </div>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
                >
                  {loading ? "Authenticating..." : "Sign In →"}
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-slate-500 text-sm">
              Don't have operational access? <Link href="/signup" className="text-white hover:text-[#10b981] font-semibold transition-colors">Create account</Link>
            </p>
          </div>
        </div>
      </div>
    </ZenoAppShell>
  );
}
