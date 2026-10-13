import Link from "next/link";
import { NotFoundRain } from "@/components/not-found-rain";
import { SiteNav } from "@/components/site-nav";

export const metadata = { title: "Not found · Garant" };

// A missing page is the one outcome without a floor: the rain falls into the 404 and fills it
export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="relative -mt-[5.25rem] h-svh overflow-hidden">
        <NotFoundRain />
        <h1 className="sr-only">Page not found</h1>
        <p
          aria-hidden
          className="pointer-events-none absolute right-[14%] top-1/2 origin-center -translate-y-1/2 -rotate-[62deg] whitespace-nowrap font-display text-[clamp(1.4rem,4.4vw,4.4rem)] leading-none text-ink"
        >
          No floor here
        </p>
        <nav aria-label="Elsewhere" className="absolute bottom-8 left-6 flex gap-6 font-mono text-xs uppercase tracking-[0.14em] sm:left-10">
          <Link href="/deck" className="text-muted transition-colors hover:text-ink">Deck ↗</Link>
          <Link href="/api" className="text-muted transition-colors hover:text-ink">Partner API ↗</Link>
        </nav>
        <div className="absolute bottom-8 right-6 flex flex-col items-end gap-3 sm:right-10">
          <Link href="/" className="btn btn-glass">Back to Garant</Link>
          <Link href="/app/cover" className="btn btn-glass">Open the app</Link>
        </div>
      </main>
    </>
  );
}
