"use client";

import { useEffect, useRef } from "react";

// The rotating glass hex, rendered on black; screen blending lets the pixel field show through it
export function HexVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);

  return (
    <video
      ref={ref}
      className={`aspect-square mix-blend-screen [mask-image:radial-gradient(closest-side,black_78%,transparent)] ${className}`}
      poster="/glass/hex-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
    >
      <source src="/glass/hex.webm" type="video/webm" />
      <source src="/glass/hex.mp4" type="video/mp4" />
    </video>
  );
}
