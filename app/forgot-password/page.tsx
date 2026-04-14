"use client";

import { useState } from "react";
import Link from "next/link";
import { ZenoAppShell, ZenoOperatorCard } from "@/app/components/ZenoAppShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset link");

      setStatus("success");
      setMessage(data.message || "If an account exists, a reset link was sent to your email.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "An error occurred");
    }
  };

  const rightPanel = (
    <ZenoOperatorCard 
      actionFeed="Initiating Account Recovery..."
      statsRow={[
        { value: "0", label: "Attempts", colorClass: "bg-slate-600" },
        { value: "-", label: "Lock Status", colorClass: "bg-[#10b981]" }
      ]}
    />
  );

  return (
    <ZenoAppShell activeTab="none" rightPanel={rightPanel}>
      <div className="flex justify-center w-full max-w-xl mx-auto xl:mx-0 xl:justify-start">
        <div className="w-full bg-[#0A0A0C] border border-white/[0.08] p-8 md:p-10 rounded-[2rem] shadow-2xl animate-slide-up relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/10 rounded-full blur-[80px]" />

          <div className="mb-10 relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-slate-400">Enter your operational email to establish a secure recovery link.</p>
          </div>

          <div className="relative z-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {status === "error" && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm mb-4">{message}</div>}
              {status === "success" && (
                <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] rounded-lg text-sm mb-4 font-medium">
                  {message}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-slate-400 text-sm font-medium">Email Address</label>
                <input 
                  type="email" 
                  placeholder="you@company.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "success"}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors disabled:opacity-50"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={status === "loading" || status === "success"}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "Dispatching..." : "Send Reset Link →"}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
              <span className="text-slate-500">Wait, I remember it!</span>
              <Link href="/login" className="text-white hover:text-[#10b981] font-semibold transition-colors">Return to Login</Link>
            </div>
          </div>
        </div>
      </div>
    </ZenoAppShell>
  );
}
