import Image from "next/image";

// The glass objects. Each is a transparent render, so it sits straight on the pixel field.
// `left`/`right` crop that share off each side of the render: the arrows asset is cut off on its left, so only the
// whole `>` shows. The slash asset's second stroke runs off its right edge; the strokes are diagonal, so after the
// crop a `clip` along the gap between them leaves only the first, whole stroke.
export const GLYPHS: Record<string, { src: string; w: number; h: number; left?: number; right?: number; clip?: string }> = {
  braces: { src: "/glass/braces.avif", w: 252, h: 249 },
  hash: { src: "/glass/hash.avif", w: 243, h: 255 },
  plus: { src: "/glass/plus.avif", w: 237, h: 234 },
  slash: { src: "/glass/slash.avif", w: 756, h: 1032, right: 0.259, clip: "polygon(0 0, 100% 0, 100% 22.9%, 56.1% 100%, 0 100%)" },
  arrows: { src: "/glass/arrows.avif", w: 1302, h: 987, left: 0.395 },
  open: { src: "/glass/brace-open.avif", w: 1168, h: 2080 },
  close: { src: "/glass/brace-close.avif", w: 1064, h: 2080 },
};

export type GlyphKind = "braces" | "hash" | "plus" | "slash" | "arrows" | "open" | "close";

// `depth` sets how far it drifts with scroll and leans to the pointer; `still` keeps it static (small UI uses)
export function Glyph({
  kind,
  className = "",
  tilt = 0,
  depth = 0.4,
  priority = false,
  still = false,
}: {
  kind: GlyphKind;
  className?: string;
  tilt?: number;
  depth?: number;
  priority?: boolean;
  still?: boolean;
}) {
  const g = GLYPHS[kind];
  const left = g.left ?? 0;
  const keep = 1 - left - (g.right ?? 0);
  const crop = keep < 1 ? { width: `${100 / keep}%`, maxWidth: "none", marginLeft: `${(-100 * left) / keep}%` } : undefined;
  return (
    <span
      aria-hidden
      className={`glyph-wrap ${keep < 1 ? "overflow-hidden" : ""} ${className}`}
      style={{ aspectRatio: `${(g.w * keep).toFixed(2)} / ${g.h}`, transform: still ? `rotate(${tilt}deg)` : undefined }}
      {...(still ? {} : { "data-glyph": "", "data-depth": depth, "data-tilt": tilt })}
    >
      <span data-glyph-in className="glyph-in" style={g.clip ? { clipPath: g.clip } : undefined}>
        <Image
          src={g.src}
          width={g.w}
          height={g.h}
          alt=""
          unoptimized
          priority={priority}
          draggable={false}
          className="glyph"
          style={crop}
        />
      </span>
    </span>
  );
}

// "//" made from two copies of the single clean slash stroke, the second set to the right as in the original render
const SLASH_GAP = 0.73; // the second stroke starts this far along the first stroke's width
export function Slashes({ className = "", tilt = 0, still = false }: { className?: string; tilt?: number; still?: boolean }) {
  const g = GLYPHS.slash;
  const one = (g.w * (1 - (g.right ?? 0))) / g.h;
  const share = `${100 / (1 + SLASH_GAP)}%`;
  return (
    <span
      aria-hidden
      className={`relative block ${className}`}
      style={{ aspectRatio: `${(one * (1 + SLASH_GAP)).toFixed(4)}`, transform: still ? `rotate(${tilt}deg)` : undefined }}
    >
      <span className="absolute inset-y-0 left-0" style={{ width: share }}>
        <Glyph kind="slash" still className="size-full" />
      </span>
      <span className="absolute inset-y-0 right-0" style={{ width: share }}>
        <Glyph kind="slash" still className="size-full" />
      </span>
    </span>
  );
}
