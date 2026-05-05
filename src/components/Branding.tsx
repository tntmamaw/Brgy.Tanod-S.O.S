import { cn } from '../lib/utils';

/* ── LOGO IMAGE COMPONENT ─────────────────────────────────── */
export function TanodLogo({ size = 200, animated = true, className }: { size?: number, animated?: boolean, className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <img 
        src="/logo_official.png" 
        alt="Brgy. Tanod S.O.S. Logo" 
        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-transform hover:scale-105 duration-500"
      />
    </div>
  );
}

/* ── FULL WORDMARK COMPONENT ──────────────────────────────── */
export function TanodWordmark({ width = 480, className }: { width?: number, className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)} style={{ width }}>
      <img src="/logo_official.png" alt="Logo" className="h-16 w-16 object-contain" />
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-brand-red uppercase tracking-[0.4em] opacity-80">BRGY. TANOD</span>
          <span className="px-1.5 py-0.5 rounded bg-brand-red text-[8px] font-black text-white uppercase tracking-widest">S.O.S.</span>
        </div>
        <h1 className="text-3xl font-black italic text-white tracking-tighter uppercase font-mono leading-none mt-1">COMMAND NET</h1>
        <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.25em] mt-2">BARANGAY EMERGENCY INTELLIGENCE SYSTEM</p>
      </div>
    </div>
  );
}

/* ── BACKGROUND SVG PATTERN ───────────────────────────────── */
export function BackgroundPattern() {
  const HEX_SIZE = 28;
  const cols = 30, rows = 22;
  const hexPoints = (cx: number, cy: number, r: number) => {
    return [...Array(6)].map((_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
  };

  const hexagons = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * HEX_SIZE * 1.73 + (row % 2 === 0 ? 0 : HEX_SIZE * 0.866);
      const y = row * HEX_SIZE * 1.5;
      const distFromCenter = Math.hypot(x - 760, y - 430) / 600;
      const opacity = Math.max(0.01, 0.07 - distFromCenter * 0.06);
      hexagons.push({ x, y, opacity, id: `${row}-${col}` });
    }
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 1520 860"
      xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 pointer-events-none">
      <defs>
        <radialGradient id="bgGlowCenter" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef444408" />
          <stop offset="60%" stopColor="#ef444403" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="bgGlowTopLeft" cx="0%" cy="0%" r="50%">
          <stop offset="0%" stopColor="#1e3a5f18" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="bgGlowBottomRight" cx="100%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#7f1d1d12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="bgBlur">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Base glow layers */}
      <rect width="1520" height="860" fill="url(#bgGlowCenter)" />
      <rect width="1520" height="860" fill="url(#bgGlowTopLeft)" />
      <rect width="1520" height="860" fill="url(#bgGlowBottomRight)" />

      {/* Hex grid */}
      {hexagons.map(h => (
        <polygon key={h.id}
          points={hexPoints(h.x, h.y, HEX_SIZE * 0.9)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="0.5"
          opacity={h.opacity}
        />
      ))}

      {/* Horizontal scan lines */}
      {[...Array(43)].map((_, i) => (
        <line key={`h${i}`}
          x1="0" y1={i * 20} x2="1520" y2={i * 20}
          stroke="#3b82f6" strokeWidth="0.3" opacity="0.025" />
      ))}

      {/* Vertical scan lines */}
      {[...Array(77)].map((_, i) => (
        <line key={`v${i}`}
          x1={i * 20} y1="0" x2={i * 20} y2="860"
          stroke="#3b82f6" strokeWidth="0.3" opacity="0.018" />
      ))}

      {/* Radar rings */}
      {[120, 220, 320, 440, 580].map((r, i) => (
        <circle key={`ring${i}`}
          cx="760" cy="430" r={r}
          fill="none" stroke="#ef4444"
          strokeWidth="0.6"
          opacity={0.06 - i * 0.01}
          strokeDasharray={i % 2 === 0 ? "none" : "4 8"}
        />
      ))}

      {/* Cross-hairs */}
      <line x1="760" y1="290" x2="760" y2="570" stroke="#ef4444" strokeWidth="0.8" opacity="0.08" />
      <line x1="620" y1="430" x2="900" y2="430" stroke="#ef4444" strokeWidth="0.8" opacity="0.08" />

      {/* Corner bracket decorations */}
      {/* TL */}
      <path d="M20 20 L20 60 L60 60" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      <path d="M20 20 L60 20" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      {/* TR */}
      <path d="M1500 20 L1500 60 L1460 60" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      <path d="M1500 20 L1460 20" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      {/* BL */}
      <path d="M20 840 L20 800 L60 800" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      <path d="M20 840 L60 840" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      {/* BR */}
      <path d="M1500 840 L1500 800 L1460 800" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />
      <path d="M1500 840 L1460 840" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.25" />

      {/* Circuit paths */}
      <path d="M0 200 L200 200 L220 220 L400 220 L420 200 L600 200"
        stroke="#ef4444" strokeWidth="0.8" opacity="0.06" fill="none" />
      <path d="M0 660 L180 660 L200 640 L380 640 L400 660 L560 660"
        stroke="#3b82f6" strokeWidth="0.8" opacity="0.06" fill="none" />
      <path d="M1100 0 L1100 160 L1120 180 L1120 320 L1100 340 L1100 500"
        stroke="#ef4444" strokeWidth="0.8" opacity="0.06" fill="none" />
    </svg>
  );
}

/* ── APP ICON COMPONENT ──────────────────────────────────── */
export function AppIcon({ size = 64, className }: { size?: number, className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center bg-[#0d0505] rounded-2xl border border-brand-red/20 overflow-hidden shadow-lg", className)} style={{ width: size, height: size }}>
      <img 
        src="/logo_official.png" 
        alt="App Icon" 
        className="w-[85%] h-[85%] object-contain"
      />
    </div>
  );
}
