"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "@/lib/motion/gsap";

// A 3D stage for a group of panels: perspective on desktop, and the camera leans a few degrees with the pointer so
// lifted pieces (Pop) drift against the cards behind them. Flat and still on phones and with reduced motion.
export function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches) return;
    const rx = gsap.quickTo(el, "rotationX", { duration: 1.1, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 1.1, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      ry((e.clientX / innerWidth - 0.5) * 4);
      rx(-(e.clientY / innerHeight - 0.5) * 3);
    };
    addEventListener("pointermove", move);
    return () => {
      removeEventListener("pointermove", move);
      gsap.set(el, { clearProps: "transform" });
    };
  }, []);

  return (
    <div className="lg:[perspective:1500px]">
      <div ref={ref} className={`stage3d lg:[transform-style:preserve-3d] ${className}`}>
        {children}
      </div>
    </div>
  );
}
