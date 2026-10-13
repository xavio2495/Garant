"use client";

import { useEffect, useRef } from "react";
import { field, waveFront, waveWob } from "@/lib/motion/field-bus";

// A fixed field of small square pixels that twinkle, denser toward the edges, brightening near the pointer
const CELL = 12;
const SIZE = 7;
const FPS = 18;

export function PixelField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The landing's preloader holds the pixel space back until its shockwave brings it in
    if (!still && document.querySelector("[data-loader]")) field.hidden = true;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let cols = 0, rows = 0, base = new Float32Array(0), level = new Float32Array(0), edge = new Float32Array(0);
    let pointer = { x: -1e4, y: -1e4 };
    let raf = 0, last = 0;

    function resize() {
      const w = innerWidth, h = innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      base = new Float32Array(cols * rows);
      level = new Float32Array(cols * rows);
      edge = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          // 0 in the middle column band, 1 at the left and right edges, so content stays readable
          const dx = Math.abs(c / cols - 0.5) * 2;
          edge[i] = Math.min(1, Math.max(0.05, (dx - 0.4) / 0.6));
          base[i] = Math.random() * 0.25;
          level[i] = base[i];
        }
      draw();
    }

    // Aurora ramp: green-teal through blue to violet, sinking to deep indigo in the wake
    const RAMP: [number, number, number][] = [[90, 255, 200], [130, 175, 255], [200, 135, 255]];
    const DUSK: [number, number, number] = [96, 70, 220];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    function aurora(t: number, wake: number): [number, number, number] {
      const seg = Math.min(1.999, t * 2);
      const i = Math.floor(seg);
      const f = seg - i;
      const c = RAMP[i], d = RAMP[i + 1];
      return [0, 1, 2].map((n) => lerp(lerp(c[n], d[n], f), DUSK[n], wake * 0.7)) as [number, number, number];
    }

    function draw() {
      ctx!.clearRect(0, 0, cols * CELL, rows * CELL);
      if (field.hidden) return;
      const W = cols * CELL, H = rows * CELL;
      const cx = W / 2, cy = H / 2;
      // The field sits a little behind the page, so it drifts up slower than the content does
      const depth = scrollY * 0.18;
      const rowShift = Math.floor(depth / CELL);
      const sub = depth % CELL;
      const { shock, wave } = field;
      const horizontal = wave.mode === "x";
      const front = wave.on ? waveFront(wave.p, horizontal ? W : H) : 0;
      const T = performance.now() / 1000;

      // The wave is lopsided on purpose, like a curtain of northern lights: its front wanders with the
      // cross axis, its leading edge is sharp and its tail long, and rays of different strength run through it.
      // Everything that depends only on the cross axis is worked out once per frame.
      const n = horizontal ? rows : cols;
      const wob = new Float32Array(n), lead = new Float32Array(n), tail = new Float32Array(n), ray = new Float32Array(n), hue = new Float32Array(n);
      if (wave.on)
        for (let k = 0; k < n; k++) {
          const v = k * CELL;
          wob[k] = waveWob(v, T);
          lead[k] = 60 + 50 * Math.sin(v * 0.011 + 2);
          tail[k] = 520 + 300 * Math.sin(v * 0.0073 + T * 0.5);
          ray[k] = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(v * 0.06 + Math.sin(v * 0.017 + T * 0.7) * 3));
          hue[k] = 0.5 + 0.5 * Math.sin(v * 0.0045 + T * 0.4);
        }

      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = ((r + rowShift) % rows) * cols + c;
          const x = c * CELL;
          let y = r * CELL - sub;
          let size = SIZE;
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          const near = d < 160 ? (1 - d / 160) * 0.8 : 0;
          let a = Math.min(1, level[i] * edge[i] + near * (0.4 + base[i]));
          if (shock.on) {
            // Pixels exist only inside the expanding ring, and the ring itself burns bright
            const dr = Math.hypot(x - cx, y - cy) - shock.r;
            if (dr > 0) continue;
            const ring = dr > -70 ? 1 + dr / 70 : 0;
            a = Math.min(1.2, a + ring * 1.1);
            size = SIZE * (1 + ring * 0.7);
          }
          let rgb: [number, number, number] | null = null;
          let wa = 0;
          if (wave.on) {
            const kx = horizontal ? r : c;
            const dist = (horizontal ? x : H - y) - (front + wob[kx]);
            let k = dist >= 0 ? Math.max(0, 1 - dist / lead[kx]) : Math.pow(Math.max(0, 1 + dist / tail[kx]), 1.6);
            k *= ray[kx];
            if (k > 0.02) {
              wa = k;
              rgb = aurora(hue[kx], dist < 0 ? 1 - Math.max(0, 1 + dist / tail[kx]) : 0);
              size = SIZE * (1 + k * 0.8);
              y -= k * 16;
            }
          }
          if (a < 0.03 && wa < 0.03) continue;
          ctx!.fillStyle = rgb
            ? `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${Math.min(1, a * 0.42 + wa * 0.8)})`
            : `rgba(255,255,255,${Math.min(1, a) * 0.42})`;
          ctx!.fillRect(x, y, size, size);
        }
    }

    function tick(t: number) {
      raf = requestAnimationFrame(tick);
      const live = field.shock.on || field.wave.on;
      if (!live && t - last < 1000 / FPS) return;
      last = t;
      for (let i = 0; i < level.length; i++) {
        if (Math.random() < 0.004) level[i] = 0.55 + Math.random() * 0.45;
        else level[i] += (base[i] - level[i]) * 0.08;
      }
      draw();
    }

    const move = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY });
    const leave = () => (pointer = { x: -1e4, y: -1e4 });
    resize();
    addEventListener("resize", resize);
    if (!still) {
      addEventListener("pointermove", move);
      document.addEventListener("pointerleave", leave);
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
