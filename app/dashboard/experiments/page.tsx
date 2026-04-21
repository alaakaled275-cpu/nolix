"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ExperimentsDashboard() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/experiments/stats")
      .then(r => r.json())
      .then(d => {
        if (d.success) setExperiments(d.experiments);
        setLoading(false);
      });
  }, []);

  const handleDeclareWinner = async (expId: string, varId: string) => {
    if (!confirm(`Are you sure you want to promote ${varId} as the winner? The experiment will be stopped.`)) return;
    
    await fetch("/api/experiments/declare-winner", {
      method: "POST",
      body: JSON.stringify({ experiment_id: expId, variant_id: varId })
    });
    
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-center">
        <div>
           <Link href="/dashboard" className="text-zinc-500 hover:text-white mb-4 inline-block text-sm">
             ← Back to Main Dashboard
           </Link>
           <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
             A/B Experiment Engine
           </h1>
           <p className="text-zinc-400 text-sm mt-1">Self-Optimizing Revenue Intelligence.</p>
        </div>
        <button className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-md font-medium text-sm transition">
          + New Experiment
        </button>
      </header>

      {loading ? (
        <div className="text-zinc-500">Loading active experiments...</div>
      ) : experiments.length === 0 ? (
        <div className="text-center p-12 border border-white/5 border-dashed rounded-xl text-zinc-500">
           No experiments active. ZENO is acting purely on base rules and ML weights.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {experiments.map(exp => (
            <div key={exp.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex justify-between bg-black/40">
                <h2 className="font-medium text-lg flex items-center gap-2">
                  {exp.status === "active" ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-zinc-500" />}
                  {exp.name}
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-zinc-400 font-mono ml-2 uppercase">{exp.status}</span>
                </h2>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white/5 text-zinc-400 font-medium">
                    <tr>
                      <th className="p-4">Variant ID</th>
                      <th className="p-4">Assigned Traffic</th>
                      <th className="p-4">Conversions</th>
                      <th className="p-4">Conv. Rate</th>
                      <th className="p-4">Revenue Per User</th>
                      <th className="p-4">Total Revenue</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.keys(exp.stats).map(vid => {
                      const stat = exp.stats[vid];
                      return (
                         <tr key={vid} className="hover:bg-white/5 transition-colors">
                           <td className="p-4 font-mono text-purple-300">{vid}</td>
                           <td className="p-4">{stat.assigned} sessions</td>
                           <td className="p-4">{stat.conversions}</td>
                           <td className="p-4 font-mono">{(stat.conv_rate * 100).toFixed(2)}%</td>
                           <td className="p-4 text-emerald-400">${stat.rev_per_user.toFixed(2)}</td>
                           <td className="p-4 text-emerald-500 font-medium">${stat.revenue.toFixed(2)}</td>
                           <td className="p-4 text-right">
                             {exp.status === "active" && (
                               <button 
                                 onClick={() => handleDeclareWinner(exp.id, vid)}
                                 className="text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 px-3 py-1.5 rounded transition"
                               >
                                 Mark Winner
                               </button>
                             )}
                           </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
