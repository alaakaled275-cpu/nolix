import { ShieldCheck, Target, AlertTriangle, ShieldAlert } from "lucide-react";

export type DecisionState = "RETAINED" | "DISCOUNTED" | "HELD" | "AB_TEST";
export type RiskLevel = "LOW" | "MED" | "HIGH";

interface DecisionBadgeProps {
  state: DecisionState;
  confidence: number; // 0-100
  risk?: RiskLevel;
}

export function DecisionBadge({ state, confidence, risk }: DecisionBadgeProps) {
  const getBadgeStyle = () => {
    switch (state) {
      case "RETAINED": return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: ShieldCheck, label: "0% Retained" };
      case "DISCOUNTED": return { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", icon: Target, label: "Intervention" };
      case "HELD": return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: AlertTriangle, label: "Held Firm" };
      case "AB_TEST": return { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", icon: ShieldCheck, label: "A/B Explored" };
    }
  };

  const style = getBadgeStyle();
  const Icon = style.icon;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${style.text}`}>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${style.border} ${style.bg} font-mono font-bold text-xs shadow-inner uppercase`}>
        <Icon className="w-3.5 h-3.5" />
        {style.label}
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0a0a0c] border border-white/5 text-[10px] uppercase font-bold tracking-widest text-zinc-400">
        <span className="text-zinc-500">CONF:</span> 
        <span className={confidence > 80 ? 'text-emerald-400' : confidence > 50 ? 'text-amber-400' : 'text-rose-400'}>
          {confidence}%
        </span>
      </div>
      {risk && (
         <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0a0a0c] border border-white/5 text-[10px] uppercase font-bold tracking-widest`}>
            {risk === "HIGH" && <><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]" /><span className="text-rose-400">HIGH RISK</span></>}
            {risk === "MED" && <><span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]" /><span className="text-amber-400">MED RISK</span></>}
            {risk === "LOW" && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" /><span className="text-emerald-400">LOW RISK</span></>}
         </div>
      )}
    </div>
  );
}
