import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '../lib/utils';

interface TacticalCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glowColor?: string;
}

export default function TacticalCard({ 
  children, 
  className, 
  onClick,
  glowColor = "rgba(255, 59, 48, 0.5)" 
}: TacticalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Tilt animation values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { damping: 20, stiffness: 100 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { damping: 20, stiffness: 100 });

  function handleMouseMove(event: React.MouseEvent) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Normalize values between -0.5 and 0.5
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);

    glowX.set(mouseX);
    glowY.set(mouseY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative rounded-[32px] transition-all duration-300",
        "bg-[#161B26]/80 backdrop-blur-xl border border-white/5",
        "group cursor-pointer",
        className
      )}
    >
      {/* Glow Effect */}
      <motion.div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[32px]"
        style={{
          background: useTransform(
            [glowX, glowY],
            ([gx, gy]) => `radial-gradient(circle at ${gx}px ${gy}px, ${glowColor} 0%, transparent 70%)`
          )
        }}
      />

      {/* Cyberpunk Borders (Glitch Animation) */}
      <div className="absolute inset-0 rounded-[32px] border border-white/10 group-hover:border-white/20 transition-colors pointer-events-none" />
      
      {/* Glitch Corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-transparent group-hover:border-emergency/60 group-hover:animate-pulse transition-all" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-transparent group-hover:border-emergency/60 group-hover:animate-pulse transition-all" />

      {/* Light Sweep Effect */}
      <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
        <motion.div 
          animate={{ x: ['100%', '-100%'], opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
        />
      </div>

      {/* Content Container with 3d effect */}
      <div style={{ transform: "translateZ(30px)" }} className="relative z-10 w-full h-full">
        {children}
      </div>

      {/* Scanline pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </motion.div>
  );
}
