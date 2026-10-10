"use client";

import { useQuery } from "@tanstack/react-query";
import { gql } from "@/lib/indexer";
import { explorerTx } from "@/lib/chain";
import { toNum6, usd } from "@/lib/format";
import { DEMO_WALLETS, isDemo } from "@/lib/demo-wallets";

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
  payout: string;
  expiry: string;
  observedAt: string | null;
  resolvedAt: number | null;
  settleBlock: number | null;
};

type Report = { id: string; receivedAt: number; receivedBlock: number; finalizeAfter: string };

type Activity = { id: string; series_id: string; account: string; amount: string; timestamp: number; txHash: string };

type Data = {
  Stats: Stats[];
  Account: { id: string }[];
  Trade: { taker: string; price: string; filledSize: string }[];
  Redemption: { account: string; series_id: string; protectIn: string }[];
  WeatherReport: Report[];
  FxReport: Report[];
  Series: SeriesRow[];
  Mint: Activity[];
  chain_metadata: { block_height: number; latest_processed_block: number }[];
};

const QUERY = `{
  Stats(where: { id: { _eq: "global" } }) { minted setRedeemed redeemedAusd protectPaid accounts trades tradeVolume }
  Series { id kind state label minted setRedeemed protectRedeemed protectPaid payout expiry observedAt resolvedAt settleBlock }
  Account(limit: 1000) { id }
  Trade(limit: 1000) { taker price filledSize }
  Redemption(limit: 1000) { account series_id protectIn }
  WeatherReport { id receivedAt receivedBlock finalizeAfter }
  FxReport { id receivedAt receivedBlock finalizeAfter }
  Mint(order_by: { block: desc }, limit: 8) { id series_id account amount timestamp txHash }
  chain_metadata { block_height latest_processed_block }
}`;

const b = (v: string | undefined) => BigInt(v ?? "0");
const money = (v: bigint) => usd(toNum6(v));
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const STATE = { OPEN: "Open", RESOLVED: "Settled", VOIDED: "Voided" };
const dur = (sec: number) => (sec < 120 ? `${sec} s` : `${Math.floor(sec / 60)} min ${sec % 60} s`);
const clock = (unix: number) =>
  `${new Date(unix * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" })} UTC`;

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

  // Traction excludes the team's own demo wallets
  const payoutOf = new Map(series.map((r) => [r.id, b(r.payout)]));
  const realTrades = data.Trade.filter((t) => !isDemo(t.taker));
  const bought = realTrades.reduce((acc, t) => acc + b(t.filledSize), 0n);
  const volume = realTrades.reduce((acc, t) => acc + (b(t.filledSize) * b(t.price)) / 10n ** 18n, 0n);
  const paidTo = (keep: (account: string) => boolean) =>
    data.Redemption.filter((r) => keep(r.account)).reduce(
      (acc, r) => acc + (b(r.protectIn) * (payoutOf.get(r.series_id) ?? 0n)) / 10n ** 18n,
      0n,
    );
  const paid = paidTo((a) => !isDemo(a));
  const demoPaid = paidTo(isDemo);
  const accounts = new Set([...data.Account.map((a) => a.id), ...data.Trade.map((t) => t.taker)].map((a) => a.toLowerCase()));
  const realAccounts = [...accounts].filter((a) => !isDemo(a)).length;
  const demoTrades = data.Trade.length - realTrades.length;

  const figures = [
    { label: "Money locked", value: money(collateral) },
    { label: "Protection outstanding", value: money(maxPayout) },
    {
      label: "Locked vs. most that could be paid",
      value: maxPayout > 0n ? `${((Number(collateral) / Number(maxPayout)) * 100).toFixed(0)}%` : "–",
    },
    { label: "Protection bought", value: money(bought), sub: `for ${money(volume)} in fees` },
    { label: "Paid to protected people", value: money(paid) },
    { label: "People and partners", value: realAccounts.toString() },
  ];

  return (
    <>
      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-8 md:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tracking-tight">{f.value}</dd>
            {"sub" in f ? <dd className="text-sm text-muted">{f.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-[44rem] text-xs leading-relaxed text-muted">
        The last three figures leave out Garant demo wallets ({Object.entries(DEMO_WALLETS)
          .map(([a, name]) => `${name} ${short(a)}`)
          .join(", ")}), which made {demoTrades} demo {demoTrades === 1 ? "purchase" : "purchases"} and collected{" "}
        {money(demoPaid)} in demo payouts.
        {meta
          ? ` Indexed to block ${meta.latest_processed_block.toLocaleString()} of ${meta.block_height.toLocaleString()}.`
          : null}
      </p>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-medium">By series</h2>
        <p className="mt-2 text-sm text-muted">Every holder, including Garant demo wallets.</p>
        {series.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-4 font-normal">Series</th>
                  <th className="py-2 pr-4 font-normal">State</th>
                  <th className="py-2 pr-4 text-right font-normal">Outstanding</th>
                  <th className="py-2 text-right font-normal">Paid out</th>
                </tr>
              </thead>
              <tbody>
                {series.map((r) => (
                  <tr key={r.id} className="border-b border-rule">
                    <td className="py-3 pr-4">{r.label}</td>
                    <td className="py-3 pr-4">{STATE[r.state]}</td>
                    <td className="py-3 pr-4 text-right">{money(outstanding(r))}</td>
                    <td className="py-3 text-right">{money(b(r.protectPaid))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-muted">No series on chain yet. They appear here as soon as they&apos;re created.</p>
        )}
      </section>

      <SettlementSpeed series={series} reports={[...data.WeatherReport, ...data.FxReport]} />

      <section className="mt-14">
        <h2 className="font-display text-2xl font-medium">Latest money locked</h2>
        {data.Mint.length ? (
          <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
            {data.Mint.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {money(b(m.amount))} into series {m.series_id} by {short(m.account)}
                  {isDemo(m.account) ? <span className="ml-2 rounded bg-floor-soft px-1.5 py-0.5 text-xs">Garant demo wallet</span> : null}
                </span>
                <a href={explorerTx(m.txHash)} target="_blank" rel="noreferrer" className="text-garant underline underline-offset-4">
                  {new Date(m.timestamp * 1000).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
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

function SettlementSpeed({ series, reports }: { series: SeriesRow[]; reports: Report[] }) {
  const byId = new Map(reports.map((r) => [r.id, r]));
  const rows = series
    .map((s) => ({ s, r: byId.get(s.id) }))
    .filter(({ s, r }) => r || s.state !== "OPEN");
  if (!rows.length) return null;

  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-medium">Settlement speed</h2>
      <p className="mt-2 max-w-[40rem] text-sm leading-relaxed text-muted">
        From a series&apos; expiry, to outside data landing on chain, to the moment payouts can be collected. Weather and exchange-rate
        results wait out a review window first, so anyone can flag a bad report. The last column is how quickly
        settlement follows once that window closes.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 font-normal">Series</th>
              <th className="py-2 pr-4 text-right font-normal">Expiry to data</th>
              <th className="py-2 pr-4 font-normal">Data on chain</th>
              <th className="py-2 pr-4 font-normal">Review window</th>
              <th className="py-2 pr-4 font-normal">Final</th>
              <th className="py-2 pr-4 text-right font-normal">Data to final</th>
              <th className="py-2 text-right font-normal">After window</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, r }) => {
              const dataAt = r ? r.receivedAt : Number(s.observedAt ?? 0);
              const windowEnd = r ? Number(r.finalizeAfter) : dataAt;
              const blocks = r && s.settleBlock ? s.settleBlock - r.receivedBlock : null;
              return (
                <tr key={s.id} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">{s.label}</td>
                  <td className="py-3 pr-4 text-right">{dataAt ? dur(Math.max(dataAt - Number(s.expiry), 0)) : "–"}</td>
                  <td className="py-3 pr-4">
                    {dataAt ? clock(dataAt) : "–"}
                    <span className="block text-xs text-muted">
                      {r ? `block ${r.receivedBlock.toLocaleString()}` : "price published"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{r ? dur(windowEnd - r.receivedAt) : "None"}</td>
                  <td className="py-3 pr-4">
                    {s.resolvedAt ? (
                      <>
                        {clock(s.resolvedAt)}
                        {s.settleBlock ? <span className="block text-xs text-muted">block {s.settleBlock.toLocaleString()}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted">After {clock(windowEnd)}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {s.resolvedAt && dataAt ? dur(s.resolvedAt - dataAt) : "–"}
                    {blocks !== null ? <span className="block text-xs text-muted">{blocks.toLocaleString()} blocks</span> : null}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {s.resolvedAt ? dur(Math.max(s.resolvedAt - windowEnd, 0)) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
