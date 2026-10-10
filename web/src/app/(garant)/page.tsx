import Link from "next/link";
import { FloorLine } from "@/components/floor-line";
import { LiveProof } from "@/components/live-proof";

const USES = [
  {
    href: "/partner",
    title: "Protected transfers",
    body: "A money-transfer app adds one line to its checkout. The family at home is guaranteed at least ₱62.50 per dollar for 30 days. If the rate falls, the difference is paid automatically.",
  },
  {
    href: "/cover",
    title: "Rain cover for events",
    body: "An organiser picks a date, a place and a rainfall level. If two independent weather sources agree it rained, the cover pays out. No claim form.",
  },
  {
    href: "/underwrite",
    title: "Underwriting",
    body: "People holding dollars back the guarantees and earn the premium. Every payout is funded in full before anyone buys, so nothing depends on a promise.",
  },
];

export default function Home() {
  return (
    <>
      <section className="grid items-end gap-10 border-b border-rule pb-14 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            A floor under the things you can&apos;t control.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
            Garant sells guaranteed minimum outcomes on exchange rates and weather. Each guarantee is fully funded
            up front and settles on its own from public data.
          </p>
          <LiveProof />
        </div>
        <FloorLine className="w-full" />
      </section>

      <section className="divide-y divide-rule">
        {USES.map((u) => (
          <Link key={u.href} href={u.href} className="group grid gap-2 py-8 md:grid-cols-[16rem_1fr]">
            <h2 className="font-display text-2xl font-medium group-hover:text-garant">{u.title}</h2>
            <p className="max-w-[38rem] leading-relaxed text-muted">{u.body}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
