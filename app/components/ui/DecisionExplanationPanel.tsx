import { BrainCircuit, Zap, ArrowUpRight } from "lucide-react";
import { DecisionBadge, DecisionState, RiskLevel } from "./DecisionBadge";

interface DecisionExplanationPanelProps {
  id: string;
  userState: "HESITATOR" | "BUYER_READY" | "UNKNOWN";
  intentScore: number; // 0-100
  confidence: number; // 0-100
  triggerReason: string;
  actionTaken: string;
  expectedUplift: string;
  actionState: DecisionState;
  riskLevel: RiskLevel;
  timestamp: string;
}

export function DecisionExplanationPanel({
  id,
  userState,
  intentScore,
  confidence,
  triggerReason,
  actionTaken,
  expectedUplift,
  actionState,
  riskLevel,
  timestamp
}: DecisionExplanationPanelProps) {
  return (
    <div className="w-full bg-[#0a0a0c] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
       {/* Background ambient pulse based on state */}
       <div className={`absolute -right-16 -top-16 w-32 h-32 blur-[60px] rounded-full pointer-events-none opacity-20 ${
          actionState === 'RETAINED' ? 'bg-emerald-500' : actionState === 'DISCOUNTED' ? 'bg-sky-500' : 'bg-amber-500'
       }`} />

       {/* Header Row */}
       <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded bg-[#111] border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
               <BrainCircuit className={`w-5 h-5 ${userState === 'HESITATOR' ? 'text-amber-400' : 'text-emerald-400'}`} />
             </div>
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <span className="font-mono text-sm font-bold text-white uppercase">{id}</span>
                 <span className="text-[10px] text-zinc-500 tracking-widest">{timestamp}</span>
               </div>
               <DecisionBadge state={actionState} confidence={confidence} risk={riskLevel} />
             </div>
          </div>
          
          <div className="flex items-center gap-3 bg-[#111] border border-white/5 rounded-lg px-3 py-2">
             <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-right">
                Intent Score<br />
                <span className={intentScore > 75 ? 'text-emerald-400 text-sm' : 'text-amber-400 text-sm'}>{intentScore}/100</span>
             </div>
             <div className="w-px h-6 bg-white/10" />
             <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-left">
                User State<br />
                <span className="text-white text-sm">{userState.replace("_", " ")}</span>
             </div>
          </div>
       </div>

       {/* Logic Row */}
       <div className="mt-6 pt-5 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Causal Trigger</h4>
               <p className="text-sm text-zinc-300 leading-relaxed font-mono bg-[#111] p-3 rounded-lg border border-white/5">
                 {triggerReason}
               </p>
             </div>
             <div className="flex flex-col justify-end">
               <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2 text-right">System Resolution</h4>
               <div className="flex items-center justify-between bg-[#111] p-3 rounded-lg border border-white/5">
                  <div className="text-sm font-bold text-white">{actionTaken}</div>
                  <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-2 py-0.5 rounded">
                     <ArrowUpRight className="w-3.5 h-3.5" /> {expectedUplift}
                  </div>
               </div>
             </div>
          </div>
       </div>
    </div>
  );
}
