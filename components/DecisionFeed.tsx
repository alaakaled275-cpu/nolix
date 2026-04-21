"use client";

import Link from "next/link";
import type { ZenoEvent } from "@/lib/nolix-event-types";

export default function DecisionFeed({ events }: { events: ZenoEvent[] }) {
  return (
    <div className="flex flex-col gap-3">
      {events.filter(e => e.type === "DECISION_MADE").map((e) => (
        <div key={e.id} className="border border-white/5 p-4 rounded-lg bg-black/40 backdrop-blur-md text-white">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-zinc-400">TRACE: {e.trace_id.slice(0,8)}</span>
            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-white">{e.type}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
            <div>
              <div className="text-zinc-500 uppercase text-[10px] tracking-wider">Action Selected</div>
              <div className="font-semibold text-emerald-400">{e.payload?.action?.toUpperCase() || "UNKNOWN"}</div>
            </div>
            <div>
              <div className="text-zinc-500 uppercase text-[10px] tracking-wider">Final Score</div>
              <div className="font-mono text-blue-400">{e.payload?.final_score?.toFixed(3)}</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
            <Link 
              href={`/dashboard/trace/${e.trace_id}`} 
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Inspect Trace →
            </Link>
          </div>
        </div>
      ))}
      
      {events.length === 0 && (
        <div className="text-center p-8 text-zinc-500 border border-white/5 border-dashed rounded-lg">
          Waiting for neural activity...
        </div>
      )}
    </div>
  );
}
