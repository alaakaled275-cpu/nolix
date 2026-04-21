"use client";

import { ShieldAlert, Fingerprint, Lock, Settings2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { GlowingButton } from "@/app/components/ui/GlowingButton";

export default function CalibrationPage() {
  const [isAdmin, setIsAdmin] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Mock State Mutation
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [roiThreshold, setRoiThreshold] = useState(3);
  const [abEnabled, setAbEnabled] = useState(true);
  const [purgeEnabled, setPurgeEnabled] = useState(true);

  const handleSave = () => {
    setSaving(true);
    // Simulate network latency / state mutation
    setTimeout(() => {
      setSaving(false);
      // In production, would push mutation to /api/engine/calibrate here
    }, 800);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in-up">
         <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
           <Lock className="w-10 h-10 text-rose-500" />
         </div>
         <h2 className="text-3xl font-black text-white mb-2">Access Restricted</h2>
         <p className="text-zinc-400 max-w-md">The calibration core requires Level 4 Admin clearance.</p>
         <button onClick={() => setIsAdmin(true)} className="mt-8 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest border-b border-zinc-500 pb-1">Override (Dev)</button>
      </div>
    );
  }

  // Pure CSS styled sliders for performance (no JS drag rendering lag)
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in-up">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-rose-500 mb-2 tracking-tight flex items-center gap-3">
          <Settings2 className="w-8 h-8" />
          Neural Configuration
        </h1>
        <p className="text-zinc-500 max-w-2xl text-[15px]">
          Modifying constraints directly impacts revenue boundaries. All mutations are strictly logged.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         <div className="xl:col-span-2 space-y-8">
            
            {/* Pricing Controls */}
            <div className={`bg-[#0a0a0c] border rounded-2xl p-8 transition-colors duration-300 ${maxDiscount > 20 ? 'border-rose-500/30 shadow-[0_0_40px_-10px_rgba(244,63,94,0.15)]' : 'border-white/5'}`}>
               <div className="flex items-center gap-3 mb-8">
                 <SlidersHorizontal className={maxDiscount > 20 ? "w-6 h-6 text-rose-400 animate-pulse" : "w-6 h-6 text-sky-400"} />
                 <h2 className="text-[13px] font-bold text-white tracking-widest uppercase">Pricing Constrictions</h2>
               </div>

               <div className="grid grid-cols-1 gap-10">
                 <div className="space-y-4">
                   <label className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest flex justify-between">
                     Safety Ceiling: Max Discount <span className={maxDiscount > 20 ? "text-rose-400" : "text-sky-400"}>{maxDiscount}%</span>
                   </label>
                   <input 
                     type="range" 
                     className="w-full h-2 bg-[#111] rounded-lg appearance-none cursor-pointer block style-range" 
                     min="0" max="30" step="1"
                     value={maxDiscount}
                     onChange={(e) => setMaxDiscount(parseInt(e.target.value))}
                     style={{
                        background: `linear-gradient(to right, ${maxDiscount > 20 ? '#f43f5e' : '#38bdf8'} ${maxDiscount * 3.33}%, #111 ${maxDiscount * 3.33}%)`
                     }}
                   />
                   <p className="text-[11px] text-zinc-500 mt-2 font-mono">WARNING: Values above 20% severely risk absolute margin erosion.</p>
                 </div>
                 
                 <div className="space-y-4">
                   <label className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest flex justify-between">
                     Hard ROI Threshold <span className="text-emerald-400">{roiThreshold.toFixed(1)}x</span>
                   </label>
                   <input 
                     type="range" 
                     className="w-full h-2 bg-[#111] rounded-lg appearance-none cursor-pointer block style-range" 
                     min="1" max="10" step="0.5" 
                     value={roiThreshold}
                     onChange={(e) => setRoiThreshold(parseFloat(e.target.value))}
                     style={{
                        background: `linear-gradient(to right, #10b981 ${(roiThreshold - 1) * 11.1}%, #111 ${(roiThreshold - 1) * 11.1}%)`
                     }}
                   />
                   <p className="text-[11px] text-zinc-500 mt-2 font-mono">Models predicting {"<"} {roiThreshold.toFixed(1)}x ROI will abort intervention and default to organic retention logic.</p>
                 </div>
               </div>
            </div>

            {/* Neural Matrix Controls */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-8">
               <div className="flex items-center gap-3 mb-8">
                 <Fingerprint className="w-6 h-6 text-emerald-400" />
                 <h2 className="text-[13px] font-bold text-white tracking-widest uppercase">Machine Learning Behavior</h2>
               </div>

               <div className="space-y-4">
                 <div className="flex items-center justify-between p-5 bg-[#111] border border-white/5 rounded-xl transition-colors hover:border-white/10">
                    <div>
                      <div className="font-bold text-[13px] text-white uppercase tracking-wider mb-1">Causal Exploration (A/B)</div>
                      <div className="text-xs text-zinc-500">Allocate 10% of traffic to random pricing nodes to train the model continuously.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} />
                      <div className="w-11 h-6 bg-black border border-white/10 rounded-full peer peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors">
                         <div className={`absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform ${abEnabled ? 'translate-x-full border-white' : ''}`}></div>
                      </div>
                    </label>
                 </div>

                 <div className="flex items-center justify-between p-5 bg-[#111] border border-white/5 rounded-xl transition-colors hover:border-white/10">
                    <div>
                      <div className="font-bold text-[13px] text-white uppercase tracking-wider mb-1">Polluted Data Auto-Purge</div>
                      <div className="text-xs text-zinc-500">Detect and ignore anomalous traffic profiles from corrupting prediction weightings.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={purgeEnabled} onChange={(e) => setPurgeEnabled(e.target.checked)} />
                      <div className="w-11 h-6 bg-black border border-white/10 rounded-full peer peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors">
                         <div className={`absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform ${purgeEnabled ? 'translate-x-full border-white' : ''}`}></div>
                      </div>
                    </label>
                 </div>
               </div>
            </div>

            <GlowingButton 
              variant="rose" 
              className="w-full text-[13px] py-5"
              isLoading={saving}
              onClick={handleSave}
            >
              ENFORCE NEURAL BOUNDARIES
            </GlowingButton>
         </div>

         {/* Sidebar: Audit Log */}
         <div className="bg-[#020202] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px] xl:h-auto">
            <div className="p-6 border-b border-white/5 bg-[#0a0a0c]">
               <h3 className="font-bold text-[12px] uppercase text-white flex items-center gap-2 tracking-widest">
                 <ShieldAlert className="w-4 h-4 text-emerald-400" /> Immutable Event Log
               </h3>
               <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest font-mono">Cryptographic change stream.</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-8 pb-12">
               {[
                 { id: 1, action: "Mutated Configurations", changes: `maxDiscount:${maxDiscount}%`, active: true },
                 { id: 2, admin: "Alex Rivera", action: "Decreased Max Discount", from: "20%", to: "15%", time: "2 hours ago" },
                 { id: 3, admin: "Elena M.", action: "Enabled Auto-Purge", from: "False", to: "True", time: "Yesterday" },
                 { id: 4, admin: "System", action: "Model Weights Re-Balanced", from: "v1.4.1", to: "v1.5.0", time: "3 days ago" },
               ].map((log, i) => (
                 <div key={log.id} className="relative pl-6 border-l border-white/5">
                    <div className={`absolute w-2 h-2 rounded-full -left-[5px] top-1.5 ${log.active ? 'bg-amber-400 shadow-[0_0_8px_#faba0b] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                    
                    {log.active ? (
                       <>
                         <div className="text-xs font-bold text-amber-400 mb-1">Uncommitted Changes Detected</div>
                         <div className="text-xs text-zinc-400 font-mono bg-[#111] p-2 rounded mt-2">{log.changes}</div>
                       </>
                    ) : (
                       <>
                         <div className="text-[13px] font-bold text-white mb-0.5">{log.action}</div>
                         <div className="text-[11px] text-zinc-500 font-mono mb-2">By <span className="text-sky-400">{log.admin}</span> <span className="px-1">•</span> {log.from} → {log.to}</div>
                         <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-600 border border-white/5 bg-[#0a0a0c] inline-block px-2 py-0.5 rounded">{log.time}</div>
                       </>
                    )}
                 </div>
               ))}
               <div className="relative pl-6 border-l border-white/5 border-dashed">
                 <div className="absolute w-2 h-2 border border-zinc-700 bg-black rounded-full -left-[5px] top-1.5" />
                 <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Genesis Initialized...</div>
               </div>
            </div>
         </div>

      </div>
      
      {/* Required CSS for custom slider thumb to override default styles cleanly without JS wrapper lag */}
      <style dangerouslySetInnerHTML={{__html: `
        .style-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: 2px solid #000;
        }
        .style-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: 2px solid #000;
        }
      `}} />
    </div>
  );
}
