import { gsap, ScrollTrigger, SplitText } from "./gsap";

type Cleanup = () => void;

const NS = "http://www.w3.org/2000/svg";
const EDGE = 14; // how far the frame's lines run past the panel's corners
const ENTER = "top 90%";

// A nested scroller, if a page has one, is named with data-scroller; everything else scrolls the window.
const scrollerOf = (el: Element) => el.closest<HTMLElement>("[data-scroller]") ?? undefined;
const mark = (el: HTMLElement) => {
  el.dataset.ol = "run";
};

/** Panels draw their frame, then the glass opens like a blind from the top-left and the content lands inside. */
function outline(el: HTMLElement): Cleanup {
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ol-svg");
  svg.setAttribute("aria-hidden", "true");
  el.prepend(svg);

  const content = [...el.children].filter((c) => c !== svg && !(c as HTMLElement).hasAttribute("data-glyph")) as HTMLElement[];
  let w = 0;
  let h = 0;
  let state: "idle" | "playing" | "done" = "idle";
  let tl: gsap.core.Timeline | undefined;

  const path = (d: string, cls: string) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("pathLength", "1");
    p.setAttribute("class", cls);
    return p;
  };
  const draw = () => {
    if (el.offsetWidth === w && el.offsetHeight === h) return;
    w = el.offsetWidth;
    h = el.offsetHeight;
    const lines = [
      `M${-EDGE} .5H${w + EDGE}`,
      `M${w - 0.5} ${-EDGE}V${h + EDGE}`,
      `M${w + EDGE} ${h - 0.5}H${-EDGE}`,
      `M.5 ${h + EDGE}V${-EDGE}`,
    ];
    svg.replaceChildren(...lines.flatMap((d) => [path(d, "ol-lead"), path(d, "ol-line")]));
    // A redraw once the panel has landed keeps the frame whole
    if (state === "done") gsap.set(svg.querySelectorAll(".ol-line"), { strokeDashoffset: 0 });
  };
  draw();
  const ro = new ResizeObserver(draw);
  ro.observe(el);

  const hidden = () => `inset(${-EDGE}px ${el.offsetWidth}px ${el.offsetHeight}px ${-EDGE}px)`;
  gsap.set(el, { clipPath: hidden() });
  gsap.set(content, { autoAlpha: 0, y: -16 });
  gsap.set(svg.querySelectorAll(".ol-line,.ol-lead"), { strokeDashoffset: 1 });
  mark(el);

  const play = (speed = 1) => {
    if (state !== "idle") return;
    state = "playing";
    const lines = svg.querySelectorAll(".ol-line");
    const leads = svg.querySelectorAll(".ol-lead");
    gsap.set(el, { clipPath: hidden() });
    tl = gsap.timeline({
      onComplete: () => {
        state = "done";
        el.dataset.ol = "done";
        gsap.set(el, { clearProps: "clipPath" });
      },
    });
    tl.fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: "power3.inOut", stagger: 0.08 }, 0);
    tl.fromTo(leads, { strokeDashoffset: 0.05 }, { strokeDashoffset: -1, duration: 0.9, ease: "power3.inOut", stagger: 0.08 }, 0);
    tl.to(leads, { opacity: 0, duration: 0.3 }, 0.75);
    tl.to(el, { clipPath: "inset(-400px -400px -400px -400px)", duration: 1, ease: "power3.inOut" }, 0.12);
    tl.to(content, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.07 }, 0.4);
    tl.timeScale(speed);
  };

  const onFocus = () => play(3);
  el.addEventListener("focusin", onFocus);
  const st = ScrollTrigger.create({ trigger: el, start: ENTER, once: true, scroller: scrollerOf(el), onEnter: () => play() });

  return () => {
    st.kill();
    tl?.kill();
    ro.disconnect();
    el.removeEventListener("focusin", onFocus);
    svg.remove();
    gsap.set([el, ...content], { clearProps: "clipPath,opacity,visibility,transform" });
    delete el.dataset.ol;
  };
}

// Glass glyphs follow the pointer in 3D; one listener serves them all
type Tilt = { rx: gsap.QuickToFunc; ry: gsap.QuickToFunc; x: gsap.QuickToFunc; depth: number };
const tilts = new Set<Tilt>();
let tiltBound = false;
function bindTilt() {
  if (tiltBound || matchMedia("(pointer: coarse)").matches) return;
  tiltBound = true;
  let raf = 0;
  addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const nx = (e.clientX / innerWidth - 0.5) * 2;
      const ny = (e.clientY / innerHeight - 0.5) * 2;
      for (const t of tilts) {
        t.ry(nx * 16 * t.depth * 2);
        t.rx(-ny * 12 * t.depth * 2);
        t.x(-nx * 26 * t.depth);
      }
    });
  });
}

/** A glyph assembles out of blur, drifts with scroll at its own depth, bobs, and leans toward the pointer. */
function glyph(el: HTMLElement): Cleanup {
  const inner = el.querySelector<HTMLElement>("[data-glyph-in]");
  if (!inner) return () => {};
  const depth = parseFloat(el.dataset.depth ?? "0.4");
  const tilt = parseFloat(el.dataset.tilt ?? "0");
  const scroller = scrollerOf(el);
  const parent = el.parentElement ?? el;

  gsap.set(el, { transformPerspective: 900 });
  gsap.set(inner, { autoAlpha: 0, scale: 0.7, rotation: tilt - 26, y: 44, filter: "blur(14px)" });
  mark(el);

  const bob = gsap.to(inner, { yPercent: -4, duration: 3 + depth * 3, ease: "sine.inOut", yoyo: true, repeat: -1 });
  const enter = ScrollTrigger.create({
    trigger: parent,
    start: ENTER,
    once: true,
    scroller,
    onEnter: () =>
      gsap.to(inner, {
        autoAlpha: 1,
        scale: 1,
        rotation: tilt,
        y: 0,
        filter: "blur(0px)",
        duration: 1.5,
        ease: "expo.out",
        delay: depth * 0.4,
        onComplete: () => void gsap.set(inner, { clearProps: "filter" }),
      }),
  });
  const drift = gsap.fromTo(
    el,
    { y: 70 * depth },
    { y: -70 * depth, ease: "none", scrollTrigger: { trigger: parent, start: "top bottom", end: "bottom top", scrub: 0.8, scroller } },
  );

  const t: Tilt = {
    rx: gsap.quickTo(el, "rotationX", { duration: 0.9, ease: "power3.out" }),
    ry: gsap.quickTo(el, "rotationY", { duration: 0.9, ease: "power3.out" }),
    x: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" }),
    depth,
  };
  bindTilt();
  tilts.add(t);

  return () => {
    tilts.delete(t);
    bob.kill();
    enter.kill();
    drift.scrollTrigger?.kill();
    drift.kill();
    gsap.killTweensOf([el, inner]);
    gsap.set([el, inner], { clearProps: "all" });
    delete el.dataset.ol;
  };
}

/** Headlines rise line by line out of a mask. */
function split(el: HTMLElement): Cleanup {
  const s = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line" });
  gsap.set(s.lines, { yPercent: 115 });
  mark(el);
  const st = ScrollTrigger.create({
    trigger: el,
    start: ENTER,
    once: true,
    scroller: scrollerOf(el),
    onEnter: () => gsap.to(s.lines, { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.11 }),
  });
  return () => {
    st.kill();
    gsap.killTweensOf(s.lines);
    s.revert();
    delete el.dataset.ol;
  };
}

/** Anything else just settles into place. */
function rise(el: HTMLElement): Cleanup {
  const delay = parseFloat(el.dataset.rise || "0") || 0;
  gsap.set(el, { autoAlpha: 0, y: 22 });
  mark(el);
  const st = ScrollTrigger.create({
    trigger: el,
    start: ENTER,
    once: true,
    scroller: scrollerOf(el),
    onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", delay }),
  });
  return () => {
    st.kill();
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: "opacity,visibility,transform" });
    delete el.dataset.ol;
  };
}

const HANDLERS: [string, (el: HTMLElement) => Cleanup][] = [
  ["[data-split]", split],
  ["[data-outline]", outline],
  ["[data-glyph]", glyph],
  ["[data-rise]", rise],
];

/** Attach motion to everything marked up in the page now, and to whatever the page adds later. */
export function attachAll(): Cleanup {
  const cleanups: Cleanup[] = [];
  let refresh = 0;

  const scan = () => {
    let added = false;
    for (const [sel, fn] of HANDLERS)
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (el.dataset.ol || !el.isConnected) continue;
        cleanups.push(fn(el));
        added = true;
      }
    if (added) {
      clearTimeout(refresh);
      refresh = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    }
  };
  scan();

  let raf = 0;
  const mo = new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      scan();
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    clearTimeout(refresh);
    cancelAnimationFrame(raf);
    while (cleanups.length) cleanups.pop()!();
  };
}
