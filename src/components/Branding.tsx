import { cn } from '../lib/utils';

/* ── LOGO SVG COMPONENT ───────────────────────────────────── */
export function TanodLogo({ size = 200, animated = true, className }: { size?: number, animated?: boolean, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id="shieldGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#1a0a0a" />
          <stop offset="100%" stopColor="#0a0505" />
        </radialGradient>
        <radialGradient id="glowRed" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glowAmber" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="topEdge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
          <stop offset="30%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="70%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="shieldClip">
          <path d="M100 18 L168 42 L168 95 Q168 145 100 178 Q32 145 32 95 L32 42 Z" />
        </clipPath>
      </defs>

      {/* ── OUTER GLOW HALO ── */}
      <ellipse cx="100" cy="100" rx="80" ry="80" fill="url(#glowRed)" />

      {/* ── SHIELD BODY ── */}
      <path
        d="M100 18 L168 42 L168 95 Q168 145 100 178 Q32 145 32 95 L32 42 Z"
        fill="url(#shieldGrad)"
        stroke="url(#shieldStroke)"
        strokeWidth="2.5"
        filter="url(#glow)"
      />

      {/* ── SHIELD INNER BEVEL ── */}
      <path
        d="M100 26 L160 47 L160 95 Q160 140 100 169 Q40 140 40 95 L40 47 Z"
        fill="none"
        stroke="#ef444422"
        strokeWidth="1"
      />

      {/* ── INNER DECORATIVE LINES (tactical cuts) ── */}
      <path d="M100 26 L100 169" stroke="#ef444415" strokeWidth="0.75" />
      <path d="M40 95 L160 95" stroke="#ef444415" strokeWidth="0.75" />

      {/* ── TOP HORIZONTAL ACCENT LINE ── */}
      <line x1="55" y1="60" x2="145" y2="60"
        stroke="url(#topEdge)" strokeWidth="1" opacity="0.6" />

      {/* ── PHILIPPINE SUN (8 rays) ── */}
      <g transform="translate(100, 96)" filter="url(#softGlow)">
        {/* Sun rays */}
        {[...Array(8)].map((_, i) => {
          const angle = (i * 45 * Math.PI) / 180;
          const x1 = Math.cos(angle) * 13;
          const y1 = Math.sin(angle) * 13;
          const x2 = Math.cos(angle) * 22;
          const y2 = Math.sin(angle) * 22;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
              opacity="0.9"
            />
          );
        })}
        {/* Sun circle */}
        <circle cx="0" cy="0" r="10" fill="url(#sunGrad)" />
        <circle cx="0" cy="0" r="5" fill="#fde68a" opacity="0.9" />
      </g>

      {/* S.O.S TEXT (Secondary) */}
      <text
        x="100" y="137"
        fontFamily="'Space Mono', monospace"
        fontSize="14"
        fontWeight="700"
        fill="#ef4444"
        textAnchor="middle"
        letterSpacing="8"
        filter="url(#strongGlow)"
      >TANODNET</text>

      {/* ── CORNER BRACKET MARKS (tactical) ── */}
      <path d="M38 36 L38 30 L44 30" stroke="#ef444466" strokeWidth="1.5" fill="none" />
      <path d="M162 36 L162 30 L156 30" stroke="#ef444466" strokeWidth="1.5" fill="none" />
      <path d="M38 164 L38 170 L44 170" stroke="#ef444466" strokeWidth="1.5" fill="none" />
      <path d="M162 164 L162 170 L156 170" stroke="#ef444466" strokeWidth="1.5" fill="none" />

      {/* ── BOTTOM STATUS BAR ── */}
      <rect x="60" y="155" width="80" height="14" rx="3"
        fill="#ef444418" stroke="#ef444433" strokeWidth="0.75" />
      <text x="100" y="165"
        fontFamily="'Space Mono', monospace"
        fontSize="6.5" fontWeight="700"
        fill="#ef4444" textAnchor="middle"
        letterSpacing="2">AI NETWORK</text>

      {/* ── ANIMATED PING RING (outer) ── */}
      {animated && (
        <circle cx="100" cy="100" r="88" fill="none"
          stroke="#ef4444" strokeWidth="1" opacity="0.15"
          className="animate-[logo-ping_3s_ease-out_infinite]"
        />
      )}
    </svg>
  );
}

/* ── FULL WORDMARK SVG ────────────────────────────────────── */
export function TanodWordmark({ width = 480, className }: { width?: number, className?: string }) {
  return (
    <svg width={width} height={Math.round(width * 0.28)} viewBox="0 0 480 134" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="wmRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="wmWhiteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <filter id="wmGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Shield icon compact */}
      <path d="M30 8 L58 18 L58 46 Q58 68 30 80 Q2 68 2 46 L2 18 Z"
        fill="#0f0505" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M30 8 L30 80" stroke="#ef444420" strokeWidth="0.75" />
      <path d="M2 46 L58 46" stroke="#ef444420" strokeWidth="0.75" />
      {/* mini sun */}
      {[...Array(8)].map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return <line key={i} x1={30 + Math.cos(a)*9} y1={40 + Math.sin(a)*9}
          x2={30 + Math.cos(a)*15} y2={40 + Math.sin(a)*15}
          stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      <circle cx="30" cy="40" r="7" fill="#f59e0b" />
      <circle cx="30" cy="40" r="3.5" fill="#fde68a" />
      {/* SOS mini */}
      <text x="30" y="65" fontFamily="'Space Mono', monospace" fontSize="9" fontWeight="700"
        fill="#ef4444" textAnchor="middle" letterSpacing="2" filter="url(#wmGlow)">SOS</text>

      {/* Vertical divider */}
      <line x1="72" y1="12" x2="72" y2="82" stroke="#ef444430" strokeWidth="1" />

      {/* BRGY. label */}
      <text x="82" y="30" fontFamily="'Space Mono', monospace" fontSize="9" fontWeight="400"
        fill="#ef4444" letterSpacing="4" opacity="0.8">SYSTEM</text>

      {/* TANOD main text */}
      <text x="80" y="68" fontFamily="'Space Mono', monospace" fontSize="42" fontWeight="700"
        fill="url(#wmWhiteGrad)" letterSpacing="4">TANODNET</text>

      {/* S.O.S accent */}
      <text x="80" y="90" fontFamily="'Space Mono', monospace" fontSize="16" fontWeight="700"
        fill="url(#wmRedGrad)" letterSpacing="8" filter="url(#wmGlow)">INTELLIGENCE · AI</text>

      {/* Tagline */}
      <text x="80" y="110" fontFamily="'Space Mono', monospace" fontSize="7.5" fontWeight="400"
        fill="#64748b" letterSpacing="3">BARANGAY EMERGENCY INTELLIGENCE SYSTEM</text>

      {/* Right decorative bracket */}
      <path d="M466 12 L472 12 L472 82 L466 82" stroke="#ef444430" strokeWidth="1" fill="none" />
      {/* Status dot */}
      <circle cx="462" cy="47" r="4" fill="#22c55e" opacity="0.8" />
      <circle cx="462" cy="47" r="8" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.3" />
    </svg>
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

export function AppIcon({ size = 64, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="64" height="64" rx="14" fill="#0d0505" />
      <rect width="64" height="64" rx="14" fill="none" stroke="#ef444433" strokeWidth="1.5" />
      <path d="M32 6 L54 14 L54 31 Q54 48 32 58 Q10 48 10 31 L10 14 Z"
        fill="#120808" stroke="#ef4444" strokeWidth="1.5" />
      {[...Array(8)].map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return <line key={i} x1={32 + Math.cos(a)*8} y1={29 + Math.sin(a)*8}
          x2={32 + Math.cos(a)*13} y2={29 + Math.sin(a)*13}
          stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      <circle cx="32" cy="29" r="6" fill="#f59e0b" />
      <circle cx="32" cy="29" r="3" fill="#fde68a" />
      <text x="32" y="48" fontFamily="'Space Mono', monospace" fontSize="7" fontWeight="700"
        fill="#ef4444" textAnchor="middle" letterSpacing="1.5">TANODNET AI</text>
    </svg>
  );
}
