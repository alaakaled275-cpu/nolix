"use client";

const INSIGHT_ICONS = ["🧠", "📊", "🎯", "💡", "🔍", "⚡", "🛡️", "📈"];

type Props = { insights: string[] };

export default function InsightsSection({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] backdrop-blur-xl p-5 hover:border-indigo-500/20 hover:bg-[rgba(20,20,36,0.8)] transition-all duration-300"
          style={{
            animationDelay: `${i * 80}ms`,
            animation: "fadeInUp 0.5s ease-out both",
          }}
        >
          {/* Gradient accent line */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-start gap-4 pl-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg">
              {INSIGHT_ICONS[i % INSIGHT_ICONS.length]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-400/70">
                  AI Insight
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400/60 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {insight}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
