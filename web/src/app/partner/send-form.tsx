"use client";

import { useEffect, useState } from "react";
import { FloorLine } from "@/components/floor-line";
import { date, fx8, php, toNum6, usd } from "@/lib/format";

type QuoteResponse = {
  series: { id: string; strike: string; lower: string; expiry: number };
  quote: { costAusd: string; protectAmount: string; validUntil: number };
  reference: { rate: number; date: string } | null;
};

type Stage = { kind: "form" } | { kind: "sending" } | { kind: "sent"; guaranteed: boolean } | { kind: "error"; message: string };

const RECIPIENT = { name: "Rosa", full: "Rosa Santos", place: "Quezon City" };

export function SendForm() {
  const [amount, setAmount] = useState(200);
  const [guarantee, setGuarantee] = useState(true);
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  useEffect(() => {
    if (!(amount > 0)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/quote?notionalUsd=${amount}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then(setData)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [amount]);

  const floor = data ? fx8(BigInt(data.series.strike)) : null;
  const lower = data ? fx8(BigInt(data.series.lower)) : null;
  const fee = data ? toNum6(BigInt(data.quote.costAusd)) : null;
  const rate = data?.reference?.rate ?? null;
  const total = amount + (guarantee && fee ? fee : 0);

  async function send() {
    setStage({ kind: "sending" });
    if (!guarantee) return setStage({ kind: "sent", guaranteed: false });
    const r = await fetch("/api/protect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notionalUsd: amount, seriesId: data?.series.id }),
    });
    if (r.ok) return setStage({ kind: "sent", guaranteed: true });
    const j = await r.json().catch(() => ({}));
    setStage({ kind: "error", message: j.error ?? "The guarantee could not be added. Your money has not been sent." });
  }

  if (stage.kind === "sent") {
    return (
      <section className="px-6 pb-10 pt-8" aria-live="polite">
        <h1 className="font-display text-3xl font-semibold leading-tight">
          {usd(amount)} is on its way to {RECIPIENT.name}.
        </h1>
        {stage.guaranteed && floor && data ? (
          <p className="mt-4 leading-relaxed text-muted">
            {RECIPIENT.name}&apos;s rate is guaranteed at {php(floor, 2)} per dollar until {date(data.series.expiry)}. If the
            official rate is lower on that day, {RECIPIENT.name} gets the difference automatically.
          </p>
        ) : null}
        <button onClick={() => setStage({ kind: "form" })} className="mt-8 text-garant underline underline-offset-4">
          Send another transfer
        </button>
      </section>
    );
  }

  return (
    <section className="px-6 pb-8 pt-4">
      <p className="text-muted">
        Sending to {RECIPIENT.full}, {RECIPIENT.place}
      </p>

      <label className="mt-6 block">
        <span className="text-sm text-muted">You send</span>
        <div className="mt-1 flex items-baseline gap-1 border-b-2 border-ink pb-2">
          <span className="font-display text-4xl font-semibold">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={10000}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-transparent font-display text-5xl font-semibold tracking-tight outline-none"
            aria-label="Amount in US dollars"
          />
        </div>
      </label>

      <p className="mt-3 text-sm text-muted">
        {rate ? (
          <>
            {RECIPIENT.name} receives about <span className="text-ink">{php(amount * rate)}</span> at today&apos;s rate of{" "}
            {php(rate, 2)}.
          </>
        ) : (
          "Fetching today's rate…"
        )}
      </p>

      <div
        className={`mt-8 rounded-2xl border-2 p-5 transition-colors ${guarantee ? "border-floor bg-floor-soft/50" : "border-rule"}`}
      >
        <label className="flex cursor-pointer items-start gap-4">
          <input
            type="checkbox"
            checked={guarantee}
            onChange={(e) => setGuarantee(e.target.checked)}
            className="mt-1.5 size-5 shrink-0 accent-garant"
          />
          <span>
            <span className="block font-display text-xl font-semibold leading-snug">
              {floor ? `Guarantee ${php(floor, 2)} per dollar for 30 days` : "Guarantee the rate for 30 days"}
            </span>
            <span className="mt-1 block text-lg">{fee !== null ? usd(fee) : "…"}</span>
          </span>
        </label>
        {floor && lower && data ? (
          <>
            <FloorLine floor={floor} className="mt-4 w-full" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              If the official rate on {date(data.series.expiry)} is below {php(floor, 2)}, {RECIPIENT.name} gets the
              difference, up to {php(amount * (floor - lower))}. It&apos;s settled on the European Central Bank&apos;s daily
              reference rate, cross-checked against a second source.
            </p>
          </>
        ) : null}
      </div>

      {stage.kind === "error" ? (
        <p role="alert" className="mt-6 rounded-xl bg-alert/10 p-4 text-sm text-alert">
          {stage.message}
        </p>
      ) : null}

      <button
        onClick={send}
        disabled={!(amount > 0) || stage.kind === "sending" || (guarantee && fee === null)}
        className="mt-8 w-full rounded-full bg-ink py-4 text-lg font-medium text-paper disabled:opacity-40"
      >
        {stage.kind === "sending" ? "Sending…" : `Send ${usd(total)}`}
      </button>
    </section>
  );
}
