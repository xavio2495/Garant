"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers";

const LINKS = [
  { href: "/cover", label: "Rain cover" },
  { href: "/underwrite", label: "Underwrite" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/api", label: "API" },
];

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function SiteHeader() {
  const path = usePathname();
  const auth = useAuth();
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 rounded-xl bg-[#0b0b0b]/85 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path d="M3 19.5h18" stroke="var(--color-floor)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M7 18V9.5L10 6v12M14 18V6l3 3.5V18" fill="rgb(255 255 255 / 0.12)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          Garant
        </Link>
        <nav className="order-3 flex w-full gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className="whitespace-nowrap py-1 text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-garant aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-sm">
          {!auth.enabled ? (
            <span className="text-muted">Install a browser wallet to sign in</span>
          ) : auth.signedIn ? (
            <button onClick={auth.signOut} className="btn btn-glass px-4 py-1.5 normal-case tracking-normal">
              {auth.address ? short(auth.address) : "Signed in"} · Sign out
            </button>
          ) : (
            <button
              onClick={auth.signIn}
              disabled={!auth.ready}
              className="btn btn-glass px-5 py-1.5"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
