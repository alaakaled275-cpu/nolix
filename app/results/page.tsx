"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ZenoAppShell } from "@/app/components/ZenoAppShell";
import { 
  Database, Globe, Calendar, ArrowRight, ShieldCheck, 
  Search, RefreshCw, BarChart, Trash2, Fingerprint
} from "lucide-react";

interface VaultEntry {
  url: string;
  business_model: string;
  created_at: string;
  confidence: number;
}

export default function RealityVaultPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/zeno/learning-log?limit=50")
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(data => {
        // Distill entries to unique URLs
        const unique = new Map();
        data.entries.forEach((e: any) => {
          if (!unique.has(e.url)) {
            unique.set(e.url, {
              url: e.url,
              business_model: e.business_model,
              created_at: e.created_at,
              confidence: e.confidence_after
            });
          }
        });
        setEntries(Array.from(unique.values()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e => 
    e.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.business_model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ZenoAppShell activeTab="analysis">
      <div className="p-10 max-w-6xl mx-auto animate-fade-in relative z-10 h-full flex flex-col">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 text-[#3fc8ff] text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
              <Database className="w-3 h-3" /> Zeno Intelligence Storage
            </div>
            <h1 className="text-white text-5xl font-black tracking-tight leading-none">Reality Vault</h1>
            <p className="text-white/40 text-sm mt-3 font-medium">Repository of all extracted reality fingerprints and causal updates.</p>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#3fc8ff] transition-colors" />
            <input 
              type="text" 
              placeholder="Search fingerprints..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white text-sm outline-none focus:border-[#3fc8ff]/30 transition-all focus:bg-white/[0.06] backdrop-blur-md"
            />
          </div>
        </div>

        {/* The Vault Table */}
        <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-2xl flex flex-col relative">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-8 py-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">Target Identity</th>
                  <th className="px-8 py-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">Business Model</th>
                  <th className="px-8 py-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">Confidence</th>
                  <th className="px-8 py-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">Last Extraction</th>
                  <th className="px-8 py-6 text-white/30 text-[10px] uppercase tracking-widest font-bold text-right pr-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <RefreshCw className="w-8 h-8 text-[#3fc8ff]/40 animate-spin mx-auto mb-4" />
                      <div className="text-white/20 text-sm font-medium">Synchronizing with Zeno Dimension...</div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <Fingerprint className="w-12 h-12 text-white/5 mx-auto mb-4" />
                      <div className="text-white/40 font-bold mb-1">No Realities Stored</div>
                      <div className="text-white/20 text-xs">Run a Terminal scan to capture your first fingerprint.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry, idx) => (
                    <tr key={idx} className="group hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => router.push(`/dashboard?url=${encodeURIComponent(entry.url)}`)}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#3fc8ff]/10 flex items-center justify-center border border-[#3fc8ff]/20">
                            <Globe className="w-4 h-4 text-[#3fc8ff]" />
                          </div>
                          <span className="text-white text-sm font-bold tracking-tight">{entry.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                         <span className="text-white/60 text-xs font-semibold px-3 py-1 bg-white/[0.05] rounded-full border border-white/10">{entry.business_model}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                              <div className="h-full bg-[#3fc8ff]" style={{ width: `${entry.confidence}%` }} />
                           </div>
                           <span className="text-white/80 text-[11px] font-bold font-mono">{entry.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-white/40 text-[11px] font-medium whitespace-nowrap font-mono">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6 text-right pr-12">
                        <button className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/20 group-hover:text-[#3fc8ff] group-hover:border-[#3fc8ff]/30 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-black/20 border-t border-white/[0.05] flex justify-between items-center shrink-0">
            <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
              Total Realities: {filtered.length}
            </div>
            <div className="text-white/20 text-[10px] font-medium italic">
              Zeno Master System · RealityVault v1.0
            </div>
          </div>

        </div>

        {/* Summary Overlay (Optional/Future) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
           <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
              <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest mb-1">Total Signals Stored</div>
              <div className="text-white text-2xl font-black">2.4M+</div>
           </div>
           <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
              <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest mb-1">Causal Accuracy</div>
              <div className="text-[#3fc8ff] text-2xl font-black">94.2%</div>
           </div>
           <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
              <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest mb-1">Active Fingerprints</div>
              <div className="text-white text-2xl font-black">{entries.length}</div>
           </div>
        </div>

      </div>
    </ZenoAppShell>
  );
}
