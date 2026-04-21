"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TraceInspectorPage() {
  const params = useParams();
  const traceId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    fetch(`/api/observability/trace?trace_id=${traceId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
      });
  }, [traceId]);

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const res = await fetch(`/api/engine/replay-v2?trace_id=${traceId}&mode=COMPARISON`);
      const payload = await res.json();
      setReplayResult(payload.data);
    } finally {
      setReplaying(false);
    }
  };

  if (!data) return <div className="p-8 text-white">Loading trace cortex...</div>;

  const events = data.events || [];
  const decisionEvent = events.find((e: any) => e.type === "DECISION_MADE");

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <Link href="/dashboard" className="text-zinc-500 hover:text-white mb-6 inline-block text-sm">
        ← Back to Dashboard
      </Link>
      
      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-semibold">Trace Inspector</h1>
          <p className="text-zinc-500 font-mono text-sm mt-1">{traceId}</p>
        </div>
        <button 
          onClick={handleReplay}
          disabled={replaying}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {replaying && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
          Re-run Brain Simulation
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* EVENT TIMELINE */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Neural Event Timeline</h2>
          <div className="flex flex-col gap-4">
            {events.map((e: any, i: number) => (
              <div key={e.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  {i < events.length - 1 && <div className="w-px h-full bg-white/10 mt-2"></div>}
                </div>
                <div className="pb-4">
                  <div className="text-sm font-mono text-emerald-400">{e.type}</div>
                  <pre className="mt-2 text-[10px] text-zinc-400 bg-black/40 p-3 rounded-md overflow-x-auto max-w-sm border border-white/5">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* METRICS & REPLAY OUTCOME */}
        <div className="flex flex-col gap-6">
          {data.metrics && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-medium mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-zinc-500 text-xs">Latency</div>
                  <div className="text-xl font-mono">{data.metrics.latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs">ML Boost</div>
                  <div className="text-xl font-mono text-blue-400">+{data.metrics.ml_contribution.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs">Rules Hit</div>
                  <div className="text-xl font-mono">{data.metrics.rule_hits}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs">Expected ROI Ratio</div>
                  <div className="text-xl font-mono text-emerald-400">{data.metrics.economic_ratio}x</div>
                </div>
              </div>
            </div>
          )}

          {replayResult && (
            <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6">
              <h2 className="text-lg font-medium text-blue-400 mb-4">Re-execution Result</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
                  <span className="text-zinc-400 text-sm">Mode</span>
                  <span className="font-mono text-blue-300 text-sm">{replayResult.replay_mode}</span>
                </div>
                <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
                  <span className="text-zinc-400 text-sm">Original Action</span>
                  <span className="font-mono text-white text-sm bg-white/10 px-2 py-0.5 rounded">{replayResult.original_decision.action}</span>
                </div>
                <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
                  <span className="text-zinc-400 text-sm">New Action (Current Brain)</span>
                  <span className="font-mono text-emerald-400 text-sm bg-emerald-500/10 px-2 py-0.5 rounded">{replayResult.new_decision?.action || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-sm block mb-2">Drift Classification</span>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                    replayResult.drift === "STABLE" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {replayResult.drift}
                  </span>
                </div>
                {replayResult.explanation && (
                  <div className="mt-4 text-xs text-zinc-300 whitespace-pre-line bg-black/40 p-4 rounded-md border border-white/5">
                    {replayResult.explanation.summary}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
