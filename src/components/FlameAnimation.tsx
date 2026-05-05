import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface FlameAnimationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FlameAnimation({ className, size = 'md' }: FlameAnimationProps) {
  const sizes = {
    sm: 'w-16 h-24',
    md: 'w-32 h-48',
    lg: 'w-48 h-64'
  };

  // Generate random stats for flames
  const particles = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    size: Math.random() * 40 + 20,
    x: Math.random() * 60 - 30,
    delay: Math.random() * 2,
    duration: Math.random() * 1.5 + 1,
    opacity: Math.random() * 0.5 + 0.3
  }));

  return (
    <div className={cn("relative flex items-end justify-center overflow-hidden", sizes[size], className)} style={{ filter: 'url(#gooey-fire)' }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-gradient-to-t from-emergency via-warning to-caution"
          style={{
            width: p.size,
            height: p.size,
            left: `calc(50% + ${p.x}px)`,
            opacity: p.opacity,
          }}
          animate={{
            y: [-10, -150],
            scale: [1, 0],
            x: [p.x, p.x + (Math.random() * 40 - 20)],
            opacity: [p.opacity, 0]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeOut"
          }}
        />
      ))}

      {/* SVG filter for the gooey effect */}
      <svg className="hidden">
        <defs>
          <filter id="gooey-fire">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 35 -15" 
              result="goo" 
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
