"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { gql } from "@/lib/indexer";
import { toNum6, usd } from "@/lib/format";

type Data = {
  Stats: { minted: string; setRedeemed: string; redeemedAusd: string }[];
  Series: { state: string; resolvedAt: number | null }[];
};

const QUERY = `{
  Stats(where: { id: { _eq: "global" } }) { minted setRedeemed redeemedAusd }
  Series { state resolvedAt }
}`;

export function LiveProof() {
  const { data } = useQuery({ queryKey: ["live-proof"], queryFn: () => gql<Data>(QUERY), staleTime: 60_000 });
  if (!data) return null;

  const s = data.Stats[0];
  const locked = s ? BigInt(s.minted) - BigInt(s.setRedeemed) - BigInt(s.redeemedAusd) : 0n;
  const settled = data.Series.filter((x) => x.state !== "OPEN");
  const last = Math.max(0, ...settled.map((x) => x.resolvedAt ?? 0));

  const facts = [
    { label: "Series settled on their own", value: settled.length.toString() },
    { label: "Locked to back guarantees", value: usd(toNum6(locked)) },
    {
      label: "Last settlement",
      value: last
        ? `${new Date(last * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
        : "–",
    },
  ];

  return (
    <Link href="/dashboard" className="group mt-6 block">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="border-l border-rule pl-3">
            <dd className="font-pixel text-xl text-ink">{f.value}</dd>
            <dt className="text-sm text-muted">{f.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-garant underline-offset-4 group-hover:underline">Live from Monad testnet. See the dashboard</p>
    </Link>
  );
}
