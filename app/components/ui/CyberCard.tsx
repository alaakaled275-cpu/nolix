"use client";

import { HTMLAttributes, useRef, useState } from "react";
import { motion } from "framer-motion";

interface CyberCardProps extends HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
  animateOnLoad?: boolean;
  delay?: number;
}

export function CyberCard({ 
  children, 
  className = "", 
  glowColor = "rgba(56, 189, 248, 0.15)", // Default Sky Blue glow
  animateOnLoad = true,
  delay = 0,
  ...props 
}: CyberCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const CardBody = (
    <div 
      ref={cardRef}
      className={`relative bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden group transition-colors duration-300 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      {...props}
    >
      {/* Soft Radial Hover Gradient Filter (Hardware Accelerated) */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
          zIndex: 0
        }}
      />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );

  if (animateOnLoad) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: delay * 0.1, ease: "easeOut" }}
        className="h-full"
      >
        {CardBody}
      </motion.div>
    );
  }

  return CardBody;
}
