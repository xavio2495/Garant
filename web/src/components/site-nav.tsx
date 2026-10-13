import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

const LINKS = [
  { href: "/deck", label: "Deck" },
  { href: "/api", label: "API" },
];

// The public pages' top bar, fixed so the way out is always in reach: the mark, the index, the app, and the network.
// A spacer keeps its height in the flow; the landing pulls its full-screen story up underneath it. `extra` sits
// after the buttons (the app puts the account there).
export function SiteNav({ extra }: { extra?: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-[5.25rem]" />
      <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-paper/90 via-paper/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Link href="/" aria-label="Garant, home" className="flex items-center">
            <BrandMark className="size-9" />
          </Link>
          <nav className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="btn btn-glass px-3 py-2 sm:px-4">
                {l.label}
              </Link>
            ))}
            <Link href="/app" className="btn btn-glass px-3 py-2 sm:px-4">
              Open app
            </Link>
            {extra}
            <span className="ml-3 hidden items-center gap-2 text-muted md:flex">
              <span className="size-1.5 animate-pulse bg-floor shadow-[0_0_8px_1px_rgb(90_255_200/0.7)]" />
              Monad testnet
            </span>
          </nav>
        </div>
      </header>
    </>
  );
}
