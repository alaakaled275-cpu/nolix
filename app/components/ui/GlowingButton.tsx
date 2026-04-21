"use client";

import { ButtonHTMLAttributes } from "react";

interface GlowingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "emerald" | "sky" | "rose" | "amber";
  isLoading?: boolean;
}

export function GlowingButton({ 
  children, 
  variant = "emerald", 
  isLoading = false,
  className = "", 
  disabled,
  ...props 
}: GlowingButtonProps) {
  
  const colors = {
    emerald: "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]",
    sky: "bg-sky-500 hover:bg-sky-400 text-black shadow-[0_0_20px_-5px_rgba(56,189,248,0.5)]",
    rose: "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]",
    amber: "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_-5px_rgba(245,158,11,0.5)]",
  };

  const isActuallyDisabled = disabled || isLoading;

  return (
    <button 
      disabled={isActuallyDisabled}
      className={`relative font-black tracking-wide rounded-xl py-3.5 px-6 overflow-hidden group transition-all duration-300 ${colors[variant]} ${isActuallyDisabled ? "opacity-70 cursor-not-allowed scale-100" : "hover:scale-[1.02]"} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <><div className={`w-4 h-4 border-2 rounded-full border-t-transparent animate-spin ${variant === 'rose' ? 'border-white' : 'border-black'}`} /> PROCESSING...</>
        ) : children}
      </span>
      {/* CSS-only Shimmer Effect */}
      {!isActuallyDisabled && (
         <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shimmer pointer-events-none" />
      )}
    </button>
  );
}
