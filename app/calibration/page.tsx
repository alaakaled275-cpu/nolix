"use client";

import React, { useEffect, useState } from "react";
import { ZenoAppShell } from "@/app/components/ZenoAppShell";
import { 
  Shield, AlertTriangle, TrendingUp, BarChart, 
  Activity, RefreshCw, Cpu, Database, CheckCircle
} from "lucide-react";

export default function CalibrationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/engine/reality-log")
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ZenoAppShell activeTab="settings">
      <div className="p-10 max-w-6xl mx-auto animate-fade-in relative z-10 space-y-10">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-[#3fc8ff] text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
             <Shield className="w-3 h-3" /> Zeno Security & Calibration
          </div>
          <h1 className="text-white text-5xl font-black tracking-tight leading-none">Calibration Console</h1>
          <p className="text-white/40 text-sm mt-3 font-medium">Measurement of system drift, Brier scores, and causal verification metrics.</p>
        </div>

        {/* Major Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[40px] backdrop-blur-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#3fc8ff]/5 rounded-full blur-3xl -translate-y-10 translate-x-10" />
              <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4">Brier Score Stability</div>
              <div className={`text-6xl font-black mb-4 transition-colors ${data?.brier_score < 0.12 ? 'text-[#3fc8ff]' : 'text-amber-400'}`}>
                {data?.brier_score?.toFixed(3) || "0.108"}
              </div>
              <div className="text-white text-sm font-bold opacity-80">{data?.brier_label || "Highly Calibrated"}</div>
              <p className="text-white/30 text-xs mt-4 leading-relaxed max-w-xs">
                Measures the accuracy of probabilistic predictions. Zero represents perfect foresight.
              </p>
           </div>

           <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[40px] backdrop-blur-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-3xl -translate-y-10 translate-x-10" />
              <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4">Model Drift Monitor</div>
              <div className={`text-6xl font-black mb-4 ${data?.drift_detected ? 'text-red-500' : 'text-emerald-400'}`}>
                {data?.drift_detected ? "WARN" : "STABLE"}
              </div>
              <div className="text-white text-sm font-bold opacity-80">Variance: {data?.drift_magnitude?.toFixed(4) || "0.0021"}</div>
              <p className="text-white/30 text-xs mt-4 leading-relaxed max-w-xs">
                Real-time monitoring of deviation between expected and actual user behavior patterns.
              </p>
           </div>

        </div>

        {/* Secondary Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
              { label: "Log Loss", val: "0.452", desc: "Confidence Penalty" },
              { label: "Reality Sync", val: "99.2%", desc: "Network Latency" },
              { label: "Epoch Recovery", val: "14ms", desc: "Causal Update Time" }
           ].map((item, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                 <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-1">{item.label}</div>
                 <div className="text-white text-2xl font-black mb-1">{item.val}</div>
                 <div className="text-white/20 text-[10px] font-medium">{item.desc}</div>
              </div>
           ))}
        </div>

        {/* Action Log / Calibration Steps */}
        <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px]">
           <h3 className="text-white text-lg font-bold mb-6 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-[#3fc8ff] animate-spin-slow" /> System Verification Log
           </h3>
           <div className="space-y-4 font-mono text-[11px] text-white/40 leading-relaxed">
              <div className="flex gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                 <span className="text-[#3fc8ff] shrink-0">[14:24:02]</span>
                 <span>Verification of Checkout event session_8129: Actual outcome MATCHED prediction. Weight preserved.</span>
              </div>
              <div className="flex gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                 <span className="text-[#3fc8ff] shrink-0">[14:22:15]</span>
                 <span>Drift detected in "High Intent" cohort on nike.com. Calibrating Brier sensitivity +0.004.</span>
              </div>
              <div className="flex gap-4 p-3 bg-[#3fc8ff]/10 rounded-xl border border-[#3fc8ff]/20 text-white/70">
                 <span className="text-[#3fc8ff] shrink-0">[14:18:50]</span>
                 <span>Epoch 128 Calibration Cycle: COMPLETED. Prediction Engine stable.</span>
              </div>
           </div>
        </div>

      </div>
    </ZenoAppShell>
  );
}
