import { cn } from '../lib/utils';

/* ── LOGO SVG COMPONENT ───────────────────────────────────── */
export function TanodLogo({ size = 200, animated = true, className }: { size?: number, animated?: boolean, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 460" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id="logoBackground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0f16" />
          <stop offset="100%" stopColor="#020406" />
        </radialGradient>
        <linearGradient id="shieldBorder" x1="0" y1="0" x2="400" y2="460">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <filter id="textGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="shieldShape">
          <path d="M200 10 L380 60 L380 280 C380 380 200 450 200 450 C200 450 20 380 20 280 L20 60 L200 10Z" />
        </clipPath>
      </defs>

      {/* Shadow */}
      <path d="M200 20 L385 70 L385 290 C385 390 200 460 200 460 C200 460 15 390 15 290 L15 70 L200 20Z" fill="black" opacity="0.4" filter="blur(8px)" />

      {/* Main Shield Body */}
      <path d="M200 10 L380 60 L380 280 C380 380 200 450 200 450 C200 450 20 380 20 280 L20 60 L200 10Z" fill="url(#logoBackground)" stroke="url(#shieldBorder)" strokeWidth="8" />

      {/* Tactical Texture (Hexagons) */}
      <g clipPath="url(#shieldShape)" opacity="0.08">
        {[...Array(12)].map((_, r) => (
          [...Array(12)].map((_, c) => (
            <path key={`${r}-${c}`} d={`M${c * 40 + (r % 2 ? 20 : 0)} ${r * 35} l20 0 l10 17 l-10 17 l-20 0 l-10 -17 z`} fill="none" stroke="#475569" strokeWidth="1" />
          ))
        ))}
      </g>

      {/* Philippine Sun & Stars */}
      <g transform="translate(200, 85)">
        {/* Sun */}
        <circle r="22" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
        {[...Array(8)].map((_, i) => (
          <path key={i} d="M0 -32 L4 -24 L-4 -24 Z" fill="#fbbf24" transform={`rotate(${i * 45})`} />
        ))}
        {/* 3 Stars */}
        <path d="M0 -65 l5 15 l15 0 l-12 10 l5 15 l-13 -10 l-13 10 l5 -15 l-12 -10 l15 0 z" fill="#f59e0b" transform="scale(0.4) translate(0, -10)" />
        <path d="M0 -65 l5 15 l15 0 l-12 10 l5 15 l-13 -10 l-13 10 l5 -15 l-12 -10 l15 0 z" fill="#f59e0b" transform="scale(0.4) translate(-100, 30) rotate(-30)" />
        <path d="M0 -65 l5 15 l15 0 l-12 10 l5 15 l-13 -10 l-13 10 l5 -15 l-12 -10 l15 0 z" fill="#f59e0b" transform="scale(0.4) translate(100, 30) rotate(30)" />
      </g>

      {/* TEXT AREA */}
      <text x="200" y="165" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="28" fill="#94a3b8" letterSpacing="4">BRGY.</text>
      <text x="200" y="240" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="72" fill="white" filter="url(#textGlow)">TANOD</text>
      <text x="200" y="325" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="84" fill="#ef4444" filter="url(#textGlow)">S.O.S.</text>

      {/* BOTTOM ICONS */}
      <g transform="translate(100, 375)">
        {/* Shield Icon (Blue) */}
        <g transform="translate(0, 0)">
          <path d="M25 0 L45 8 L45 25 Q45 38 25 45 Q5 38 5 25 L5 8 Z" fill="#3b82f6" />
          <path d="M25 15 l3 8 l8 0-6 5 2 8-7-5-7 5 2-8-6-5 8 0z" fill="white" transform="scale(0.4) translate(37, 25)" />
        </g>
        {/* Radio Tower (Red) */}
        <g transform="translate(85, 0)">
          <path d="M25 5 L15 40 L35 40 Z" stroke="#ef4444" strokeWidth="3" fill="none" />
          <circle cx="25" cy="5" r="3" fill="#ef4444" />
          <path d="M15 15 Q5 15 5 5" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.6" transform="translate(0, 0)" />
          <path d="M35 15 Q45 15 45 5" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.6" />
        </g>
        {/* People (Green) */}
        <g transform="translate(160, 5)">
          <circle cx="25" cy="12" r="8" fill="#22c55e" />
          <path d="M10 40 Q25 25 40 40" fill="#22c55e" />
          <circle cx="15" cy="18" r="6" fill="#16a34a" />
          <path d="M5 38 Q15 28 25 38" fill="#16a34a" />
          <circle cx="35" cy="18" r="6" fill="#16a34a" />
          <path d="M25 38 Q35 28 45 38" fill="#16a34a" />
        </g>
      </g>

      {/* Animated Scan Line */}
      {animated && (
        <line x1="20" y1="0" x2="380" y2="0" stroke="#ef4444" strokeWidth="2" opacity="0.3">
          <animateTransform attributeName="transform" type="translate" from="0 60" to="0 380" dur="4s" repeatCount="indefinite" />
        </line>
      )}
    </svg>
  );
}

/* ── FULL WORDMARK COMPONENT ──────────────────────────────── */
export function TanodWordmark({ width = 480, className }: { width?: number, className?: string }) {
  return (
    <div className={cn("flex items-center gap-6", className)} style={{ width }}>
      <TanodLogo size={80} animated={false} />
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono text-white/50 uppercase tracking-[0.4em]">BARANGAY</span>
          <span className="px-2 py-0.5 rounded bg-brand-red text-[10px] font-black text-white uppercase tracking-widest">S.O.S.</span>
        </div>
        <h1 className="text-4xl font-black italic text-white tracking-tighter uppercase font-mono leading-none mt-1 group">
          TANOD<span className="text-brand-red group-hover:text-white transition-colors">NET</span>
        </h1>
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em] mt-2">EMERGENCY INTELLIGENCE SYSTEM</p>
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
      <TanodLogo size={size * 0.8} animated={false} />
    </div>
  );
}
