"use client";
import React, { useState } from "react";
import { CreditCard, Receipt, FileText, Zap, Shield, AlertTriangle, ArrowRight } from "lucide-react";

export default function BillingDashboard() {
  const [loadingPortal, setLoadingPortal] = useState(false);

  // In a real application, these would be fetched from the database / Stripe
  const status: string = "active"; // active, past_due, canceled
  const plan = "growth";
  const planFee = 199;
  const commissionRate = 0.20;
  
  const usageRevenue = 15420.50; // Total Incremental Revenue generated this month
  const totalCommission = usageRevenue * commissionRate;
  const nextBillingDate = "Nov 15, 2026";
  const totalDue = planFee + totalCommission;

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Portal access failed.");
      }
    } catch (e) {
      alert("Error connecting to Stripe");
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#00ff66] selection:text-black">
      
      {/* HEADER */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div className="flex items-end h-8">
            <div className="w-2 h-5 bg-[#00ff66] rounded-sm mr-1"></div>
            <div className="w-2 h-7 bg-white rounded-sm mr-1"></div>
            <div className="w-2 h-9 bg-white rounded-sm"></div>
          </div>
          <span className="text-xl font-bold tracking-widest uppercase">NOLIX</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm font-bold tracking-widest">BILLING OPERATOR</span>
          <a href="/dashboard" className="px-4 py-2 border border-[#222] rounded-full text-xs font-bold hover:bg-[#111] transition-colors">Return to Console</a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <CreditCard className="text-[#00ff66]" size={36} />
              Billing Infrastructure
            </h1>
            <p className="text-gray-400 mt-2 text-sm tracking-wide">
              Manage your hybrid subscription, performance usage, and invoices securely.
            </p>
          </div>
          
          <button 
            onClick={handleOpenPortal}
            disabled={loadingPortal}
            className="flex items-center gap-2 px-6 py-3 bg-[#111] border border-[#333] hover:border-[#00ff66]/50 rounded-full font-bold transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            {loadingPortal ? "Connecting..." : "Manage Payment Methods"} <ArrowRight size={16} />
          </button>
        </div>

        {status === "past_due" && (
          <div className="mb-8 p-4 bg-[#ff3333]/10 border border-[#ff3333]/40 rounded-xl flex items-start gap-4 shadow-[0_0_20px_rgba(255,51,51,0.1)]">
            <AlertTriangle className="text-[#ff3333] shrink-0" size={24} />
            <div>
              <h4 className="text-[#ff3333] font-bold text-lg">Payment Failed (Action Required)</h4>
              <p className="text-gray-300 text-sm mt-1">We were unable to process your most recent invoice. Zeno operations may be suspended soon. Please update your payment method immediately via the Stripe Portal.</p>
            </div>
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-[#050805] border border-[#222] p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-widest flex items-center justify-between">
              Current Plan
              <span className={`px-2 py-0.5 rounded text-[10px] ${status === 'active' ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30' : 'bg-[#ff3333]/10 text-[#ff3333]'}`}>{status.toUpperCase()}</span>
            </div>
            <div>
              <div className="text-3xl font-black text-white capitalize">{plan}</div>
              <div className="text-gray-400 text-sm mt-1">${planFee} Baseline / mo</div>
            </div>
          </div>

          <div className="bg-[#0a150a] border border-[#00ff66]/30 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40 shadow-[0_0_20px_rgba(0,255,102,0.05)]">
            <div className="text-[#00ff66] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} /> Usage (Attr. Revenue)
            </div>
            <div>
              <div className="text-4xl font-black text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,102,0.3)]">${usageRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="text-gray-400 text-sm mt-1">Incremental revenue strictly tracked</div>
            </div>
          </div>

          <div className="bg-[#050805] border border-[#222] p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">
              Performance Share
            </div>
            <div>
              <div className="text-3xl font-black text-white">${totalCommission.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="text-gray-400 text-sm mt-1">At {commissionRate * 100}% agreement rate</div>
            </div>
          </div>

          <div className="bg-[#111116] border border-[#333] p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
            <div className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Receipt size={14} /> Current Total Due
            </div>
            <div>
              <div className="text-4xl font-black text-white">${totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="text-gray-500 text-xs mt-2 uppercase tracking-wide">Bills on: <span className="text-gray-300">{nextBillingDate}</span></div>
            </div>
          </div>

        </div>

        {/* INVOICE & SUPPORT ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-[#050505] border border-[#222] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2 border-b border-[#222] pb-4">
              <FileText size={20} className="text-gray-400" />
              Invoices & Documents
            </h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Full PDF invoices compliant with US/EU/UK tax logic are automatically generated by Stripe. You can download your entire billing history directly from the Stripe Portal.
            </p>
            <button
              onClick={handleOpenPortal} 
              className="px-6 py-2 bg-[#222] hover:bg-[#333] border border-[#444] rounded text-sm font-bold transition-colors flex items-center gap-2"
            >
              View Invoice History
            </button>
          </div>

          <div className="bg-[#050505] border border-[#222] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2 border-b border-[#222] pb-4">
              <Shield size={20} className="text-[#00ff66]" />
              Anti-Fraud Guarantee
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              We operate under a strict causal model. If the system calculates a negative or zero incremental lift over a session, usage metered value strictly logs as $0.00. Double counting and fraud are algorithmically impossible due to the RealityFingerprint engine.
            </p>
          </div>

        </div>

        {/* CTO AUDIT: LEGAL & BILLING TRANSPARENCY (LEDGER ROW) */}
        <div className="mt-8 bg-[#050505] border border-[#222] rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <div className="p-6 border-b border-[#222] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <FileText size={20} className="text-[#00ff66]" />
                Causal Attribution Ledger
              </h3>
              <p className="text-gray-500 text-sm mt-1">Line-by-line transparency. We only charge for what we provably earn.</p>
            </div>
            <div className="px-3 py-1 bg-[#111] border border-[#333] rounded-md text-xs font-mono text-gray-400">Validating limits (Max 60min)</div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0a0a0a] text-gray-500 font-mono text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-normal">Order ID</th>
                  <th className="px-6 py-4 font-normal">Time vs Popup</th>
                  <th className="px-6 py-4 font-normal">Order Value</th>
                  <th className="px-6 py-4 font-normal">Commission</th>
                  <th className="px-6 py-4 font-normal tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                <tr className="hover:bg-[#111] transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-300">#ORD-9912</td>
                  <td className="px-6 py-4 text-gray-400">+12 mins <span className="text-xs text-[#00ff66] ml-2 font-mono">[ACCEPTED]</span></td>
                  <td className="px-6 py-4 text-[#00ff66] font-bold">$140.00</td>
                  <td className="px-6 py-4 text-white">$28.00</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20 rounded text-xs">Synced</span></td>
                </tr>
                <tr className="hover:bg-[#111] transition-colors bg-[#0a0a0a]/50">
                  <td className="px-6 py-4 font-mono text-gray-500">#ORD-9913</td>
                  <td className="px-6 py-4 text-gray-500">+75 mins <span className="text-xs text-[#ff3333] ml-2 font-mono">[EXCEEDED]</span></td>
                  <td className="px-6 py-4 text-gray-500">$85.00</td>
                  <td className="px-6 py-4 text-gray-500 line-through">$17.00</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/20 rounded text-xs">Rejected - Outside Window</span></td>
                </tr>
                <tr className="hover:bg-[#111] transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-300">#ORD-9918</td>
                  <td className="px-6 py-4 text-gray-400">+4 mins <span className="text-xs text-[#00ff66] ml-2 font-mono">[ACCEPTED]</span></td>
                  <td className="px-6 py-4 text-[#00ff66] font-bold">$310.50</td>
                  <td className="px-6 py-4 text-white">$62.10</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20 rounded text-xs">Synced</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
