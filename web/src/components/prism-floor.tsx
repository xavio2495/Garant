// Glass slabs rising from a guaranteed floor: the product's idea drawn as light through glass.
// Each slab is a thin pane with a chamfered top; its edges carry the prism spectrum.

const W = 800;
const H = 440;
const FLOOR = 404;
const CX = W / 2;

type Slab = { x: number; w: number; h: number; lean: number; depth: number };

// Mirrored panes, tallest near the centre, leaning in toward it
const SIDE: Omit<Slab, "x">[] = [
  { w: 16, h: 320, lean: 4, depth: 0 },
  { w: 40, h: 290, lean: 16, depth: 1 },
  { w: 26, h: 250, lean: 30, depth: 2 },
  { w: 46, h: 212, lean: 42, depth: 1 },
  { w: 22, h: 172, lean: 54, depth: 3 },
  { w: 34, h: 136, lean: 62, depth: 2 },
];
const OFFSETS = [14, 52, 108, 158, 222, 270];

function pane({ x, w, h, lean }: Slab, dir: 1 | -1) {
  // dir 1 = right of centre, leans left toward the middle
  const top = FLOOR - h;
  const knee = FLOOR - h * 0.58;
  const tx = x - dir * lean;
  return [
    [x, FLOOR],
    [x, knee],
    [tx, top],
    [tx + dir * w, top + 6],
    [x + dir * w, knee + 4],
    [x + dir * w, FLOOR],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

export function PrismFloor({ className = "" }: { className?: string }) {
  const slabs = SIDE.flatMap((s, i) => [
    { ...s, x: CX + OFFSETS[i], dir: 1 as const, i },
    { ...s, x: CX - OFFSETS[i], dir: -1 as const, i },
  ]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Glass panes standing on a guaranteed floor line">
      <defs>
        <linearGradient id="pf-edge" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffe14d" />
          <stop offset="0.2" stopColor="#ff8a3d" />
          <stop offset="0.4" stopColor="#ff3dd4" />
          <stop offset="0.6" stopColor="#7a5cff" />
          <stop offset="0.8" stopColor="#2fd3ff" />
          <stop offset="1" stopColor="#4dff9a" />
        </linearGradient>
        <linearGradient id="pf-edge-alt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff3dd4" />
          <stop offset="0.35" stopColor="#2fd3ff" />
          <stop offset="0.7" stopColor="#ffe14d" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="pf-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#8fa4ff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#2fd3ff" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="pf-floor" x1="0" x2="1">
          <stop offset="0" stopColor="#f2b33d" stopOpacity="0" />
          <stop offset="0.2" stopColor="#f2b33d" />
          <stop offset="0.8" stopColor="#f2b33d" />
          <stop offset="1" stopColor="#f2b33d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pf-glow" cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor="#3d5bff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3d5bff" stopOpacity="0" />
        </radialGradient>
        <filter id="pf-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <ellipse cx={CX} cy={FLOOR} rx={360} ry={150} fill="url(#pf-glow)" />

      {/* Back to front: thin, far panes first */}
      {[...slabs]
        .sort((a, b) => b.depth - a.depth)
        .map((s) => {
          const pts = pane(s, s.dir);
          const edge = s.i % 2 ? "url(#pf-edge-alt)" : "url(#pf-edge)";
          const fade = 1 - s.depth * 0.18;
          return (
            <g key={`${s.dir}-${s.i}`} opacity={fade}>
              <polygon points={pts} fill="none" stroke={edge} strokeWidth="5" filter="url(#pf-blur)" opacity="0.6" />
              <polygon points={pts} fill="url(#pf-fill)" stroke={edge} strokeWidth="1.4" strokeLinejoin="round" />
              <polygon
                points={pts}
                fill="none"
                stroke="#fff"
                strokeWidth="0.6"
                strokeOpacity="0.7"
                style={{ animation: `slab-shimmer ${5 + s.i}s ease-in-out ${s.i * 0.6}s infinite` }}
              />
            </g>
          );
        })}

      {/* Centre pane */}
      <rect x={CX - 3} y={FLOOR - 352} width={6} height={352} fill="url(#pf-fill)" stroke="url(#pf-edge-alt)" strokeWidth="1.2" />

      {/* The floor */}
      <line x1={40} x2={W - 40} y1={FLOOR} y2={FLOOR} stroke="url(#pf-floor)" strokeWidth="8" filter="url(#pf-blur)" opacity="0.7" />
      <line x1={40} x2={W - 40} y1={FLOOR} y2={FLOOR} stroke="url(#pf-floor)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
