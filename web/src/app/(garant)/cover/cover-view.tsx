"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Holdings } from "@/components/holdings";
import { protect, quote, type Quote, type SeriesView } from "@/lib/garant";
import { publicClient } from "@/lib/chain";
import { gql } from "@/lib/indexer";
import { toNum6, usd } from "@/lib/format";
import { useSeries } from "@/lib/use-series";

const mm = (v: bigint | string) => (Number(v) / 100).toLocaleString("en-US", { maximumFractionDigits: 1 });

type Report = { id: string; outcome: number; observedA: string; observedB: string; finalizeAfter: string };

function useReports() {
  return useQuery({
    queryKey: ["weather-reports"],
    queryFn: async () => {
      const d = await gql<{ WeatherReport: Report[] }>("{ WeatherReport { id outcome observedA observedB finalizeAfter } }");
      return new Map((d?.WeatherReport ?? []).map((r) => [r.id, r]));
    },
    staleTime: 60_000,
  });
}

export function CoverView() {
  const { data: series, isLoading } = useSeries();
  const { data: reports } = useReports();
  const rain = (series ?? []).filter((s) => s.kind === "BINARY");
  const [now] = useState(() => Date.now() / 1000);
  const open = rain.filter((s) => s.state === "OPEN" && s.expiry > now);
  const past = rain.filter((s) => !open.includes(s));

  if (isLoading)
    return (
      <div className="glass glass-quiet mt-12 flex items-center gap-3 rounded-2xl p-6 text-muted">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-garant shadow-[0_0_12px_var(--color-garant)]" />
        <p>Loading available cover…</p>
      </div>
    );

  return (
    <>
      <section className="mt-12">
        <p className="eyebrow">Open dates</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Available now</h2>
        {open.length ? (
          <div className="mt-6 grid gap-4">
            {open.map((s) => (
              <BuyCover key={s.id.toString()} series={s} />
            ))}
          </div>
        ) : (
          <p className="glass glass-quiet mt-6 max-w-[36rem] rounded-2xl p-6 text-muted">
            No dates are open for cover right now. The results below show how earlier
            dates settled.
          </p>
        )}
      </section>

      <section className="mt-16">
        <p className="eyebrow">Replays</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">How past dates settled</h2>
        <p className="mt-3 max-w-[38rem] text-sm leading-relaxed text-muted">
          Replays of real days in Manila. Weather services publish their daily totals about three days later, so cover
          settles on day three. Source A is Open-Meteo, source B is NASA POWER.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {past.map((s) => {
            const r = reports?.get(s.id.toString());
            return (
              <li key={s.id.toString()} className="glass glass-quiet flex flex-col gap-4 rounded-2xl p-5">
                <p className="font-display text-lg font-semibold tracking-tight">{s.label}</p>
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-rule bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.16em] text-muted">Source A</dt>
                    <dd className="mt-1 font-pixel text-xl">
                      {r ? mm(r.observedA) : "–"}
                      {r ? <span className="ml-1 font-sans text-xs text-muted">mm</span> : null}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-rule bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.16em] text-muted">Source B</dt>
                    <dd className="mt-1 font-pixel text-xl">
                      {r ? mm(r.observedB) : "–"}
                      {r ? <span className="ml-1 font-sans text-xs text-muted">mm</span> : null}
                    </dd>
                  </div>
                </dl>
                <div className="text-sm">
                  <span className="sr-only">Result: </span>
                  <Result series={s} report={r} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Holdings title="Your cover" filter={(s) => s.kind === "BINARY"} />
    </>
  );
}

const OUTCOME = ["Dry enough. No payout.", "It rained. Pays in full.", "Sources disagreed. Settles at half the payout."];

const PILL = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]";
const BADGE = [
  <span key="no" className={`${PILL} bg-white/5 text-muted`}>No</span>,
  <span key="yes" className={`${PILL} bg-garant-soft text-garant`}>Yes</span>,
  <span key="void" className={`${PILL} bg-floor-soft text-floor`}>Void</span>,
];

function Result({ series, report }: { series: SeriesView; report?: Report }) {
  if (series.state === "OPEN") {
    if (!report) return <span className="text-muted">Waiting for both weather services to publish.</span>;
    const final = `${new Date(Number(report.finalizeAfter) * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {BADGE[report.outcome]}
        <span>
          {OUTCOME[report.outcome]} <span className="text-muted">Final after a review window ending {final}.</span>
        </span>
      </span>
    );
  }
  if (series.state === "VOIDED")
    return (
      <span className="flex flex-wrap items-center gap-2">
        {BADGE[2]}
        <span className="text-muted">Sources disagreed. Settled at half the payout.</span>
      </span>
    );
  return series.payout > 0n ? (
    <span className="flex flex-wrap items-center gap-2">
      {BADGE[1]}
      <span className="font-medium text-garant">It rained. Paid in full.</span>
    </span>
  ) : (
    <span className="flex flex-wrap items-center gap-2">
      {BADGE[0]}
      <span>Dry enough. No payout.</span>
    </span>
  );
}

function BuyCover({ series }: { series: SeriesView }) {
  const auth = useAuth();
  const { data: wallet } = useWalletClient();
  const [payout, setPayout] = useState(1000);
  const [q, setQ] = useState<Quote | null>(null);
  const [noOffers, setNoOffers] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!(payout > 0)) return;
    quote(publicClient, { seriesId: series.id, protectAmount: BigInt(Math.round(payout * 1e6)) }).then(
      (r) => {
        setQ(r);
        setNoOffers(false);
      },
      () => {
        setQ(null);
        setNoOffers(true);
      },
    );
  }, [payout, series.id]);

  async function buy() {
    if (!q || !wallet || !auth.address) return;
    setBusy(true);
    setMsg(null);
    try {
      await protect(wallet, { quote: q, beneficiary: auth.address, maxCostAusd: (q.costAusd * 101n) / 100n });
      setMsg({ ok: true, text: `Cover bought. You'll receive ${usd(payout)} if it rains at least ${mm(series.strike)} mm.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass grid gap-6 rounded-2xl p-6 transition-colors focus-within:bg-garant-soft focus-within:ring-1 focus-within:ring-garant sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{series.label}</p>
        <label className="mt-5 block text-sm text-muted">
          Payout if it rains at least {mm(series.strike)} mm
          <div className="mt-2 flex max-w-xs items-baseline gap-1 rounded-lg border border-rule bg-white/5 px-3 py-2 text-ink transition-colors focus-within:border-garant">
            <span className="text-2xl text-muted">$</span>
            <input
              type="number"
              min={1}
              value={payout || ""}
              onChange={(e) => setPayout(Number(e.target.value))}
              className="w-full min-w-0 bg-transparent font-display text-3xl font-semibold outline-none"
            />
          </div>
        </label>
      </div>
      <div className="md:text-right">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Cost today</p>
        <p className="mt-1 font-pixel text-3xl">{q ? usd(toNum6(q.costAusd)) : noOffers ? "–" : "…"}</p>
        {noOffers ? <p className="mt-1 max-w-[14rem] text-sm text-muted md:ml-auto">Not enough cover on offer for this amount. Try a smaller payout.</p> : null}
        {auth.signedIn ? (
          <button onClick={buy} disabled={!q || busy} className="btn btn-primary mt-4 w-full sm:w-auto">
            {busy ? "Buying…" : "Buy cover"}
          </button>
        ) : (
          <button onClick={auth.signIn} disabled={!auth.enabled} className="btn btn-glass mt-4 w-full sm:w-auto">
            Sign in to buy cover
          </button>
        )}
      </div>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm md:col-span-2 ${msg.ok ? "text-garant" : "text-alert"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
