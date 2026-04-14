"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ZenoAppShell, ZenoOperatorCard } from "@/app/components/ZenoAppShell";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign up");

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
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-400">Initialize your operation portal to start recovering revenue.</p>
          </div>

          <div className="relative z-10">
            <a href="/api/auth/google/login" className="flex items-center justify-center w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-colors shadow-lg mb-6">
              <GoogleIcon />
              Sign up with Google
            </a>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-slate-500 text-sm font-medium">or continue with email</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm mb-4">{error}</div>}
              
              <div className="space-y-1.5">
                <label className="text-slate-400 text-sm font-medium">Full Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

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
                <label className="text-slate-400 text-sm font-medium">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-sm font-medium">Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
                >
                  {loading ? "Creating..." : "Create Account →"}
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-slate-500 text-sm">
              Already have an account? <Link href="/login" className="text-white hover:text-[#10b981] font-semibold transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </ZenoAppShell>
  );
}
