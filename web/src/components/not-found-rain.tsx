"use client";

import { useEffect, useRef } from "react";

const CELL = 12;
const SIZE = 7;
const RAMP = [[90, 255, 200], [130, 175, 255], [200, 135, 255], [130, 175, 255], [90, 255, 200]];
const aurora = (t: number) => {
  const seg = (((t % 1) + 1) % 1) * 4, i = Math.min(3, Math.floor(seg)), f = seg - i;
  return RAMP[i].map((v, n) => v + (RAMP[i + 1][n] - v) * f);
};

type Run = { top: number; bottom: number; fill: number };

// "404" cut out of the pixel grid. Rain falls everywhere but only shows inside the digits, and each stroke of each
// digit slowly fills from the bottom like a vessel. Nothing outside the digits is drawn.
export function NotFoundRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const host = canvas?.parentElement;
    if (!canvas || !ctx || !host) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-sans-face") || "sans-serif";
    let W = 0, H = 0, cols = 0, rows = 0, total = 0;
    let runs: Run[][] = [];
    let drops: { c: number; y: number; v: number }[] = [];
    let raf = 0, last = 0;

    // Which cells of the grid fall inside the digits, as vertical runs per column
    function carve() {
      const r = host!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / CELL);
      rows = Math.ceil(H / CELL);
      const m = document.createElement("canvas");
      m.width = cols;
      m.height = rows;
      const mc = m.getContext("2d", { willReadFrequently: true })!;
      // Size the word at one cell per pixel, as large as the screen allows
      mc.font = `900 100px ${family}`;
      const k = Math.min((cols * 0.94) / mc.measureText("404").width, (rows * 0.78) / 72);
      mc.font = `900 ${100 * k}px ${family}`;
      const mt = mc.measureText("404");
      mc.textAlign = "center";
      mc.fillText("404", cols / 2, rows / 2 + mt.actualBoundingBoxAscent / 2);
      const a = mc.getImageData(0, 0, cols, rows).data;
      runs = [];
      total = 0;
      for (let c = 0; c < cols; c++) {
        const col: Run[] = [];
        let start = -1;
        for (let y = 0; y <= rows; y++) {
          const inside = y < rows && a[(y * cols + c) * 4 + 3] > 110;
          if (inside && start < 0) start = y;
          if (!inside && start >= 0) {
            col.push({ top: start, bottom: y - 1, fill: calm ? y - start : 0 });
            total += y - start;
            start = -1;
          }
        }
        runs.push(col);
      }
      if (calm) draw(0);
    }

    function step(f: number) {
      for (let n = (total / 820) * f; n > 0; n--) if (Math.random() < n) drops.push({ c: (Math.random() * cols) | 0, y: -Math.random() * 80, v: 1.4 + Math.random() * 1.8 });
      for (const d of drops) {
        d.v = Math.min(7, d.v + 0.07 * f); // a slow, heavy rain
        d.y += d.v * f;
        const row = Math.floor(d.y / CELL);
        const run = runs[d.c]?.find((r) => row >= r.top && row <= r.bottom);
        if (run && run.fill < run.bottom - run.top + 1 && row >= run.bottom - run.fill) {
          run.fill++;
          d.y = Infinity;
        }
      }
      drops = drops.filter((d) => d.y < H + 40);
    }

    function draw(T: number) {
      ctx!.clearRect(0, 0, W, H);
      for (let c = 0; c < cols; c++) {
        const [r, g, b] = aurora(c / cols - T * 0.04);
        for (const run of runs[c]) {
          for (let y = run.top; y <= run.bottom; y++) {
            const full = y > run.bottom - run.fill;
            const top = y === run.bottom - run.fill + 1;
            ctx!.fillStyle = full ? `rgba(${r | 0},${g | 0},${b | 0},${top ? 0.95 : 0.7})` : "rgba(255,255,255,0.07)";
            ctx!.fillRect(c * CELL, y * CELL, SIZE, SIZE);
          }
        }
      }
      // Drops show only where they cross a digit
      for (const d of drops) {
        const row = Math.floor(d.y / CELL);
        for (let k = 0; k < 4; k++) {
          const y = row - k;
          if (!runs[d.c]?.some((r) => y >= r.top && y <= r.bottom - r.fill)) continue;
          ctx!.fillStyle = `rgba(222,234,255,${[0.9, 0.35, 0.15, 0.06][k]})`;
          ctx!.fillRect(d.c * CELL, y * CELL, SIZE, SIZE);
        }
      }
    }

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const f = last ? Math.min(3, (now - last) / 16.7) : 1;
      last = now;
      step(f);
      draw(now / 1000);
    }

    const ro = new ResizeObserver(carve);
    let live = true;
    // Carve once the display font is in; if it can't load, carve with the fallback rather than show nothing
    document.fonts.load(`900 100px ${family}`).catch(() => []).then(() => {
      if (!live) return;
      ro.observe(host);
      carve();
      if (!calm) raf = requestAnimationFrame(tick);
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}
