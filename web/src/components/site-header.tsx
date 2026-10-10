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
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Garant
        </Link>
        <nav className="order-3 flex w-full gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className="whitespace-nowrap py-1 text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-floor aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-sm">
          {!auth.enabled ? (
            <span className="text-muted">Install a browser wallet to sign in</span>
          ) : auth.signedIn ? (
            <button onClick={auth.signOut} className="rounded-full border border-rule px-3 py-1.5 hover:border-ink">
              {auth.address ? short(auth.address) : "Signed in"} · Sign out
            </button>
          ) : (
            <button
              onClick={auth.signIn}
              disabled={!auth.ready}
              className="rounded-full bg-ink px-4 py-1.5 text-paper disabled:opacity-50"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
