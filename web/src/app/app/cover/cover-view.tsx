"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Holdings } from "@/components/holdings";
import { Panel, Pop } from "@/components/app/panel";
import { Stage } from "@/components/app/stage";
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
  // Newest first; the first few show, the rest behind a toggle so the two columns stay in balance
  const past = rain.filter((s) => !open.includes(s)).sort((a, b) => b.expiry - a.expiry);
  const [allPast, setAllPast] = useState(false);
  const shownPast = allPast ? past : past.slice(0, 4);

  if (isLoading)
    return (
      <Panel quiet className="mt-10 flex items-center gap-3 p-6 text-muted">
        <span aria-hidden className="relative size-2 animate-pulse bg-garant shadow-[0_0_12px_var(--color-garant)]" />
        <p className="relative">Loading available cover…</p>
      </Panel>
    );

  // Buying on the left, facing the reader; the record of past dates turns in from the right like a curved screen
  return (
    <>
      <Stage className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* The buying card stays in view while the record of past dates scrolls past it */}
        <section className="lg:sticky lg:top-28">
          <h2 className="font-display text-2xl sm:text-3xl">Available now</h2>
          {open.length ? (
            <div className="mt-6 grid gap-5">
              {open.map((s) => (
                <BuyCover key={s.id.toString()} series={s} />
              ))}
            </div>
          ) : (
            <Panel quiet className="mt-6 p-6">
              <p className="relative text-muted">No dates are open for cover right now. The results alongside show how earlier dates settled.</p>
            </Panel>
          )}
        </section>

        <Pop z={0} turn={-9} className="lg:origin-left">
          <section>
            <h2 className="font-display text-2xl sm:text-3xl">How past dates settled</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Replays of real days in Manila. Weather services publish their daily totals about three days later, so cover
              settles on day three. Source A is Open-Meteo, source B is NASA POWER.
            </p>
            <ul className="mt-6 grid gap-4">
              {shownPast.map((s) => {
                const r = reports?.get(s.id.toString());
                return (
                  <li key={s.id.toString()}>
                    <Panel quiet className="flex flex-col gap-4 p-5">
                      <p className="relative font-display text-lg">{s.label}</p>
                      <Pop z={45}>
                        <dl className="grid grid-cols-2 gap-3">
                          {(["A", "B"] as const).map((k) => (
                            <div key={k} className="glass glass-quiet px-3 py-2">
                              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Source {k}</dt>
                              <dd className="mt-1 font-pixel text-xl">
                                {r ? mm(k === "A" ? r.observedA : r.observedB) : "–"}
                                {r ? <span className="ml-1 font-sans text-xs text-muted">mm</span> : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </Pop>
                      <div className="relative text-sm">
                        <span className="sr-only">Result: </span>
                        <Result series={s} report={r} />
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ul>
            {past.length > 4 ? (
              <button onClick={() => setAllPast(!allPast)} className="btn btn-glass mt-5">
                {allPast ? "Show fewer" : `Show all ${past.length}`}
              </button>
            ) : null}
          </section>
        </Pop>
      </Stage>

      <Holdings title="Your cover" filter={(s) => s.kind === "BINARY"} />
    </>
  );
}

const OUTCOME = ["Dry enough. No payout.", "It rained. Pays in full.", "Sources disagreed. Settles at half the payout."];

const PILL = "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]";
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
    <Panel className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
      <div className="relative">
        <p className="font-display text-xl sm:text-2xl">{series.label}</p>
        <label className="mt-5 block text-sm text-muted">
          Payout if it rains at least {mm(series.strike)} mm
          <div className="field mt-2 flex max-w-xs items-baseline gap-1 px-3 py-2 text-ink">
            <span className="text-2xl text-muted">$</span>
            <input
              type="number"
              min={1}
              value={payout || ""}
              onChange={(e) => setPayout(Number(e.target.value))}
              className="w-full min-w-0 bg-transparent font-display text-3xl outline-none"
            />
          </div>
        </label>
      </div>
      {/* The price lifts off the card as its own pane */}
      <Pop z={70}>
        <div className="glass p-5 md:text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Cost today</p>
          <p className="mt-1 font-pixel text-3xl">{q ? usd(toNum6(q.costAusd)) : noOffers ? "–" : "…"}</p>
          {noOffers ? <p className="mt-1 max-w-[14rem] text-sm text-muted md:ml-auto">Not enough cover on offer for this amount. Try a smaller payout.</p> : null}
          {auth.signedIn ? (
            <button onClick={buy} disabled={!q || busy} className="btn btn-glass mt-4 w-full sm:w-auto">
              {busy ? "Buying…" : "Buy cover"}
            </button>
          ) : (
            <button onClick={auth.signIn} disabled={!auth.enabled} className="btn btn-glass mt-4 w-full sm:w-auto">
              Sign in to buy cover
            </button>
          )}
        </div>
      </Pop>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={`relative text-sm md:col-span-2 ${msg.ok ? "text-garant" : "text-alert"}`}>
          {msg.text}
        </p>
      ) : null}
    </Panel>
  );
}
