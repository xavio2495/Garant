"use client";

import { useEffect, useState } from "react";

type Chapter = { id: string; title: string };

// A quiet index of the chapters in the left margin: pixel ticks, with the current chapter named beside them.
// The story's chapters share one pinned stage, so the stage reports where it is ("garant:chapter") and where
// each chapter sits in the scroll ("garant:stops"); the footer is found by position.
export function StoryRail({ chapters }: { chapters: readonly Chapter[] }) {
  const [active, setActive] = useState(0);
  const [stops, setStops] = useState<number[]>([]);

  useEffect(() => {
    const onChapter = (e: Event) => setActive((e as CustomEvent<number>).detail);
    const onStops = (e: Event) => setStops((e as CustomEvent<number[]>).detail);
    addEventListener("garant:chapter", onChapter);
    addEventListener("garant:stops", onStops);
    const foot = document.getElementById("footer");
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setActive(chapters.length - 1), { rootMargin: "-40% 0px 0px 0px" });
    if (foot) io.observe(foot);
    return () => {
      removeEventListener("garant:chapter", onChapter);
      removeEventListener("garant:stops", onStops);
      io.disconnect();
    };
  }, [chapters]);

  const go = (i: number) => {
    const foot = document.getElementById("footer");
    const top = i === chapters.length - 1 ? foot?.offsetTop : stops[i];
    if (top !== undefined) scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav aria-label="Chapters" className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 items-center gap-3 xl:flex">
      <ol className="flex flex-col gap-3">
        {chapters.map((c, i) => (
          <li key={c.id}>
            <button
              onClick={() => go(i)}
              aria-current={i === active ? "step" : undefined}
              data-past={i < active}
              className="block h-1.5 w-1.5 bg-white/25 transition-all hover:bg-white/60 aria-[current=step]:h-6 aria-[current=step]:bg-floor data-[past=true]:bg-white/50"
            >
              <span className="sr-only">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <p aria-hidden className="w-20 font-mono text-[0.62rem] uppercase leading-snug tracking-[0.14em] text-muted">
        {chapters[active]?.title}
      </p>
    </nav>
  );
}
