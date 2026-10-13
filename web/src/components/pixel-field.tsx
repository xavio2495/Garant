"use client";

import { useEffect, useRef } from "react";

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

    function draw() {
      ctx!.clearRect(0, 0, cols * CELL, rows * CELL);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = c * CELL, y = r * CELL;
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          const near = d < 160 ? (1 - d / 160) * 0.8 : 0;
          const a = Math.min(1, level[i] * edge[i] + near * (0.4 + base[i]));
          if (a < 0.03) continue;
          ctx!.fillStyle = `rgba(255,255,255,${a * 0.42})`;
          ctx!.fillRect(x, y, SIZE, SIZE);
        }
    }

    function tick(t: number) {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / FPS) return;
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
