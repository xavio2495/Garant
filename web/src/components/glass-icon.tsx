import { useId } from "react";

// Small glass objects for each use: panes of frosted glass whose edges carry the prism spectrum
export type GlassIconKind = "transfer" | "rain" | "vault";

const SHAPES: Record<GlassIconKind, string[]> = {
  // Two cards passing each other, the front one carrying an arrow
  transfer: [
    "M14 30 Q14 24 20 24 L62 24 Q68 24 68 30 L68 54 Q68 60 62 60 L20 60 Q14 60 14 54 Z",
    "M30 44 Q30 38 36 38 L78 38 Q84 38 84 44 L84 68 Q84 74 78 74 L36 74 Q30 74 30 68 Z",
    "M44 56 L66 56 M58 49 L66 56 L58 63",
  ],
  // A cloud over three falling drops
  rain: [
    "M26 52 Q14 52 14 42 Q14 32 25 31 Q28 18 44 18 Q58 18 62 30 Q76 29 78 41 Q80 52 66 52 Z",
    "M30 62 Q34 68 30 74 Q26 68 30 62 Z",
    "M48 64 Q52 70 48 76 Q44 70 48 64 Z",
    "M66 62 Q70 68 66 74 Q62 68 66 62 Z",
  ],
  // An open-topped glass cube holding a coin: collateral locked up front
  vault: [
    "M48 18 L78 32 L48 46 L18 32 Z",
    "M18 32 L48 46 L48 80 L18 66 Z",
    "M78 32 L48 46 L48 80 L78 66 Z",
    "M38 30 Q48 25 58 30 Q48 35 38 30 Z",
  ],
};

export function GlassIcon({ kind, className = "" }: { kind: GlassIconKind; className?: string }) {
  const id = useId().replace(/:/g, "");
  const shapes = SHAPES[kind];
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={`glass-float ${className}`}>
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3dd4" />
          <stop offset="0.3" stopColor="#7a5cff" />
          <stop offset="0.55" stopColor="#2fd3ff" />
          <stop offset="0.8" stopColor="#ffe14d" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.04" />
        </linearGradient>
        <filter id={`${id}b`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <g filter={`url(#${id}b)`} opacity="0.55">
        {shapes.map((d) => (
          <path key={d} d={d} fill="none" stroke={`url(#${id}e)`} strokeWidth="4" />
        ))}
      </g>
      {shapes.map((d, i) => (
        <path
          key={d}
          d={d}
          fill={d.includes("Z") ? `url(#${id}f)` : "none"}
          stroke={`url(#${id}e)`}
          strokeWidth={i === shapes.length - 1 && kind === "transfer" ? 2.4 : 1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {/* Specular glint on the top edge */}
      <path d={shapes[0].split("Z")[0]} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.6" className="glass-glint" />
    </svg>
  );
}
