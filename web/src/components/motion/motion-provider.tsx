"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { attachAll } from "@/lib/motion/attach";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// The site's motion layer: smooth scrolling, a pixel cursor, the glass spotlight, and per-page
// animation attached by data attribute (see lib/motion/attach.ts).
export function MotionProvider() {
  const pathname = usePathname();

  // Smooth scroll, stepped by GSAP's ticker so scroll-driven motion stays in time
  useEffect(() => {
    if (reduced()) return;
    const lenis = new Lenis({ anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    // A refresh (pins, fonts, resize) moves the page under Lenis; resync it, or its next wheel step starts from a stale spot
    const resync = () => lenis.resize();
    ScrollTrigger.addEventListener("refresh", resync);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(250, 33);
    // The deck scrolls its own container, which smooth scrolling would swallow
    const sync = () => (location.pathname === "/deck" ? lenis.stop() : lenis.start());
    sync();
    const id = setInterval(sync, 400);
    return () => {
      clearInterval(id);
      ScrollTrigger.removeEventListener("refresh", resync);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  // A small pixel that trails the pointer and swells over anything clickable
  useEffect(() => {
    if (reduced() || matchMedia("(pointer: coarse)").matches) return;
    const dot = document.createElement("div");
    dot.className = "px-cursor";
    document.body.append(dot);
    gsap.set(dot, { xPercent: -50, yPercent: -50, opacity: 0 });
    const x = gsap.quickTo(dot, "x", { duration: 0.28, ease: "power3.out" });
    const y = gsap.quickTo(dot, "y", { duration: 0.28, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      x(e.clientX);
      y(e.clientY);
      gsap.to(dot, { opacity: 1, duration: 0.2, overwrite: "auto" });
      const t = e.target as Element | null;
      dot.dataset.hot = t?.closest("a,button,summary,[role=button],input,select") ? "true" : "false";
      const glass = t?.closest<HTMLElement>(".glass");
      if (glass) {
        const r = glass.getBoundingClientRect();
        glass.style.setProperty("--mx", `${e.clientX - r.left}px`);
        glass.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    };
    const leave = () => gsap.to(dot, { opacity: 0, duration: 0.2 });
    addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    return () => {
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      dot.remove();
    };
  }, []);

  // Per page: wait for the fonts so headlines split on their real line breaks
  useEffect(() => {
    if (reduced()) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    // The landing's preloader holds the page's motion until it has lifted
    const loaded = () =>
      document.querySelector("[data-loader]")
        ? new Promise<void>((r) => addEventListener("garant:loaded", () => r(), { once: true }))
        : Promise.resolve();
    document.fonts.ready.then(loaded).then(() => {
      if (!cancelled) detach = attachAll();
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [pathname]);

  return null;
}
