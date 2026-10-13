"use client";

import { useEffect, useRef } from "react";

// Looping clip of glass panes on the guaranteed floor; its edges fade out so the black frame melts into the page
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);

  return (
    <video
      ref={ref}
      className={`aspect-[2/1] mix-blend-screen [mask-image:radial-gradient(ellipse_closest-side,black_70%,transparent)] ${className}`}
      poster="/hero/hero-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
    >
      <source src="/hero/hero.webm" type="video/webm" />
      <source src="/hero/hero.mp4" type="video/mp4" />
    </video>
  );
}
