"use client";

const ACTION_LABELS: Record<string, string> = {
  do_nothing: "✋ Wait",
  urgency: "⏰ Urgency Nudge",
  popup_info: "💡 Info Popup",
  discount_5: "🎁 5% Discount",
  discount_10: "💰 10% Discount",
  discount_15: "🔥 15% Discount",
  free_shipping: "🚚 Free Shipping",
  bundle: "🎁 Bundle Deal",
};

type Props = {
  action: string | null;
  cvr: number;
  liftEst: string;
};

export default function TopActionCard({ action, cvr, liftEst }: Props) {
  const label = ACTION_LABELS[action ?? ""] ?? action ?? "—";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-6 hover:border-emerald-500/20 transition-all duration-300">
      {/* Background glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/[0.06] blur-3xl" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-indigo-500/[0.04] blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">🏆</span>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Winning Strategy
          </h3>
        </div>

        <div className="text-2xl font-bold text-white mb-4">{label}</div>

        <div className="flex items-center gap-6 mb-4">
          <div>
            <div className="text-3xl font-extrabold text-emerald-400">
              {cvr}%
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Conversion Rate</div>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <div className="text-lg font-bold text-indigo-400">{liftEst}</div>
            <div className="text-xs text-slate-400 mt-0.5">Est. Revenue Lift</div>
          </div>
        </div>

        <div className="text-xs text-slate-500 border-t border-white/[0.06] pt-3 mt-2">
          Based on all sessions with offers shown
        </div>
      </div>
    </div>
  );
}
