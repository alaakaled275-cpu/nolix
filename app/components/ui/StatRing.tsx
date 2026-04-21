"use client";

import { motion } from "framer-motion";

interface StatRingProps {
  percentage: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function StatRing({ 
  percentage, 
  label, 
  sublabel, 
  color = "#10b981", 
  size = 120, 
  strokeWidth = 8 
}: StatRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Background track */}
        <svg fill="none" width={size} height={size} className="transform -rotate-90 origin-center absolute">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Animated Progress Ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} // Hex + alpha hack
          />
        </svg>
        {/* Inner Text */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-black text-white">{percentage}%</span>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="mt-3 text-center">
          {label && <div className="text-xs font-bold text-white uppercase tracking-wider">{label}</div>}
          {sublabel && <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{sublabel}</div>}
        </div>
      )}
    </div>
  );
}
