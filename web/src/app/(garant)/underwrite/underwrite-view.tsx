"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import type { Hex, WalletClient } from "viem";
import { useAuth } from "@/components/providers";
import { mintSets, postAsk, withdrawProceeds, type SeriesView } from "@/lib/garant";
import { explorerTx } from "@/lib/chain";
import { date, fx8, php, usd } from "@/lib/format";
import { useSeries } from "@/lib/use-series";

function useRate() {
  return useQuery({
    queryKey: ["rate"],
    queryFn: async () => {
      const r = await fetch("/api/rate");
      return r.ok ? ((await r.json()) as { rate: number; date: string }) : null;
    },
    staleTime: 3_600_000,
  });
}

// What one guarantee would pay if the series settled at today's reference rate
function valueToday(s: SeriesView, rate: number | undefined) {
  if (s.kind !== "FX_FLOOR" || rate === undefined) return null;
  const k = fx8(s.strike);
  const l = fx8(s.lower);
  return Math.min(Math.max((k - rate) / (k - l), 0), 1);
}

const terms = (s: SeriesView) =>
  s.kind === "FX_FLOOR"
    ? `Pays up to $1 if USD/PHP fixes below ${php(fx8(s.strike), 2)} on ${date(s.expiry)}, in full at ${php(fx8(s.lower), 2)} or lower.`
    : `Pays $1 if at least ${(Number(s.strike) / 100).toFixed(0)} mm of rain is measured. ${s.label}.`;

export function UnderwriteView() {
  const { data: series } = useSeries();
  const { data: rate } = useRate();
  const open = (series ?? []).filter((s) => s.state === "OPEN");
  const [selected, setSelected] = useState<string | null>(null);
  const current = open.find((s) => s.id.toString() === selected) ?? open[0];

  if (!series) return <p className="mt-12 text-muted">Loading series…</p>;
  if (!current) return <p className="mt-12 text-muted">No series are open for underwriting right now.</p>;

  const ref = valueToday(current, rate?.rate);

  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-[18rem_1fr]">
      <nav aria-label="Open series" className="flex flex-col gap-1">
        {open.map((s) => (
          <button
            key={s.id.toString()}
            onClick={() => setSelected(s.id.toString())}
            aria-pressed={s.id === current.id}
            className="rounded-lg px-3 py-2 text-left hover:bg-garant-soft aria-pressed:bg-ink aria-pressed:text-paper"
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div>
        <p className="max-w-[40rem] leading-relaxed">{terms(current)}</p>
        <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-8 gap-y-4 border-y border-rule py-5 text-sm">
          <div>
            <dt className="text-muted">Reference rate</dt>
            <dd className="mt-1 font-display text-2xl">{rate ? php(rate.rate, 3) : "–"}</dd>
            {rate ? <dd className="text-xs text-muted">ECB, {rate.date}</dd> : null}
          </div>
          <div>
            <dt className="text-muted">Payout per guarantee at that rate</dt>
            <dd className="mt-1 font-display text-2xl">{ref === null ? "–" : usd(ref)}</dd>
            <dd className="text-xs text-muted">A floor, not a forecast. Price above it for the time left.</dd>
          </div>
        </dl>

        <ol className="mt-10 max-w-xl space-y-10">
          <Step
            n={1}
            title="Lock dollars"
            help="Each $1 locked creates 1 guarantee and 1 backing share. You can unlock both together at any time before settlement."
            fields={[{ name: "amount", label: "Amount", unit: "$", value: 100 }]}
            action="Lock"
            run={(w, v) => mintSets(w, { seriesId: current.id, amount: BigInt(Math.round(v.amount * 1e6)) })}
          />
          <Step
            n={2}
            title="Offer guarantees for sale"
            help="Your offer sits on the public order book until someone buys or you cancel it. Prices move in steps of $0.001."
            fields={[
              { name: "price", label: "Price each", unit: "$", value: 0.03, step: 0.001 },
              { name: "size", label: "How many", value: 100 },
            ]}
            action="Post offer"
            run={(w, v) => postAsk(w, { seriesId: current.id, price: v.price, size: BigInt(Math.round(v.size * 1e6)) })}
          />
          <Step
            n={3}
            title="Collect what you've earned"
            help="Sale proceeds wait in your trading balance until you withdraw them."
            fields={[{ name: "amount", label: "Amount", unit: "$", value: 3 }]}
            action="Withdraw"
            run={(w, v) => withdrawProceeds(w, { amount: BigInt(Math.round(v.amount * 1e6)) })}
          />
        </ol>
      </div>
    </div>
  );
}

type Field = { name: string; label: string; unit?: string; value: number; step?: number };

function Step({
  n,
  title,
  help,
  fields,
  action,
  run,
}: {
  n: number;
  title: string;
  help: string;
  fields: Field[];
  action: string;
  run: (wallet: WalletClient, values: Record<string, number>) => Promise<Hex>;
}) {
  const auth = useAuth();
  const { data: wallet } = useWalletClient();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.value])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; hash: Hex } | { ok: false; error: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setBusy(true);
    setResult(null);
    try {
      setResult({ ok: true, hash: await run(wallet, values) });
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid grid-cols-[2.5rem_1fr]">
      <span className="font-display text-2xl text-floor">{n}</span>
      <form onSubmit={submit}>
        <h3 className="font-display text-xl font-medium">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{help}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {fields.map((f) => (
            <label key={f.name} className="text-sm text-muted">
              {f.label}
              <div className="mt-1 flex items-baseline gap-1 border-b-2 border-ink pb-1 text-ink">
                {f.unit ? <span>{f.unit}</span> : null}
                <input
                  type="number"
                  min={0}
                  step={f.step ?? 1}
                  value={values[f.name] || ""}
                  onChange={(e) => setValues({ ...values, [f.name]: Number(e.target.value) })}
                  className="w-28 bg-transparent font-display text-2xl outline-none"
                />
              </div>
            </label>
          ))}
          {auth.signedIn ? (
            <button disabled={busy || !wallet} className="rounded-full bg-ink px-5 py-2.5 text-paper disabled:opacity-40">
              {busy ? `${action}…` : action}
            </button>
          ) : (
            <button
              type="button"
              onClick={auth.signIn}
              disabled={!auth.enabled}
              className="rounded-full border border-ink px-5 py-2.5 disabled:opacity-40"
            >
              Sign in to {action.toLowerCase()}
            </button>
          )}
        </div>
        {result ? (
          result.ok ? (
            <p role="status" className="mt-3 text-sm text-garant">
              Done.{" "}
              <a href={explorerTx(result.hash)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                View the transaction
              </a>
            </p>
          ) : (
            <p role="alert" className="mt-3 text-sm text-alert">
              {result.error}
            </p>
          )
        ) : null}
      </form>
    </li>
  );
}
