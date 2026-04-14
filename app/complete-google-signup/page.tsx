"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Minimal icons for high-end feel
const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5efc82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-6">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function CompleteGoogleSignupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    if (password.length < 8) {
      setError("Security requirement: Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/google/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm_password: confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finalize account security.");

      // Visual delay for professional transition feel
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6 relative overflow-hidden font-sans text-white">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Container */}
      <div className="w-full max-w-[440px] z-10 relative">
        <div className="text-center mb-10 animate-fade-in">
          <a href="/" className="inline-block text-2xl font-black tracking-tight hover:opacity-80 transition-opacity">
            NOLI<span className="text-[#5efc82]">X</span>.
          </a>
        </div>

        {/* Card */}
        <div className="bg-[#0A0A0C] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative shadow-[0_10px_50px_rgba(0,0,0,0.5)] animate-slide-up">
          <ShieldIcon />
          
          <h1 className="text-2xl font-bold mb-3 tracking-tight">Secure Your Account</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Your Google authentication was successful. Set a backup password below to enable direct login capabilities and secure your revenue dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl font-medium flex items-start gap-2 animate-fade-in">
                <span className="mt-0.5">⚠️</span> <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2" htmlFor="password">
                  Master Password
                </label>
                <input 
                  type="password" 
                  id="password" 
                  placeholder="••••••••" 
                  required 
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#121215] border border-white/10 text-white rounded-xl px-5 py-3.5 focus:outline-none focus:border-[#5efc82]/50 focus:ring-1 focus:ring-[#5efc82]/50 transition-all font-medium placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2" htmlFor="confirmPassword">
                  Verify Password
                </label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  placeholder="••••••••" 
                  required 
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#121215] border border-white/10 text-white rounded-xl px-5 py-3.5 focus:outline-none focus:border-[#5efc82]/50 focus:ring-1 focus:ring-[#5efc82]/50 transition-all font-medium placeholder-slate-600"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#5efc82] to-[#4ceb70] text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(94,252,130,0.2)] hover:shadow-[0_0_30px_rgba(94,252,130,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                "Encrypting..."
              ) : (
                <>
                  Initialize Dashboard 
                  <span className="opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all">
                    <ChevronRight />
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500 font-medium">
          Secured by NOLIX Encryption Layer
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
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
