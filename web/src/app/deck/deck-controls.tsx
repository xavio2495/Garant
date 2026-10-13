"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/motion/gsap";

const STEP = 50; // degrees between slides around the sphere
const LON = (i: number) => -i * STEP; // each slide's longitude: the next one always waits to the right
// The slides are scattered rather than lined up: each has its own height (share of the screen), distance from the
// centre (share of the radius) and a slight roll
const LAT = [-0.06, 0.13, -0.11, 0.08, -0.14, 0.1, -0.05, 0.12];
const DEPTH = [1, 1.12, 0.94, 1.08, 1, 1.15, 0.96, 1.05];
const ROLL = [-1.5, 2.5, -2, 1.5, -2.5, 2, -1, 1.5];

// The deck is a sphere seen from inside: each slide is a card on its inner wall, facing the centre. Moving to a slide
// pulls the camera back, swings the sphere round and pushes in on the card. Keys, wheel, swipes, the dots and a
// click on a neighbouring card all move it.
export function DeckControls({ titles }: { titles: string[] }) {
  const [at, setAt] = useState(0);
  const goRef = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const root = document.getElementById("deck");
    const sphere = root?.querySelector<HTMLElement>("[data-sphere]");
    if (!root || !sphere) return;
    const slides = [...root.querySelectorAll<HTMLElement>("[data-slide]")];
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cam = { a: 0, y: 0, r: 0, pull: 0, lx: 0, ly: 0 };
    let R = 1000, cur = 0, busy = false;

    const ins = (slide: HTMLElement) => slide.querySelectorAll<HTMLElement>("[data-in]");
    const shown = new Set<HTMLElement>();
    if (!calm) slides.forEach((s) => gsap.set(ins(s), { autoAlpha: 0, y: 26 }));
    const reveal = (slide: HTMLElement) => {
      if (calm || shown.has(slide)) return;
      shown.add(slide);
      gsap.to(ins(slide), { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.09, delay: 0.15 });
    };

    const sway = (i: number) => LAT[i % LAT.length] * innerHeight;
    const reach = (i: number) => R * DEPTH[i % DEPTH.length];
    // Seat every card on the inner wall; the radius follows the card size so neighbours just show at the edges
    const seat = () => {
      const w = slides[0].offsetWidth;
      R = w * 1.3;
      root.style.perspective = `${R * 1.05}px`;
      // Written directly, not through GSAP, which would reorder the functions: centre the card on the sphere's
      // centre, tilt it, lift it off the equator, push it out to the wall, then swing it round to its longitude
      slides.forEach((s, i) => {
        s.style.transformOrigin = "0 0";
        s.style.transform = `rotateY(${LON(i)}deg) translateZ(${-reach(i)}px) translateY(${sway(i)}px) rotateX(${-Math.sign(sway(i)) * 4}deg) rotateZ(${ROLL[i % ROLL.length]}deg) translate(-50%, -50%)`;
      });
      // Pieces marked data-pop lift off their card towards the centre, by the depth they name
      root.querySelectorAll<HTMLElement>("[data-pop]").forEach((p) => gsap.set(p, { z: Number(p.dataset.pop) || 80 }));
      cam.r = reach(cur);
      render();
    };
    // The camera: the sphere's centre sits a radius in front of the screen, so the facing card is at full size
    const render = () => {
      // The pointer leans the camera a few degrees; the lifted pieces sit nearer the centre than their cards, so
      // they shift less, which reads as parallax
      sphere.style.transform = `translateZ(${cam.r - cam.pull}px) translateY(${-cam.y}px) rotateX(${cam.ly}deg) rotateY(${-cam.a + cam.lx}deg)`;
      // Cards behind the camera can't be drawn sensibly in CSS 3D, so only the near half of the sphere shows
      slides.forEach((s, i) => (s.style.visibility = Math.abs(LON(i) - cam.a) < 100 ? "visible" : "hidden"));
    };

    const go = (to: number) => {
      const i = Math.max(0, Math.min(slides.length - 1, to));
      if (i === cur || busy) return;
      cur = i;
      setAt(i);
      if (calm) {
        Object.assign(cam, { a: LON(i), y: sway(i), r: reach(i), pull: 0 });
        render();
        reveal(slides[i]);
        return;
      }
      busy = true;
      const dist = Math.min(3, Math.abs(LON(i) - cam.a) / STEP);
      gsap
        .timeline({ onUpdate: render, onComplete: () => void (busy = false) })
        .to(cam, { a: LON(i), y: sway(i), r: reach(i), duration: 0.9 + dist * 0.25, ease: "power3.inOut" }, 0)
        .to(cam, { pull: R * 0.35, duration: 0.45 + dist * 0.12, ease: "power2.out" }, 0)
        .to(cam, { pull: 0, duration: 0.55 + dist * 0.13, ease: "power3.inOut" }, ">")
        .add(() => reveal(slides[i]), 0.5);
    };
    goRef.current = go;

    seat();
    cam.y = sway(0);
    render();
    const lean = (e: PointerEvent) => {
      if (calm) return;
      gsap.to(cam, { lx: (e.clientX / innerWidth - 0.5) * 7, ly: -(e.clientY / innerHeight - 0.5) * 5, duration: 0.9, ease: "power3.out", overwrite: "auto", onUpdate: render });
    };
    addEventListener("pointermove", lean);
    reveal(slides[0]);
    addEventListener("resize", seat);

    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const step = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key) ? 1 : ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key) ? -1 : 0;
      if (step) {
        e.preventDefault();
        go(cur + step);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
    };
    // One wheel gesture moves one slide. A gesture (including a trackpad's momentum tail) counts as over only after
    // the wheel has been quiet for a moment; until then nothing else it sends can move the deck again.
    let acc = 0, spent = false, quiet = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      clearTimeout(quiet);
      quiet = window.setTimeout(() => ((acc = 0), (spent = false)), 260);
      if (spent || busy) return;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(acc) > 50) {
        spent = true;
        go(cur + Math.sign(acc));
      }
    };
    let down: { x: number; y: number } | null = null;
    const press = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const release = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 50) return go(cur + (Math.abs(dx) > Math.abs(dy) ? -Math.sign(dx) : -Math.sign(dy)));
      // A click on a neighbouring card brings it round
      const hit = (e.target as Element).closest<HTMLElement>("[data-slide]");
      const i = hit ? slides.indexOf(hit) : -1;
      if (i >= 0 && i !== cur) go(i);
    };
    addEventListener("keydown", key);
    root.addEventListener("wheel", wheel, { passive: false });
    root.addEventListener("pointerdown", press);
    root.addEventListener("pointerup", release);
    return () => {
      removeEventListener("resize", seat);
      removeEventListener("pointermove", lean);
      removeEventListener("keydown", key);
      root.removeEventListener("wheel", wheel);
      root.removeEventListener("pointerdown", press);
      root.removeEventListener("pointerup", release);
      slides.forEach((sl) => gsap.set(ins(sl), { clearProps: "opacity,visibility,transform" }));
    };
  }, []);

  return (
    <>
      <nav aria-label="Slides" className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 sm:flex">
        {titles.map((t, i) => (
          <button
            key={t}
            onClick={() => goRef.current(i)}
            aria-label={`Slide ${i + 1}: ${t}`}
            aria-current={i === at ? "true" : undefined}
            className="group flex items-center gap-3"
          >
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-aria-[current=true]:opacity-100">
              {t}
            </span>
            <span className="size-2 bg-white/25 transition-all group-hover:bg-white/60 group-aria-[current=true]:h-5 group-aria-[current=true]:bg-floor" />
          </button>
        ))}
      </nav>
      <p className="fixed bottom-5 left-6 z-30 font-pixel text-lg text-muted sm:left-10">
        {String(at + 1).padStart(2, "0")}
        <span className="text-white/25"> / {String(titles.length).padStart(2, "0")}</span>
      </p>
      <p className="fixed bottom-5 right-6 z-30 hidden font-mono text-xs uppercase tracking-[0.14em] text-muted sm:block sm:right-10">
        ← → to move
      </p>
    </>
  );
}
