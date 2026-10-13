import type { CSSProperties, ReactNode } from "react";

// A glass card for the 3D stage. The glass is its own layer just behind the content, so pieces inside the card can
// lift off it (see Pop) instead of being flattened into the pane.
export function Panel({ children, className = "", quiet = false }: { children: ReactNode; className?: string; quiet?: boolean }) {
  return (
    // Flat (phones), the pane sits behind the content by z-index; in 3D (desktop) by depth, since isolating the card
    // there would flatten it
    <div className={`relative isolate lg:isolation-auto lg:[transform-style:preserve-3d] ${className}`}>
      <div aria-hidden className={`glass ${quiet ? "glass-quiet" : ""} curved absolute inset-0 -z-10 lg:z-auto lg:[transform:translateZ(-1px)]`} />
      {children}
    </div>
  );
}

// Lifts its content `z` px towards the reader on desktop, optionally turned (`turn`, degrees about the vertical axis)
// so columns can bend into a curved screen. Flat on phones.
export function Pop({ children, z = 60, turn = 0, className = "" }: { children: ReactNode; z?: number; turn?: number; className?: string }) {
  return (
    <div
      data-pop
      className={`lg:[transform-style:preserve-3d] lg:[transform:var(--pop)] ${className}`}
      style={{ "--pop": `translateZ(${z}px) rotateY(${turn}deg)` } as CSSProperties}
    >
      {children}
    </div>
  );
}
