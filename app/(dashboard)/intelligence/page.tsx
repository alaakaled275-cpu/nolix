"use client";

import { useZenoDecisions, useZenoMetrics } from "@/lib/zeno-hooks";
import { CyberCard } from "@/app/components/ui/CyberCard";
import { DecisionExplanationPanel } from "@/app/components/ui/DecisionExplanationPanel";
import { StatRing } from "@/app/components/ui/StatRing";
import { BrainCircuit, Activity, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function IntelligencePage() {
  const { decisions, loading } = useZenoDecisions();
  const metrics = useZenoMetrics();

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-sky-400" />
          Neural Reasoning Core
        </h1>
        <p className="text-zinc-500 max-w-2xl text-[15px]">
          Live stream of causal decision logic. Monitor exactly how Zeno predicts user intent and executes interventions.
        </p>
      </div>

      {/* Holographic Metrics (Phase 4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <CyberCard className="p-8 flex items-center justify-between" glowColor="rgba(16, 185, 129, 0.15)" delay={1}>
           <div>
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">ML Contribution</div>
             <div className="text-3xl font-black text-white">{metrics.mlContribution}%</div>
           </div>
           <StatRing percentage={Math.round(metrics.mlContribution)} label="" color="#38bdf8" size={80} strokeWidth={6} />
        </CyberCard>
        
        <CyberCard className="p-8 flex items-center justify-between" glowColor="rgba(245, 158, 11, 0.15)" delay={2}>
           <div>
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Fallback Rules</div>
             <div className="text-3xl font-black text-white">{metrics.fallbackContribution}%</div>
           </div>
           <StatRing percentage={Math.round(metrics.fallbackContribution)} label="" color="#f59e0b" size={80} strokeWidth={6} />
        </CyberCard>
        
        <CyberCard className="p-8 flex items-center justify-between" glowColor="rgba(244, 63, 94, 0.15)" delay={3}>
           <div>
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Avg Latency</div>
             <div className="text-3xl font-black text-white">{metrics.avgLatencyMs}ms</div>
           </div>
           <div className="w-20 h-20 flex items-center justify-center">
             <Activity className="w-8 h-8 text-emerald-400" />
           </div>
        </CyberCard>
      </div>

      <h2 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
        <Zap className="w-4 h-4 text-sky-400" />
        Streaming Log <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded text-[10px]">LIVE</span>
      </h2>

      {/* Streaming Log Implementation (Virtualization / Max 20 items logic ready via hooks) */}
      <div className="space-y-4">
        {loading ? (
           <div className="h-64 flex items-center justify-center">
             <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
           </div>
        ) : (
           <AnimatePresence>
             {decisions.map((decision, index) => (
                <motion.div
                  key={decision.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  layout
                >
                  <DecisionExplanationPanel {...decision} />
                </motion.div>
             ))}
           </AnimatePresence>
        )}
      </div>
    </div>
  );
}
