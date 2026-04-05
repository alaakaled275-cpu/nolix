"use client";

import type { Session } from "../types";

const INTENT_STYLES: Record<string, string> = {
  high: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-red-400 bg-red-400/10 border-red-400/20",
};

const ACTION_LABELS: Record<string, string> = {
  do_nothing: "✋ Wait",
  urgency: "⏰ Urgency",
  popup_info: "💡 Info",
  discount_5: "🎁 5% Off",
  discount_10: "💰 10% Off",
  discount_15: "🔥 15% Off",
  free_shipping: "🚚 Free Ship",
  bundle: "🎁 Bundle",
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt$(n: number | null) {
  if (!n || n === 0) return "—";
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

type Props = { sessions: Session[] };

export default function SessionsTable({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-12 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <p className="text-slate-400 text-sm">No sessions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Time
              </th>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Intent
              </th>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Action
              </th>
              <th className="text-center py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Converted
              </th>
              <th className="text-right py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Revenue
              </th>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[280px]">
                Business Explanation
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr
                key={s.id}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-200"
                style={{
                  animation: `fadeInUp 0.3s ease-out ${i * 30}ms both`,
                }}
              >
                <td className="py-3.5 px-5 text-slate-300 whitespace-nowrap">
                  {timeAgo(s.created_at)}
                </td>
                <td className="py-3.5 px-5">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
                      INTENT_STYLES[s.intent_level] || "text-slate-400 bg-slate-400/10 border-slate-400/20"
                    }`}
                  >
                    {s.intent_level} · {s.intent_score}
                  </span>
                </td>
                <td className="py-3.5 px-5 text-slate-300 whitespace-nowrap">
                  {ACTION_LABELS[s.action_taken ?? s.offer_type ?? ""] ?? "—"}
                </td>
                <td className="py-3.5 px-5 text-center">
                  {s.converted ? (
                    <span className="text-emerald-400 font-medium">✅</span>
                  ) : (
                    <span className="text-slate-500">❌</span>
                  )}
                </td>
                <td className="py-3.5 px-5 text-right font-medium">
                  <span className={s.order_value ? "text-emerald-400" : "text-slate-500"}>
                    {fmt$(s.order_value)}
                  </span>
                </td>
                <td className="py-3.5 px-5 text-slate-400 text-xs leading-relaxed max-w-xs">
                  {s.business_explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
