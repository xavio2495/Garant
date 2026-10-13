"use client";

import { useEffect, useRef } from "react";
import { afterLoaded } from "@/lib/motion/ready";

const UMBRELLA = 70; // radius of the arc above the pointer that turns the rain away
const WORD = "Garant";

// Shared with the landing's scroll timeline. `lift` runs 0..1 as the bell curve rises into the About cards;
// `targets` are those cards' boxes at rest, in the story's own coordinates.
export const rain = { lift: 0, targets: [] as { x: number; y: number; w: number; h: number }[] };

type Drop = { c: number; y: number; v: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };
type Mote = { sx: number; sy: number; cx: number; cy: number; tx: number; ty: number; d: number; rgb: number[] };
type Word = { font: string; x: number; base: number; w: number; h: number };

// One aurora gradient for the word and the bell alike: teal, ice blue, violet and back, drifting slowly sideways
const RAMP = [[90, 255, 200], [130, 175, 255], [200, 135, 255], [130, 175, 255], [90, 255, 200]];
function aurora(t: number) {
  const seg = (((t % 1) + 1) % 1) * 4, i = Math.min(3, Math.floor(seg)), f = seg - i;
  return RAMP[i].map((v, n) => v + (RAMP[i + 1][n] - v) * f);
}
const DRIFT = 0.04; // gradient widths per second
const ease = (q: number) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

// Rain falls through the pixel space onto a floor level with the wordmark's baseline. It piles up as a bell curve
// over the word, and wherever a pixel settles on a letter, that piece of the letter turns black.
export function RainFloor() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const host = canvas?.parentElement;
    const fade = host?.querySelector<HTMLElement>("[data-hero-fade=word]");
    const word = host?.querySelector<HTMLElement>("[data-word-text]");
    const heading = host?.querySelector<HTMLElement>("[data-hero-word]");
    const probe = host?.querySelector<HTMLElement>("[data-baseline]");
    if (!canvas || !ctx || !host || !word || !heading || !probe || !fade) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    // Same grid as the pixel field, so the rain reads as part of that space; finer on phones, where the word is small
    let CELL = 12, SIZE = 7;
    let W = 0, H = 0, cols = 0, floor = 0, mid = 0, sigma = 1, rate = 1.6;
    let pool = new Uint8Array(0), cap = new Uint8Array(0);
    let drops: Drop[] = [], sparks: Spark[] = [], motes: Mote[] | null = null;
    let text: Word | null = null;
    let pointer = { x: -1e4, y: -1e4 };
    let raf = 0, last = 0, raining = false, onScreen = true;

    // Where the DOM wordmark actually sits, so the floor meets its baseline and the black lands on its letters
    function measure() {
      const o = host!.getBoundingClientRect();
      const r = word!.getBoundingClientRect();
      const st = getComputedStyle(word!);
      const font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      ctx!.font = font;
      const m = ctx!.measureText(WORD);
      const base = probe!.getBoundingClientRect().top - o.top;
      text = { font, x: r.left - o.left, base, w: m.width, h: m.actualBoundingBoxAscent };
      // The floor only follows the word while it rests; once the lift starts the word fades where it stands
      if (rain.lift <= 0 && Math.abs(base - floor) > 0.5) {
        floor = base;
        host!.style.setProperty("--floor", `${floor}px`);
      }
    }

    function size() {
      const r = host!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      [CELL, SIZE] = W < 640 ? [7, 4] : [12, 7];
      measure();
      // The bell: a broad-shouldered curve (a flattened Gaussian) whose top stays above the letters across the whole
      // word, so all of it can go black, before falling away either side
      cols = Math.ceil(W / CELL);
      mid = text!.x + text!.w / 2;
      sigma = Math.max(60, text!.w * 0.64);
      const peak = Math.ceil(text!.h / CELL) + 3;
      cap = Uint8Array.from({ length: cols }, (_, c) => Math.round(peak * Math.exp(-0.5 * ((c * CELL + SIZE / 2 - mid) / sigma) ** 4)));
      // Heavier rain for a bigger bell, so it fills in roughly the same few seconds at any size
      rate = Math.max(1, cap.reduce((a, b) => a + b, 0) / 640); // drops fall slowly, so fewer are needed on screen
      pool = calm ? cap.slice() : Uint8Array.from({ length: cols }, (_, c) => Math.min(pool[c] ?? 0, cap[c]));
      motes = null;
      if (calm) draw(0);
    }

    function splash(x: number, y: number, dir: number) {
      for (let k = 0; k < 2; k++)
        sparks.push({ x, y, vx: (dir || (Math.random() < 0.5 ? -1 : 1)) * (0.6 + Math.random() * 1.8), vy: -(1.2 + Math.random() * 2.6), life: 1 });
    }

    function step(f: number) {
      if (raining && rain.lift <= 0) {
        // Most drops fall around the word, which is how the bell builds; the rest keep the whole sky raining
        for (let n = rate * f; n > 0; n--) {
          if (Math.random() >= n) continue;
          const x = Math.random() < 0.7 ? mid + gauss() * sigma * 0.85 : Math.random() * W;
          const c = Math.floor(x / CELL);
          if (c >= 0 && c < cols) drops.push({ c, y: -40 - Math.random() * 60, v: 1.4 + Math.random() * 1.8 });
        }
      }
      for (const d of drops) {
        const prev = d.y;
        d.v = Math.min(7, d.v + 0.07 * f); // a slow, heavy rain
        d.y += d.v * f;
        const x = d.c * CELL + SIZE / 2;
        const dx = x - pointer.x;
        if (Math.abs(dx) < UMBRELLA && pointer.y < floor) {
          const top = pointer.y - Math.sqrt(UMBRELLA * UMBRELLA - dx * dx) * 0.55;
          if (prev < top && d.y >= top) {
            splash(x, top, Math.sign(dx));
            d.y = Infinity;
            continue;
          }
        }
        const surface = floor - pool[d.c] * CELL;
        if (d.y >= surface) {
          if (pool[d.c] < cap[d.c] && rain.lift <= 0) pool[d.c]++;
          splash(x, surface, 0);
          d.y = Infinity;
        }
      }
      drops = drops.filter((d) => d.y !== Infinity);
      for (const s of sparks) {
        s.vy += 0.22 * f;
        s.x += s.vx * f;
        s.y += s.vy * f;
        s.life -= 0.045 * f;
      }
      sparks = sparks.filter((s) => s.life > 0);
    }

    // The gradient's position at a given x, one full cycle across the word's width
    const hue = (x: number, T: number) => aurora((x - (text?.x ?? 0)) / (text?.w || W) - T * DRIFT);
    const wordAlpha = () => Number(getComputedStyle(heading!).opacity) * Number(getComputedStyle(fade!).opacity);

    // The wordmark itself, painted in the same gradient as the pixels
    function paintWord(T: number, alpha: number) {
      if (!text || alpha <= 0) return;
      const g = ctx!.createLinearGradient(text.x, 0, text.x + text.w, 0);
      for (let k = 0; k <= 8; k++) {
        const [r, gg, b] = aurora(k / 8 - T * DRIFT);
        g.addColorStop(k / 8, `rgb(${r | 0},${gg | 0},${b | 0})`);
      }
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.font = text.font;
      ctx!.fillStyle = g;
      ctx!.fillText(WORD, text.x, text.base);
      ctx!.restore();
    }

    // Every pixel of the bell gets a destination inside one of the cards, and a curved path to it
    function lift(T: number) {
      const src: { x: number; y: number; c: number }[] = [];
      for (let c = 0; c < cols; c++) for (let k = 0; k < pool[c]; k++) src.push({ x: c * CELL, y: floor - (k + 1) * CELL + (CELL - SIZE), c });
      // Someone who scrolls straight away still sees enough pixels to build the cards
      while (src.length < 420 && cols) {
        const c = Math.min(cols - 1, Math.max(0, Math.floor((mid + gauss() * sigma * 0.7) / CELL)));
        src.push({ x: c * CELL, y: floor - CELL + (CELL - SIZE), c });
      }
      const pts: { x: number; y: number }[] = [];
      for (const t of rain.targets)
        for (let y = t.y + CELL; y < t.y + t.h - CELL; y += CELL) for (let x = t.x + CELL; x < t.x + t.w - CELL; x += CELL) pts.push({ x, y });
      if (!pts.length) return [];
      src.sort((a, b) => a.x - b.x);
      pts.sort((a, b) => a.x - b.x || a.y - b.y);
      return src.map((s, i) => {
        const p = pts[Math.floor((i * pts.length) / src.length)];
        return {
          sx: s.x, sy: s.y, tx: p.x, ty: p.y,
          cx: (s.x + p.x) / 2 + (Math.random() - 0.5) * 260,
          cy: Math.min(s.y, p.y) - 60 - Math.random() * 180,
          d: (Math.abs(s.x - mid) / W) * 0.4 + Math.random() * 0.12,
          rgb: hue(s.x, T),
        };
      });
    }

    // Each settled cell turns its piece of the letter black
    function blacken(cells: Path2D, alpha: number) {
      if (!text || alpha <= 0) return;
      ctx!.save();
      ctx!.clip(cells);
      ctx!.globalAlpha = alpha;
      ctx!.font = text.font;
      ctx!.fillStyle = "#000";
      ctx!.fillText(WORD, text.x, text.base);
      ctx!.restore();
    }

    function draw(T: number) {
      ctx!.clearRect(0, 0, W, H);
      const L = rain.lift;
      const alpha = wordAlpha();
      paintWord(T, alpha);
      if (L > 0) {
        motes ??= lift(T);
        const buried = new Path2D();
        let anyBuried = false;
        for (const m of motes) {
          const q = Math.min(1, Math.max(0, (L - m.d) / 0.55));
          if (q <= 0 && text && m.sx + CELL > text.x && m.sx < text.x + text.w) {
            buried.rect(m.sx, m.sy - (CELL - SIZE), CELL, CELL);
            anyBuried = true;
          }
          if (q >= 1) continue;
          const e = ease(q), u = 1 - e;
          const x = u * u * m.sx + 2 * u * e * m.cx + e * e * m.tx;
          const y = u * u * m.sy + 2 * u * e * m.cy + e * e * m.ty;
          const w = q * 0.8; // cools to ice as it arrives
          const a = q < 0.75 ? 0.95 : (0.95 * (1 - q)) / 0.25;
          ctx!.fillStyle = `rgba(${(m.rgb[0] + (225 - m.rgb[0]) * w) | 0},${(m.rgb[1] + (236 - m.rgb[1]) * w) | 0},${(m.rgb[2] + (255 - m.rgb[2]) * w) | 0},${a})`;
          ctx!.fillRect(x | 0, y | 0, SIZE, SIZE);
        }
        // Letters stay black under the pixels that haven't left yet, fading out with the word
        if (anyBuried) blacken(buried, alpha);
        return;
      }
      motes = null;

      // The bell: brightest along its surface, a slow aurora running through it
      const buried = new Path2D();
      let anyBuried = false;
      const t = text;
      for (let c = 0; c < cols; c++) {
        const x = c * CELL;
        const [r, g, b] = hue(x + SIZE / 2, T);
        for (let k = 0; k < pool[c]; k++) {
          const top = k === pool[c] - 1;
          const y = floor - (k + 1) * CELL;
          ctx!.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${top ? 0.8 + 0.2 * Math.sin(T * 3 + c * 0.7) : 0.55 + 0.04 * (pool[c] - k)})`;
          ctx!.fillRect(x, y + (CELL - SIZE), SIZE, SIZE);
          if (t && x + CELL > t.x && x < t.x + t.w && y + CELL > t.base - t.h) {
            buried.rect(x, y, CELL, CELL);
            anyBuried = true;
          }
        }
      }
      if (anyBuried) blacken(buried, alpha);
      // Drops land on the grid like the rest of the field, each with a short fading streak
      for (const d of drops) {
        const y = Math.floor(d.y / CELL) * CELL;
        const x = d.c * CELL;
        for (let k = 0; k < 4; k++) {
          const yy = y - k * CELL;
          if (yy > floor - CELL) continue;
          ctx!.fillStyle = `rgba(222,234,255,${[0.85, 0.32, 0.14, 0.05][k]})`;
          ctx!.fillRect(x, yy, SIZE, SIZE);
        }
      }
      for (const s of sparks) {
        ctx!.fillStyle = `rgba(222,234,255,${s.life * 0.8})`;
        ctx!.fillRect(s.x, s.y, 3, 3);
      }
    }

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const f = last ? Math.min(3, (now - last) / 16.7) : 1;
      last = now;
      if (!onScreen) return;
      measure();
      step(f);
      draw(now / 1000);
    }

    const move = (e: PointerEvent) => {
      const r = host!.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const leave = () => (pointer = { x: -1e4, y: -1e4 });
    const ro = new ResizeObserver(size);
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    let live = true;
    // The wordmark's font has to be in before its letters can be measured or redrawn
    document.fonts.ready.then(() => {
      if (!live) return;
      ro.observe(host);
      size();
      if (calm) return;
      io.observe(canvas);
      raf = requestAnimationFrame(tick);
    });
    if (!calm) {
      afterLoaded().then(() => (raining = true));
      addEventListener("pointermove", move);
      document.addEventListener("pointerleave", leave);
    }
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20" />;
}
