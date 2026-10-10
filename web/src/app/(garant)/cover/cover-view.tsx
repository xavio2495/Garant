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

  if (isLoading) return <p className="mt-12 text-muted">Loading available cover…</p>;

  return (
    <>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">Available now</h2>
        {open.length ? (
          <div className="mt-4 divide-y divide-rule border-y border-rule">
            {open.map((s) => (
              <BuyCover key={s.id.toString()} series={s} />
            ))}
          </div>
        ) : (
          <p className="mt-3 max-w-[36rem] text-muted">
            No dates are open for cover right now. The results below show how earlier
            dates settled.
          </p>
        )}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-medium">How past dates settled</h2>
        <p className="mt-2 max-w-[38rem] text-sm leading-relaxed text-muted">
          Replays of real days in Manila. Weather services publish their daily totals about three days later, so cover
          settles on day three. Source A is Open-Meteo, source B is NASA POWER.
        </p>
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 font-normal">Cover</th>
              <th className="py-2 pr-4 font-normal">Source A</th>
              <th className="py-2 pr-4 font-normal">Source B</th>
              <th className="py-2 font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {past.map((s) => {
              const r = reports?.get(s.id.toString());
              return (
                <tr key={s.id.toString()} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">{s.label}</td>
                  <td className="py-3 pr-4">{r ? `${mm(r.observedA)} mm` : "–"}</td>
                  <td className="py-3 pr-4">{r ? `${mm(r.observedB)} mm` : "–"}</td>
                  <td className="py-3">
                    <Result series={s} report={r} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Holdings title="Your cover" filter={(s) => s.kind === "BINARY"} />
    </>
  );
}

const OUTCOME = ["Dry enough. No payout.", "It rained. Pays in full.", "Sources disagreed. Settles at half the payout."];

function Result({ series, report }: { series: SeriesView; report?: Report }) {
  if (series.state === "OPEN") {
    if (!report) return <span className="text-muted">Waiting for both weather services to publish.</span>;
    const final = new Date(Number(report.finalizeAfter) * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return (
      <span>
        {OUTCOME[report.outcome]} <span className="text-muted">Final after a review window ending {final}.</span>
      </span>
    );
  }
  if (series.state === "VOIDED")
    return <span className="text-muted">Sources disagreed. Settled at half the payout.</span>;
  return series.payout > 0n ? (
    <span className="font-medium text-garant">It rained. Paid in full.</span>
  ) : (
    <span>Dry enough. No payout.</span>
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
    <div className="grid gap-6 py-6 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="font-display text-xl">{series.label}</p>
        <label className="mt-4 block text-sm text-muted">
          Payout if it rains at least {mm(series.strike)} mm
          <div className="mt-1 flex max-w-xs items-baseline gap-1 border-b-2 border-ink pb-1 text-ink">
            <span className="text-2xl">$</span>
            <input
              type="number"
              min={1}
              value={payout || ""}
              onChange={(e) => setPayout(Number(e.target.value))}
              className="w-full bg-transparent font-display text-3xl font-semibold outline-none"
            />
          </div>
        </label>
      </div>
      <div className="md:text-right">
        <p className="text-sm text-muted">Cost today</p>
        <p className="font-display text-3xl font-semibold">{q ? usd(toNum6(q.costAusd)) : noOffers ? "–" : "…"}</p>
        {noOffers ? <p className="max-w-[14rem] text-sm text-muted md:ml-auto">Not enough cover on offer for this amount. Try a smaller payout.</p> : null}
        {auth.signedIn ? (
          <button
            onClick={buy}
            disabled={!q || busy}
            className="mt-3 rounded-full bg-ink px-6 py-3 text-paper disabled:opacity-40"
          >
            {busy ? "Buying…" : "Buy cover"}
          </button>
        ) : (
          <button
            onClick={auth.signIn}
            disabled={!auth.enabled}
            className="mt-3 rounded-full border border-ink px-6 py-3 disabled:opacity-40"
          >
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
