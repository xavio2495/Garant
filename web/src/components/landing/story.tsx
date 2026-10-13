"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Glyph, Slashes, type GlyphKind } from "@/components/glyph";
import { RainFloor, rain } from "@/components/landing/rain-floor";
import { TesterStart } from "@/components/tester-start";
import { field, waveFront, waveWob } from "@/lib/motion/field-bus";
import { gsap } from "@/lib/motion/gsap";
import { afterLoaded, afterShock } from "@/lib/motion/ready";
import { wavePass } from "@/lib/motion/wave";

const TAGLINE = "A floor under the things you can’t control.";

const ABOUT_CARDS = [
  { code: "A", title: "Fully funded", body: "Every payout is locked in dollars before anyone can buy." },
  { code: "B", title: "Settles itself", body: "Two independent public sources decide the outcome. No claim form." },
  { code: "C", title: "Priced in the open", body: "An on-chain order book sets the price of each guarantee." },
];

type Tile = { href: string; code: string; title: string; body: string; glyph: GlyphKind; size: string; tilt: number; w: number; h: number };
const TILES: Tile[] = [
  { href: "/partner", code: "01", title: "Protected transfers", glyph: "arrows", size: "w-[6.5rem]", tilt: -4, w: 20, h: 20, body: "A money-transfer app adds one line to its checkout. The family at home is guaranteed at least ₱62.50 per dollar for 30 days." },
  { href: "/app/cover", code: "02", title: "Rain cover", glyph: "slash", size: "h-[7rem]", tilt: 6, w: 13.5, h: 20, body: "Pick a date, a place and a rainfall level. If two independent weather sources agree it rained, it pays." },
  { href: "/app/underwrite", code: "03", title: "Underwrite", glyph: "plus", size: "w-[5.5rem]", tilt: -8, w: 15.5, h: 20, body: "Back the guarantees with dollars and earn the fee. Every payout is funded in full before anyone buys." },
  { href: "/app/dashboard", code: "04", title: "Dashboard", glyph: "hash", size: "w-[5.5rem]", tilt: 5, w: 15, h: 20, body: "Live figures from Monad testnet: money locked, protection outstanding, and how fast each series settled." },
  { href: "/api", code: "05", title: "Partner API", glyph: "braces", size: "w-[6rem]", tilt: -5, w: 14, h: 20, body: "Quote, buy and check a guarantee over plain HTTPS and JSON. Five endpoints." },
];

// Timeline units (the pin lasts about half a screen per unit). After the hold, the bell curve lifts into the
// About cards over `liftLen`; then two waves swap the scenes.
const U = { hold: 0.5, liftLen: 2.4, w1: 4.6, w2: 8.6, wave: 2.0, end: 12.9 };
const STOPS = [0, 3.4, 7.6, 11.9]; // intro, about, engine, start

const rad = (d: number) => (d * Math.PI) / 180;
type Pose = { x: number; y: number; z: number; ry: number; rx?: number };

// Each scene seats its cards in 3D differently. Engine: a bento row bent into a concave arc, the ends
// swung toward the viewer. About: a concave sweep. Try it: a staircase receding into depth.
const deg = (r: number) => (r * 180) / Math.PI;
const ARRANGE: Record<string, (cards: HTMLElement[]) => Pose[]> = {
  engine: (cards) => {
    const gap = innerWidth * 0.012, R = innerWidth * 1.1;
    const ws = cards.map((c) => c.offsetWidth);
    const lift = [10, -34, 16, -34, 10];
    let cursor = -(ws.reduce((a, b) => a + b, 0) + gap * (cards.length - 1)) / 2;
    return cards.map((_, i) => {
      const cx = cursor + ws[i] / 2;
      cursor += ws[i] + gap;
      const t = cx / R;
      return { x: cx, y: lift[i] ?? 0, z: R * (1 - Math.cos(t)) * 0.3, ry: -deg(t) * 0.7 };
    });
  },
  about: (cards) => {
    const n = cards.length, R = innerWidth * 0.32, A = 26, mid = (n - 1) / 2;
    return cards.map((_, i) => {
      const t = rad((i - mid) * A);
      return { x: R * Math.sin(t), y: -Math.abs(i - mid) * 10, z: R * (1 - Math.cos(t)) * 0.9 - 60, ry: -(i - mid) * A };
    });
  },
  start: (cards) =>
    cards.map((c, i) => ({ x: (i - (cards.length - 1) / 2) * (c.offsetWidth + innerWidth * 0.02), y: -(i - (cards.length - 1) / 2) * 30, z: -i * 110 + 80, ry: -12, rx: 6 })),
};

// The landing's story is one pinned stage. Intro: rain falls through the pixel space onto a floor level with the
// wordmark and piles into a bell curve over it; on scroll the bell's pixels lift into the About cards. After that nothing scrolls: each scene is replaced by the next as a pixel wave sweeps through, and the scene's
// title and cards move as one 3D group.
export function Story() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const all = (sel: string, from: ParentNode = el) => gsap.utils.toArray<HTMLElement>(sel, from);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dead = false;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      // The wordmark (painted by the rain canvas, which follows this element's opacity) fades up as the field arrives
      afterShock().then(() => {
        if (!dead) gsap.to("[data-hero-word]", { autoAlpha: 1, duration: calm ? 0 : 1.4, ease: "power2.out" });
      });
      if (calm) return;

      // Time-driven, on every screen size: the floor draws across once the page is loaded, then the words arrive
      gsap.set("[data-ui]", { autoAlpha: 0, y: 16 });
      gsap.set("[data-floor]", { scaleX: 0 });
      afterLoaded().then(() => {
        if (dead) return;
        gsap.timeline()
          .to("[data-floor]", { scaleX: 1, duration: 1.6, ease: "expo.inOut" }, 0)
          .to("[data-ui]", { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.12 }, 1);
      });

      mm.add("(min-width: 1024px)", () => {
        el.dataset.mode = "stage";
        const about = el.querySelector<HTMLElement>("[data-layer=about]")!;
        const scenes = { about, engine: el.querySelector<HTMLElement>("[data-layer=engine]")!, start: el.querySelector<HTMLElement>("[data-layer=start]")! };
        const parts = (l: HTMLElement) => all("[data-part],[data-card],[data-obj]", l);
        const group = (l: HTMLElement) => l.querySelector<HTMLElement>("[data-group]")!;
        const poseOf = new Map<HTMLElement, Pose>();

        // Seat the cards (and the glass objects beside them) in their 3D arrangement
        const seat = () => {
          for (const [name, layer] of Object.entries(scenes)) {
            const arc = layer.querySelector<HTMLElement>("[data-arc]");
            if (!arc) continue;
            const cards = all("[data-card]", arc);
            const objs = all("[data-obj]", arc);
            const poses = ARRANGE[name](cards);
            cards.forEach((c, i) => {
              poseOf.set(c, poses[i]);
              gsap.set(c, { xPercent: -50, yPercent: -50, x: poses[i].x, y: poses[i].y, z: poses[i].z, rotationY: poses[i].ry, rotationX: poses[i].rx ?? 0 });
            });
            // Each glass object floats above its card's top-right corner, nearer the camera, and always inside the screen
            objs.forEach((o, i) => {
              const c = cards[i];
              const limit = innerWidth / 2 - o.offsetWidth - 40;
              const x = Math.max(-limit, Math.min(limit, poses[i].x + c.offsetWidth * 0.2));
              poseOf.set(o, { x, y: poses[i].y - c.offsetHeight / 2 + 6, z: poses[i].z + 150, ry: poses[i].ry * 0.6 });
              gsap.set(o, { xPercent: -50, yPercent: -50, x, y: poses[i].y - c.offsetHeight / 2 + 6, z: poses[i].z + 150, rotationY: poses[i].ry * 0.6 });
            });
            // A pop floats in front of its card, straddling the card's lower edge
            all("[data-pop]", arc).forEach((o) => {
              const i = Number(o.dataset.pop), c = cards[i], p = poses[i];
              const pose = { x: p.x + c.offsetWidth * 0.16, y: p.y + c.offsetHeight / 2, z: p.z + 130, ry: p.ry, rx: p.rx };
              poseOf.set(o, pose);
              gsap.set(o, { xPercent: -50, yPercent: -50, x: pose.x, y: pose.y, z: pose.z, rotationY: pose.ry, rotationX: pose.rx ?? 0 });
            });
          }
          // Where the rain's pixels land: the About cards at rest, in the story's own coordinates
          const o = el.getBoundingClientRect();
          rain.targets = all("[data-card]", about).map((c) => {
            const r = c.getBoundingClientRect();
            return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
          });
        };
        seat();

        for (const l of [scenes.about, scenes.engine, scenes.start]) gsap.set(parts(l), { autoAlpha: 0 });

        let chapter = -1;
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: `+=${U.end * 50}%`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: (self) => {
              seat();
              const stops = STOPS.map((u) => Math.round(self.start + (u / U.end) * (self.end - self.start)));
              dispatchEvent(new CustomEvent("garant:stops", { detail: stops }));
            },
            onUpdate: (self) => {
              const t = self.progress * U.end;
              const i = t < 1.8 ? 0 : t < 5.7 ? 1 : t < 9.7 ? 2 : 3;
              if (i !== chapter) {
                chapter = i;
                dispatchEvent(new CustomEvent("garant:chapter", { detail: i }));
              }
            },
          },
        });

        // 1. The hero holds, then the bell curve's pixels lift off the floor and settle into the About cards
        tl.to("[data-hero-fade=bar]", { autoAlpha: 0, duration: 0.5 }, 0.2)
          .to("[data-hero-fade=sub]", { autoAlpha: 0, y: 40, duration: 0.8, ease: "power2.in" }, 0.2)
          .to(rain, { lift: 1, duration: U.liftLen }, U.hold)
          .to("[data-hero-fade=word]", { autoAlpha: 0, duration: 0.9, ease: "power1.in" }, U.hold + 0.1)
          .to("[data-floor-wrap]", { scaleX: 0, autoAlpha: 0, duration: 0.9, ease: "power2.in" }, U.hold + 0.4)
          .fromTo(all("[data-part]", about), { y: 40 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out" }, U.hold + 0.9)
          .fromTo(all("[data-card]", about), { scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.9, ease: "power3.out", stagger: 0.25 }, U.hold + U.liftLen * 0.4);

        // 2. Scene swaps: the wave sweeps through and the old scene is wiped away exactly along its front, curving off
        // as it goes; the new scene's pieces surface in its wake. Title and cards move together as one 3D group.
        const posed = new Map<HTMLElement, object>();
        const wipes: { layer: HTMLElement; mode: "x" | "y"; w: { p: number }; state: string }[] = [];
        const swap = (from: HTMLElement, to: HTMLElement, at: number, mode: "x" | "y") => {
          const size = mode === "x" ? innerWidth : innerHeight;
          const rest = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, skewX: 0 };
          const enterPose = mode === "x" ? { x: -innerWidth * 0.12, rotationY: -30, z: -300 } : { y: innerHeight * 0.12, rotationX: 28, z: -300 };
          const out = mode === "x" ? { x: innerWidth * 0.12, rotationY: 28, z: -260, skewX: -6 } : { y: -innerHeight * 0.1, rotationX: -25, z: -260 };
          // Where the wave has to be to reach a piece: its leading edge when leaving, its middle when arriving
          const reach = (e: HTMLElement, edge: "lead" | "mid") => {
            const r = e.getBoundingClientRect();
            const coord = mode === "x" ? (edge === "lead" ? r.left : r.left + r.width / 2) : innerHeight - (edge === "lead" ? r.bottom : r.top + r.height / 2);
            return at + U.wave * wavePass(coord, size);
          };
          // Both groups are measured at rest, then put back where they wait
          const waiting = posed.get(group(from)) ?? rest;
          gsap.set(group(from), rest);
          const exits = parts(from).map((p) => reach(p, "lead"));
          gsap.set(group(from), waiting);
          gsap.set(group(to), rest);
          const enters = parts(to).map((p) => reach(p, "mid"));
          gsap.set(group(to), enterPose);
          posed.set(group(to), enterPose);
          const [e0, e1, n0, n1] = [Math.min(...exits), Math.max(...exits), Math.min(...enters), Math.max(...enters)];

          tl.set(field.wave, { on: true, mode, p: 0 }, at)
            .to(field.wave, { p: 1, duration: U.wave }, at)
            .set(field.wave, { on: false }, at + U.wave);
          tl.to(group(from), { ...out, duration: e1 - e0 + 0.9, ease: "power2.in" }, e0 - 0.1);
          const w = { p: 0 };
          wipes.push({ layer: from, mode, w, state: "" });
          tl.to(w, { p: 1, duration: U.wave }, at);
          tl.to(group(to), { ...rest, duration: n1 - n0 + 1.3, ease: "power3.out" }, n0 + 0.1);
          parts(to).forEach((p, i) => tl.fromTo(p, { scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.9, ease: "power3.out" }, enters[i] + 0.15));
        };
        swap(scenes.about, scenes.engine, U.w1, "x");
        swap(scenes.engine, scenes.start, U.w2, "y");

        // The wipe edge is the aurora's own front, which keeps wandering while the wave is held mid-screen
        const CELL = 12;
        const wipe = () => {
          const T = performance.now() / 1000;
          const W = innerWidth, H = Math.ceil(innerHeight / CELL) * CELL;
          for (const x of wipes) {
            const p = x.w.p;
            let clip = "";
            if (p >= 1) clip = "inset(0 0 100% 0)";
            else if (p > 0) {
              const front = waveFront(p, x.mode === "x" ? W : H);
              const pts: string[] = [];
              if (x.mode === "x") {
                for (let y = 0; y <= H; y += CELL * 3) pts.push(`${front + waveWob(y, T)}px ${y}px`);
                pts.push(`${W + 400}px ${H}px`, `${W + 400}px 0px`);
              } else {
                pts.push("0px -400px", `${W}px -400px`);
                for (let v = W; v >= 0; v -= CELL * 3) pts.push(`${v}px ${H - front - waveWob(v, T)}px`);
              }
              clip = `polygon(${pts.join(",")})`;
            }
            if (clip !== x.state) x.layer.style.clipPath = x.state = clip;
          }
        };
        gsap.ticker.add(wipe);

        // Try it: the three cards arrive as one stack, then blast out to their places
        const startCards = all("[data-card]", scenes.start);
        const pops = all("[data-pop]", scenes.start);
        const blastAt = U.w2 + U.wave * 0.85;
        gsap.set(pops, { autoAlpha: 0 });
        // ...and the button to the app lands in front of them once they have
        tl.fromTo(pops, { z: (i: number) => poseOf.get(pops[i])!.z - 260 }, { autoAlpha: 1, z: (i: number) => poseOf.get(pops[i])!.z, duration: 0.8, ease: "back.out(1.6)" }, blastAt + 0.9);
        tl.fromTo(
          startCards,
          { x: 0, y: 0, z: (i: number) => -i * 16, rotationX: 0, rotationY: 0, rotation: (i: number) => [-6, 4, -1][i] ?? 0 },
          {
            x: (i: number) => poseOf.get(startCards[i])!.x,
            y: (i: number) => poseOf.get(startCards[i])!.y,
            z: (i: number) => poseOf.get(startCards[i])!.z,
            rotationX: (i: number) => poseOf.get(startCards[i])!.rx ?? 0,
            rotationY: (i: number) => poseOf.get(startCards[i])!.ry,
            rotation: 0,
            duration: 1.3,
            ease: "back.out(1.3)",
          },
          blastAt,
        );

        // An engine card comes forward under the pointer, about a quarter larger, and slides in towards the middle by
        // as much as it sits out from it, so the cards at the ends stay on screen; its glass object goes with it
        const engineCards = all("[data-card]", scenes.engine);
        const engineObjs = all("[data-obj]", scenes.engine);
        const lift = (i: number, on: boolean) => {
          const c = engineCards[i], o = engineObjs[i];
          const p = poseOf.get(c)!, inward = on ? -p.x * 0.3 : 0;
          gsap.to(c, { x: p.x + inward, z: p.z + (on ? 340 : 0), duration: 0.6, ease: "power3.out", overwrite: "auto" });
          if (o) gsap.to(o, { x: poseOf.get(o)!.x + inward, z: poseOf.get(o)!.z + (on ? 380 : 0), duration: 0.7, ease: "power3.out", overwrite: "auto" });
        };
        const hovers = engineCards.map((c, i) => {
          const on = () => lift(i, true), off = () => lift(i, false);
          c.addEventListener("pointerenter", on);
          c.addEventListener("pointerleave", off);
          return () => {
            c.removeEventListener("pointerenter", on);
            c.removeEventListener("pointerleave", off);
          };
        });
        tl.to({}, { duration: U.end - (U.w2 + U.wave + 1.4) }, U.w2 + U.wave + 1.4);

        // Glass objects drift on their own; the camera leans with the pointer
        const floats = all("[data-obj] .glyph-in").map((g, i) => gsap.to(g, { yPercent: i % 2 ? -5 : 5, duration: 3 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 }));
        const cams = all("[data-camera]").map((c) => ({ rx: gsap.quickTo(c, "rotationX", { duration: 1, ease: "power3.out" }), ry: gsap.quickTo(c, "rotationY", { duration: 1, ease: "power3.out" }) }));
        const move = (e: PointerEvent) => {
          for (const c of cams) {
            c.ry((e.clientX / innerWidth - 0.5) * 9);
            c.rx(-(e.clientY / innerHeight - 0.5) * 6);
          }
        };
        addEventListener("pointermove", move);
        return () => {
          gsap.ticker.remove(wipe);
          for (const x of wipes) x.layer.style.clipPath = "";
          hovers.forEach((h) => h());
          removeEventListener("pointermove", move);
          floats.forEach((f) => f.kill());
          field.wave.on = false;
          rain.lift = 0;
          rain.targets = [];
          delete el.dataset.mode;
        };
      });

      mm.add("(max-width: 1023px)", () => {
        all("[data-part],[data-card]", el).forEach((c) =>
          gsap.from(c, { autoAlpha: 0, y: 60, rotationX: -25, transformPerspective: 900, duration: 1, ease: "power3.out", scrollTrigger: { trigger: c, start: "top 90%", once: true } }),
        );
      });
    }, el);
    return () => {
      dead = true;
      mm.revert();
      ctx.revert();
    };
  }, []);

  return (
    // The wrapper is what React adds and removes; the pin wraps the section inside it, out of React's sight
    <div className="-mt-[5.25rem]">
    <section id="story" ref={root} className="story relative">
      {/* Intro: the rain and the floor (stacking is set in CSS) */}
      <div data-layer="intro" className="story-layer story-intro">
        <RainFloor />
        <div data-floor-wrap aria-hidden className="pointer-events-none absolute inset-x-0 z-[1]" style={{ top: "var(--floor, 80%)" }}>
          <div data-floor className="floor-line" />
          <div className="mt-3 flex justify-between px-6 font-mono text-[0.62rem] uppercase tracking-[0.25em] text-floor sm:px-10">
            <span data-ui data-intro-hide>Floor</span>
            <span data-ui data-intro-hide>Fully funded</span>
          </div>
        </div>
        <div data-hero-fade="word" className="pointer-events-none absolute inset-x-0 bottom-[22svh] z-10 px-4 text-center sm:bottom-[19svh]">
          <h1 data-hero-word aria-label="Garant" className="font-title text-[min(18vw,22svh)] leading-[0.8] sm:text-[min(15vw,30svh)]">
            <span data-word-text aria-hidden className="text-transparent">Garant</span>
            <span data-baseline aria-hidden className="inline-block size-0 align-baseline" />
          </h1>
        </div>
        <div data-hero-fade="sub" className="absolute inset-x-0 z-10 px-4 text-center" style={{ top: "calc(var(--floor, 80%) + 2.25rem)" }}>
          <p data-ui data-intro-hide className="font-display text-[clamp(1rem,2vw,1.9rem)] leading-tight">{TAGLINE}</p>
        </div>
        <div data-hero-fade="bar" className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center">
          <p data-ui data-intro-hide className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted">Scroll ↓</p>
        </div>
      </div>

      {/* About */}
      <div id="about" data-layer="about" className="story-layer">
        <div data-camera className="story-inner">
          <div data-group className="story-group grid items-center gap-10 lg:grid-cols-[1.05fr_1.25fr]">
            <div data-part>
              <h2 className="font-display text-[clamp(1.4rem,2.5vw,2.5rem)] leading-[1.1]">
                Some people can’t afford for the number to move.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
                A family on a fixed peso budget lives on the dollar rate. An organiser with one outdoor date lives on the
                forecast. Neither can hedge today.
              </p>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink">
                Garant sells them a floor: a guaranteed minimum, paid for in full before it is sold, that settles itself
                from public data.
              </p>
            </div>
            <div data-arc="about" className="arc grid gap-5 sm:grid-cols-3">
              {ABOUT_CARDS.map((c) => (
                <article key={c.code} data-card className="glass flex flex-col p-6 sm:p-7">
                  <span className="font-pixel text-2xl text-floor">{c.code}</span>
                  <h3 className="mt-auto font-display text-xl leading-tight sm:text-2xl">{c.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{c.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* One engine */}
      <div data-layer="engine" className="story-layer">
        <div data-camera className="story-inner">
          <div data-group className="story-group">
            <div data-part className="max-w-4xl">
              <h2 className="font-display text-[clamp(1.5rem,3.4vw,3.2rem)] leading-[1.08]">
                Any risk with <span className="text-muted">two data sources.</span>
              </h2>
            </div>
            <div data-arc="engine" className="arc mt-10 grid gap-5 md:grid-cols-6">
              {TILES.map((t, i) => (
                <Link key={t.href} href={t.href} data-card style={{ "--cw": `${t.w}vw`, "--ch": `${t.h}rem` } as React.CSSProperties} className={`glass glass-quiet group flex min-h-60 flex-col p-6 sm:p-8 ${i === 0 ? "md:col-span-4" : "md:col-span-2"}`}>
                  <span className="font-pixel text-2xl text-floor">{t.code}</span>
                  <h3 className="mt-auto break-words font-display text-xl leading-tight xl:text-2xl">{t.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{t.body}</p>
                </Link>
              ))}
              {TILES.map((t) => (
                <span key={t.glyph} data-obj>
                  {t.glyph === "slash" ? <Slashes still tilt={t.tilt} className={t.size} /> : <Glyph kind={t.glyph} still tilt={t.tilt} className={t.size} />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Try it */}
      <div data-layer="start" className="story-layer">
        <div data-camera className="story-inner">
          <div data-group className="story-group">
            <TesterStart />
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}
