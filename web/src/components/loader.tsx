"use client";

import { useEffect, useRef, useState } from "react";
import { field } from "@/lib/motion/field-bus";
import { gsap } from "@/lib/motion/gsap";

let played = false; // once per page load, not on every client-side return to the landing

// Black, with only the percentage. At 100 a shockwave leaves the centre and the pixel space exists
// inside it; the number dissolves as the hero's wordmark resolves in the same spot.
// Fires "garant:shock" at the blast and "garant:loaded" once the page can start moving.
export function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const finish = () => {
      document.documentElement.style.removeProperty("overflow");
      // Unmounted by React rather than pulled out of the DOM behind its back; the marker goes now, so anything
      // checking for a preloader after "garant:loaded" doesn't wait on one that is already finished
      el.removeAttribute("data-loader");
      setDone(true);
      played = true;
      dispatchEvent(new Event("garant:loaded"));
    };
    if (played || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      field.hidden = false;
      dispatchEvent(new Event("garant:shock"));
      return finish();
    }

    document.documentElement.style.overflow = "hidden";
    const n = { v: 0 };
    const max = Math.hypot(innerWidth, innerHeight) / 2 + 160;
    const tl = gsap.timeline();
    tl.to(n, {
      v: 100,
      duration: 2.3,
      ease: "power2.inOut",
      onUpdate: () => {
        if (count.current) count.current.textContent = `${Math.round(n.v)}%`;
      },
    });
    tl.add(() => {
      field.hidden = false;
      field.shock.on = true;
      field.shock.r = 0;
      dispatchEvent(new Event("garant:shock"));
    });
    // The black lifts from the centre outward exactly as far as the ring has travelled
    tl.to(
      field.shock,
      {
        r: max,
        duration: 1.8,
        ease: "power2.out",
        onUpdate: () => veil.current?.style.setProperty("--r", `${field.shock.r}px`),
        onComplete: () => void (field.shock.on = false),
      },
      ">",
    );
    tl.to(count.current, { autoAlpha: 0, scale: 1.5, filter: "blur(12px)", duration: 0.8, ease: "power2.in" }, "<");
    tl.add(finish, "<+=1.2");
    return () => {
      tl.kill();
    };
  }, []);

  if (done) return null;
  return (
    <div ref={root} data-loader className="pointer-events-none fixed inset-0 z-[90]" role="status" aria-label="Loading Garant">
      <div
        ref={veil}
        className="absolute inset-0 bg-black"
        style={{
          ["--r" as string]: "0px",
          maskImage: "radial-gradient(circle at 50% 50%, transparent var(--r), #000 calc(var(--r) + 3px))",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent var(--r), #000 calc(var(--r) + 3px))",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <span ref={count} className="font-pixel text-[clamp(4rem,12vw,9rem)] leading-none text-ink">
          0%
        </span>
      </div>
    </div>
  );
}
