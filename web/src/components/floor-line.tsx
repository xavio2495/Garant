// Illustrative rate path against a guaranteed floor; the shaded area below the
// floor is the shortfall that gets paid out.
// Offsets from the floor, in pesos
const PATH = [1.4, 1.1, 1.6, 1.2, 0.8, 1.0, 0.5, 0.9, 0.4, 0.1, 0.3, -0.2, -0.6, -0.3, -0.8, -0.5];

export function FloorLine({ floor = 62.5, className = "" }: { floor?: number; className?: string }) {
  const w = 320;
  const h = 120;
  const min = floor - 1.4;
  const max = floor + 2;
  const RATES = PATH.map((d) => floor + d);
  const x = (i: number) => (i / (RATES.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const fy = y(floor);
  const path = RATES.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className={className} role="img" aria-label={`Rate falling below a guaranteed floor of ${floor}`}>
      <defs>
        <clipPath id="below-floor">
          <rect x="0" y={fy} width={w} height={h - fy} />
        </clipPath>
      </defs>
      <path d={`${path} L${w},${fy} L0,${fy} Z`} fill="var(--color-floor)" fillOpacity="0.3" clipPath="url(#below-floor)" />
      <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="0" x2={w} y1={fy} y2={fy} stroke="var(--color-floor)" strokeWidth="3" strokeLinecap="round" />
      <text x="0" y={h + 14} className="fill-muted text-[10px]">
        Rate over 30 days, illustrative. Bright line: guaranteed ₱{floor.toFixed(2)}
      </text>
    </svg>
  );
}
