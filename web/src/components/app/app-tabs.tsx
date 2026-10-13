"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glyph, Slashes } from "@/components/glyph";
import { Stage } from "@/components/app/stage";

const TABS = [
  { href: "/app/cover", label: "Rain cover", hint: "Buy a payout for a day", object: <Slashes still tilt={6} className="h-16" /> },
  { href: "/app/underwrite", label: "Underwrite", hint: "Back guarantees, earn fees", object: <Glyph kind="plus" still tilt={-8} className="w-14" /> },
  { href: "/app/dashboard", label: "Dashboard", hint: "Live on Monad testnet", object: <Glyph kind="hash" still tilt={6} className="w-14" /> },
];

// The app's three rooms as glass cards. The open one sits forward; the others lean back and come forward under the
// pointer. Each card's glass object breaks out over its top edge.
export function AppTabs() {
  const path = usePathname();
  return (
    <Stage>
      <nav aria-label="App" className="grid grid-cols-3 gap-3 sm:gap-5">
        {TABS.map((t, i) => {
          const on = path.startsWith(t.href);
          const turn = [10, 0, -10][i];
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              data-pop
              style={{ "--pop": `translateZ(${on ? 70 : 0}px) rotateY(${on ? 0 : turn}deg)` } as React.CSSProperties}
              className={`group relative block pt-8 transition-transform duration-500 ease-out lg:[transform-style:preserve-3d] lg:[transform:var(--pop)] lg:hover:[transform:translateZ(70px)] ${i === 0 ? "origin-right" : i === 2 ? "origin-left" : ""}`}
            >
              <span className="relative isolate block px-4 pb-4 pt-6 sm:px-6 lg:isolation-auto lg:[transform-style:preserve-3d]">
                <span
                  aria-hidden
                  className={`glass curved absolute inset-0 -z-10 lg:z-auto lg:[transform:translateZ(-1px)] ${on ? "ring-1 ring-floor/60" : "glass-quiet"}`}
                />
                <span className={`relative block font-display text-sm leading-tight sm:text-lg ${on ? "text-ink" : "text-muted group-hover:text-ink"}`}>
                  {t.label}
                </span>
                <span className="relative mt-1 hidden text-xs text-muted sm:block">{t.hint}</span>
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute -top-1 right-3 lg:[transform:translateZ(90px)] sm:right-5"
              >
                {t.object}
              </span>
            </Link>
          );
        })}
      </nav>
    </Stage>
  );
}
