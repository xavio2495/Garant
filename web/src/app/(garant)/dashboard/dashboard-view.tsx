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

  if (isLoading)
    return (
      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass glass-quiet h-28 animate-pulse rounded-2xl" />
        ))}
        <p className="col-span-full text-sm text-muted">Loading figures…</p>
      </div>
    );
  if (!data)
    return (
      <div className="glass glass-quiet mt-12 flex items-start gap-3 rounded-2xl p-5 sm:p-6">
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-alert shadow-[0_0_12px_2px_rgb(255_122_107/0.6)]" />
        <p className="text-alert">The indexer isn&apos;t reachable. Check NEXT_PUBLIC_INDEXER_URL.</p>
      </div>
    );

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
      <dl className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label} className="glass glass-quiet flex min-w-0 flex-col rounded-2xl p-4 sm:p-5">
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="mt-auto break-words pt-3 font-pixel text-xl text-ink sm:text-3xl">{f.value}</dd>
            {"sub" in f ? <dd className="mt-1 text-sm text-muted">{f.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[44rem] text-xs leading-relaxed text-muted">
        The last three figures leave out Garant demo wallets ({Object.entries(DEMO_WALLETS)
          .map(([a, name]) => `${name} ${short(a)}`)
          .join(", ")}), which made {demoTrades} demo {demoTrades === 1 ? "purchase" : "purchases"} and collected{" "}
        {money(demoPaid)} in demo payouts.
        {meta
          ? ` Indexed to block ${meta.latest_processed_block.toLocaleString()} of ${meta.block_height.toLocaleString()}.`
          : null}
      </p>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">By series</h2>
        <p className="mt-2 text-sm text-muted">Every holder, including Garant demo wallets.</p>
        {series.length ? (
          <div className="glass mt-5 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr className="border-b border-rule">
                  <th className="px-5 py-3 font-medium">Series</th>
                  <th className="px-5 py-3 font-medium">State</th>
                  <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-5 py-3 text-right font-medium">Paid out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {series.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3.5">{r.label}</td>
                    <td className="px-5 py-3.5">
                      <StatePill state={r.state} />
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{money(outstanding(r))}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{money(b(r.protectPaid))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="glass glass-quiet mt-5 rounded-2xl p-5 text-muted">
            No series on chain yet. They appear here as soon as they&apos;re created.
          </p>
        )}
      </section>

      <SettlementSpeed series={series} reports={[...data.WeatherReport, ...data.FxReport]} />

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Latest money locked</h2>
        {data.Mint.length ? (
          <ul className="glass mt-5 divide-y divide-rule rounded-2xl text-sm">
            {data.Mint.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-3.5">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{money(b(m.amount))}</span> into series {m.series_id} by{" "}
                  <span className="font-mono text-xs">{short(m.account)}</span>
                  {isDemo(m.account) ? (
                    <span className="ml-2 inline-block rounded-full bg-floor-soft px-2 py-0.5 text-xs text-floor">Garant demo wallet</span>
                  ) : null}
                </span>
                <a
                  href={explorerTx(m.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-garant tabular-nums underline-offset-4 hover:underline"
                >
                  {new Date(m.timestamp * 1000).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass glass-quiet mt-5 rounded-2xl p-5 text-muted">Nothing locked yet.</p>
        )}
      </section>
    </>
  );
}

function StatePill({ state }: { state: SeriesRow["state"] }) {
  const tone =
    state === "OPEN" ? "bg-garant-soft text-garant" : state === "RESOLVED" ? "bg-floor-soft text-floor" : "bg-white/5 text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATE[state]}
    </span>
  );
}

function SettlementSpeed({ series, reports }: { series: SeriesRow[]; reports: Report[] }) {
  const byId = new Map(reports.map((r) => [r.id, r]));
  const rows = series
    .map((s) => ({ s, r: byId.get(s.id) }))
    .filter(({ s, r }) => r || s.state !== "OPEN");
  if (!rows.length) return null;

  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Settlement speed</h2>
      <p className="mt-2 max-w-[40rem] text-sm leading-relaxed text-muted">
        From a series&apos; expiry, to outside data landing on chain, to the moment payouts can be collected. Weather and exchange-rate
        results wait out a review window first, so anyone can flag a bad report. The last column is how quickly
        settlement follows once that window closes.
      </p>
      <div className="glass mt-5 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr className="border-b border-rule">
              <th className="px-4 py-3 pl-5 font-medium">Series</th>
              <th className="px-4 py-3 text-right font-medium">Expiry to data</th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-garant" />
                  Data on chain
                </span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-floor" />
                  Review window
                </span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-ink" />
                  Final
                </span>
              </th>
              <th className="px-4 py-3 text-right font-medium">Data to final</th>
              <th className="px-4 py-3 pr-5 text-right font-medium text-garant">After window</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map(({ s, r }) => {
              const dataAt = r ? r.receivedAt : Number(s.observedAt ?? 0);
              const windowEnd = r ? Number(r.finalizeAfter) : dataAt;
              const blocks = r && s.settleBlock ? s.settleBlock - r.receivedBlock : null;
              return (
                <tr key={s.id} className="align-top transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3.5 pl-5">{s.label}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {dataAt ? dur(Math.max(dataAt - Number(s.expiry), 0)) : "–"}
                  </td>
                  <td className="border-l-2 border-garant/50 px-4 py-3.5 tabular-nums">
                    {dataAt ? clock(dataAt) : "–"}
                    <span className="block text-xs text-muted">
                      {r ? `block ${r.receivedBlock.toLocaleString()}` : "price published"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {r ? (
                      <span className="inline-block rounded-full bg-floor-soft px-2.5 py-0.5 text-xs font-medium text-floor tabular-nums">
                        {dur(windowEnd - r.receivedAt)}
                      </span>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">
                    {s.resolvedAt ? (
                      <>
                        {clock(s.resolvedAt)}
                        {s.settleBlock ? <span className="block text-xs text-muted">block {s.settleBlock.toLocaleString()}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted">After {clock(windowEnd)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {s.resolvedAt && dataAt ? dur(s.resolvedAt - dataAt) : "–"}
                    {blocks !== null ? <span className="block text-xs text-muted">{blocks.toLocaleString()} blocks</span> : null}
                  </td>
                  <td className="bg-garant-soft/60 px-4 py-3.5 pr-5 text-right font-pixel text-sm text-garant">
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
