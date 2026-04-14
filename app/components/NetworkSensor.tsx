"use client";

import { useState, useEffect } from 'react';

export function NetworkSensor() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="bg-[#0A0A0C] border border-white/10 p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-md w-full text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">Connection Lost</h2>
        <p className="text-slate-400 mb-8 leading-relaxed text-sm">
          Zeno Master System requires a stable connection to perform causal analysis and log reality events. Operations are temporarily paused.
        </p>
        
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
        >
          Re-establish Connection
        </button>
      </div>
    </div>
  );
}
