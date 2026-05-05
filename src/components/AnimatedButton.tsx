import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AnimatedButtonProps {
  onClick: () => void | Promise<void>;
  label?: string;
  successLabel?: string;
  className?: string;
  isLoading?: boolean;
  isSuccess?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export default function AnimatedButton({
  onClick,
  label = "Send Report",
  successLabel = "Sent",
  className,
  isLoading = false,
  isSuccess = false,
  disabled = false,
  type = 'button'
}: AnimatedButtonProps) {
  const [localSuccess, setLocalSuccess] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setLocalSuccess(true);
    } else {
      setLocalSuccess(false);
    }
  }, [isSuccess]);

  const handleClick = async (e: React.MouseEvent) => {
    if (disabled || isLoading || localSuccess) return;
    if (type === 'button') {
      e.preventDefault();
      await onClick();
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading || localSuccess}
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden group transition-all duration-300",
        "h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] font-mono italic",
        localSuccess ? "bg-success text-white shadow-glow-green" : "bg-emergency text-white shadow-glow-red",
        (disabled || isLoading) && !localSuccess && "opacity-50 grayscale cursor-not-allowed",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {!isLoading && !localSuccess && (
          <motion.div
            key="label"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center justify-center gap-3"
          >
            <span className="relative z-10">{label}</span>
            <motion.div
              animate={{ 
                x: [0, 2, 0],
                rotate: [0, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Send className="w-4 h-4" />
            </motion.div>
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </motion.div>
        )}

        {localSuccess && (
          <motion.div
            key="success"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-center gap-3"
          >
            <span>{successLabel}</span>
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <Check className="w-4 h-4" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plane Flyoff Animation */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ 
              x: 200, 
              y: -100, 
              opacity: 0, 
              rotate: -20 
            }}
            transition={{ duration: 0.8, ease: "easeIn" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            <Send className="w-6 h-6 text-white/50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />
    </button>
  );
}
