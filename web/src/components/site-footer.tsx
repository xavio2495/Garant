import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const LINKS = [
  ["Rain cover", "/app/cover"],
  ["Underwrite", "/app/underwrite"],
  ["Dashboard", "/app/dashboard"],
  ["Protect a transfer", "/partner"],
  ["Partner API", "/api"],
  ["Deck", "/deck"],
] as const;

// The last section: a glass slab laid back into the distance like a floor, its words receding with it, holding the
// wordmark, the ways in and the testnet notice
export function SiteFooter() {
  return (
    <footer id="footer" className="relative z-10 mx-auto -mt-6 max-w-5xl px-4 pb-2 [perspective-origin:50%_0%] [perspective:640px] sm:px-6">
      <div className="glass origin-bottom px-6 pb-6 pt-10 text-center [transform:rotateX(34deg)] sm:px-12">
        <Link href="/" aria-label="Garant, home" className="inline-block">
          <BrandMark className="size-11" />
        </Link>
        <nav aria-label="Footer" className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-3 text-lg">
          {LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="text-muted transition-colors hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <p aria-hidden className="sheen-text mt-6 select-none whitespace-nowrap font-title text-[clamp(3rem,12vw,10rem)] leading-[0.9]">
          Garant
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 font-mono text-sm text-muted">
          <span>Running on Monad testnet. Not live with real money until audited.</span>
          <span className="uppercase tracking-[0.14em]">Garant · 2026</span>
        </div>
      </div>
    </footer>
  );
}
