"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ZenoAppShell, ZenoOperatorCard } from "@/app/components/ZenoAppShell";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing recovery token. The link may have expired.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("Security failure: Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finalize password reset");

      setStatus("success");
      setMessage("Operational access restored. Re-routing to Dashboard...");
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "An error occurred");
    }
  };

  return (
    <div className="flex justify-center w-full max-w-xl mx-auto xl:mx-0 xl:justify-start">
      <div className="w-full bg-[#0A0A0C] border border-white/[0.08] p-8 md:p-10 rounded-[2rem] shadow-2xl animate-slide-up relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/10 rounded-full blur-[80px]" />

        <div className="mb-10 relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2">Initialize New Key</h1>
          <p className="text-slate-400">Recovery token valid. Enter your new master password.</p>
        </div>

        <div className="relative z-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {status === "error" && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm mb-4">{message}</div>}
            {status === "success" && (
              <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] rounded-lg text-sm mb-4 font-medium flex items-center gap-2">
                <SpinnerIcon /> {message}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-slate-400 text-sm font-medium">New Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={status === "success"}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10b981] transition-colors disabled:opacity-50"
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
                {status === "loading" ? "Encrypting..." : "Lock & Confirm →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-[#10b981]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function ResetPasswordPage() {
  const rightPanel = (
    <ZenoOperatorCard 
      actionFeed="Key Generation Protocol"
      statsRow={[
        { value: "0", label: "Attempts", colorClass: "bg-slate-600" },
        { value: "-", label: "Lock Status", colorClass: "bg-[#10b981]" }
      ]}
    />
  );

  return (
    <ZenoAppShell activeTab="none" rightPanel={rightPanel}>
      <Suspense fallback={<div className="flex justify-center w-full max-w-xl mx-auto"><div className="w-full bg-[#0A0A0C] border border-white/[0.08] p-8 md:p-10 rounded-[2rem] text-center text-slate-400">Loading secure environment...</div></div>}>
        <ResetPasswordForm />
      </Suspense>
    </ZenoAppShell>
  );
}
