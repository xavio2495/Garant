import Link from "next/link";
import { FloorLine } from "@/components/floor-line";
import { GlassIcon, type GlassIconKind } from "@/components/glass-icon";
import { LiveProof } from "@/components/live-proof";
import { PrismFloor } from "@/components/prism-floor";
import { TesterStart } from "@/components/tester-start";

const USES: { href: string; title: string; body: string; icon: GlassIconKind }[] = [
  {
    href: "/partner",
    title: "Protected transfers",
    icon: "transfer",
    body: "A money-transfer app adds one line to its checkout. The family at home is guaranteed at least ₱62.50 per dollar for 30 days. If the rate falls, the difference is paid automatically.",
  },
  {
    href: "/cover",
    title: "Rain cover for events",
    icon: "rain",
    body: "An organiser picks a date, a place and a rainfall level. If two independent weather sources agree it rained, the cover pays out. No claim form.",
  },
  {
    href: "/underwrite",
    title: "Underwriting",
    icon: "vault",
    body: "People holding dollars back the guarantees and earn the premium. Every payout is funded in full before anyone buys, so nothing depends on a promise.",
  },
];

const STACK = ["Settles on Monad", "Priced on Kuru", "Resolved by Chainlink CRE", "Indexed by Envio", "Wallets by Privy"];

export default function Home() {
  return (
    <>
      <section className="relative text-center">
        <p className="eyebrow">Guaranteed minimum outcomes</p>
        <h1 className="mx-auto mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
          A floor under the things you <span className="prism-text">can&apos;t control.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[38rem] text-lg leading-relaxed text-muted">
          Garant sells guaranteed minimum outcomes on exchange rates and weather. Each guarantee is fully funded up front
          and settles on its own from public data.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/partner" className="btn btn-primary">
            Protect a transfer
          </Link>
          <Link href="/underwrite" className="btn btn-glass">
            Underwrite
          </Link>
        </div>
        <PrismFloor className="mx-auto -mb-2 mt-6 w-full max-w-3xl" />
      </section>

      <section className="glass rounded-2xl px-6 py-8 sm:px-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">Live on Monad testnet</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Every payout is locked before anyone buys.</h2>
            <LiveProof />
          </div>
          <FloorLine className="w-full" />
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-5 text-sm text-muted">
          {STACK.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-garant" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <TesterStart />

      <section className="mt-16">
        <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          One engine, <span className="text-muted">any risk with two data sources.</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {USES.map((u, i) => (
            <Link
              key={u.href}
              href={u.href}
              className="glass glass-quiet group flex min-h-72 flex-col rounded-2xl p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <GlassIcon kind={u.icon} className="size-24" />
                <span className="font-pixel text-2xl text-muted">0{i + 1}</span>
              </div>
              <h3 className="mt-auto font-display text-2xl font-semibold group-hover:text-garant">{u.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{u.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
