"use client";

import { useQuery } from "@tanstack/react-query";
import { gql } from "@/lib/indexer";
import { explorerTx } from "@/lib/chain";
import { toNum6, usd } from "@/lib/format";

type Stats = {
  minted: string;
  setRedeemed: string;
  redeemedAusd: string;
  protectPaid: string;
  accounts: number;
  trades: number;
  tradeVolume: string;
};

type SeriesRow = {
  id: string;
  kind: "BINARY" | "FX_FLOOR";
  state: "OPEN" | "RESOLVED" | "VOIDED";
  label: string;
  minted: string;
  setRedeemed: string;
  protectRedeemed: string;
  protectPaid: string;
  observedAt: string | null;
  resolvedAt: number | null;
  settleBlock: number | null;
};

type Activity = { id: string; series_id: string; account: string; amount: string; timestamp: number; txHash: string };

type Data = {
  Stats: Stats[];
  Series: SeriesRow[];
  Mint: Activity[];
  chain_metadata: { block_height: number; latest_processed_block: number }[];
};

const QUERY = `{
  Stats(where: { id: { _eq: "global" } }) { minted setRedeemed redeemedAusd protectPaid accounts trades tradeVolume }
  Series { id kind state label minted setRedeemed protectRedeemed protectPaid observedAt resolvedAt settleBlock }
  Mint(order_by: { block: desc }, limit: 8) { id series_id account amount timestamp txHash }
  chain_metadata { block_height latest_processed_block }
}`;

const b = (v: string | undefined) => BigInt(v ?? "0");
const money = (v: bigint) => usd(toNum6(v));
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const STATE = { OPEN: "Open", RESOLVED: "Settled", VOIDED: "Voided" };

export function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gql<Data>(QUERY),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="mt-12 text-muted">Loading figures…</p>;
  if (!data) return <p className="mt-12 text-alert">The indexer isn&apos;t reachable. Check NEXT_PUBLIC_INDEXER_URL.</p>;

  const s = data.Stats[0];
  const collateral = b(s?.minted) - b(s?.setRedeemed) - b(s?.redeemedAusd);
  const series = [...data.Series].sort((x, y) => Number(x.id) - Number(y.id));
  const outstanding = (r: SeriesRow) => b(r.minted) - b(r.setRedeemed) - b(r.protectRedeemed);
  const maxPayout = series.filter((r) => r.state === "OPEN").reduce((acc, r) => acc + outstanding(r), 0n);
  const meta = data.chain_metadata[0];

  const figures = [
    { label: "Money locked", value: money(collateral) },
    { label: "Protection outstanding", value: money(maxPayout) },
    {
      label: "Locked vs. most that could be paid",
      value: maxPayout > 0n ? `${((Number(collateral) / Number(maxPayout)) * 100).toFixed(0)}%` : "–",
    },
    { label: "Paid to protected people", value: money(b(s?.protectPaid)) },
    { label: "Accounts", value: (s?.accounts ?? 0).toString() },
    { label: "Trades", value: `${s?.trades ?? 0} (${money(b(s?.tradeVolume))})` },
  ];

  return (
    <>
      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-8 md:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-tight">{f.value}</dd>
          </div>
        ))}
      </dl>
      {meta ? (
        <p className="mt-3 text-xs text-muted">
          Indexed to block {meta.latest_processed_block.toLocaleString()} of {meta.block_height.toLocaleString()}.
        </p>
      ) : null}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-medium">By series</h2>
        {series.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-4 font-normal">Series</th>
                  <th className="py-2 pr-4 font-normal">State</th>
                  <th className="py-2 pr-4 text-right font-normal">Outstanding</th>
                  <th className="py-2 pr-4 text-right font-normal">Paid out</th>
                  <th className="py-2 text-right font-normal">Data to settlement</th>
                </tr>
              </thead>
              <tbody>
                {series.map((r) => (
                  <tr key={r.id} className="border-b border-rule">
                    <td className="py-3 pr-4">{r.label}</td>
                    <td className="py-3 pr-4">{STATE[r.state]}</td>
                    <td className="py-3 pr-4 text-right">{money(outstanding(r))}</td>
                    <td className="py-3 pr-4 text-right">{money(b(r.protectPaid))}</td>
                    <td className="py-3 text-right">
                      {r.resolvedAt && r.observedAt ? `${r.resolvedAt - Number(r.observedAt)} s` : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-muted">No series on chain yet. They appear here as soon as they&apos;re created.</p>
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-medium">Latest money locked</h2>
        {data.Mint.length ? (
          <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
            {data.Mint.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {money(b(m.amount))} into series {m.series_id} by {short(m.account)}
                </span>
                <a href={explorerTx(m.txHash)} target="_blank" rel="noreferrer" className="text-garant underline underline-offset-4">
                  {new Date(m.timestamp * 1000).toLocaleString("en-GB")}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">Nothing locked yet.</p>
        )}
      </section>
    </>
  );
}
