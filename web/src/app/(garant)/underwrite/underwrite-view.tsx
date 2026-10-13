"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import type { Hex, WalletClient } from "viem";
import { useAuth } from "@/components/providers";
import { Holdings } from "@/components/holdings";
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
  return (
    <>
      <Market />
      <Holdings title="Your holdings" />
    </>
  );
}

function Market() {
  const { data: series } = useSeries();
  const { data: rate } = useRate();
  const [now] = useState(() => Date.now() / 1000);
  const open = (series ?? []).filter((s) => s.state === "OPEN" && s.expiry > now);
  const [selected, setSelected] = useState<string | null>(null);
  const current = open.find((s) => s.id.toString() === selected) ?? open[0];

  if (!series) return <p className="mt-12 text-muted">Loading series…</p>;
  if (!current) return <p className="mt-12 text-muted">No series are open for underwriting right now.</p>;

  const ref = valueToday(current, rate?.rate);

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[18rem_1fr] lg:gap-8">
      <nav aria-label="Open series" className="flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
        {open.map((s) => (
          <button
            key={s.id.toString()}
            onClick={() => setSelected(s.id.toString())}
            aria-pressed={s.id === current.id}
            className="glass glass-quiet rounded-xl px-4 py-3 text-left text-sm leading-snug text-muted transition hover:bg-garant-soft hover:text-ink aria-pressed:bg-garant-soft aria-pressed:text-ink aria-pressed:ring-1 aria-pressed:ring-garant"
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="glass min-w-0 rounded-2xl p-6 sm:p-8">
        <p className="max-w-[40rem] text-lg leading-relaxed">{terms(current)}</p>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 border-y border-rule py-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Reference rate</dt>
            <dd className="mt-2 font-pixel text-2xl text-ink sm:text-3xl">{rate ? php(rate.rate, 3) : "–"}</dd>
            {rate ? <dd className="mt-1 text-xs text-muted">ECB, {rate.date}</dd> : null}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Payout per guarantee at that rate</dt>
            <dd className="mt-2 font-pixel text-2xl text-floor sm:text-3xl">{ref === null ? "–" : usd(ref)}</dd>
            <dd className="mt-1 text-xs leading-relaxed text-muted">A floor, not a forecast. Price above it for the time left.</dd>
          </div>
        </dl>

        <ol className="mt-8 divide-y divide-rule">
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
            help="Sale proceeds wait in your trading balance until you withdraw them. This moves all of it to your wallet."
            fields={[]}
            action="Withdraw"
            run={(w) => withdrawProceeds(w)}
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
  run: (wallet: WalletClient, values: Record<string, number>) => Promise<Hex | null>;
}) {
  const auth = useAuth();
  const { data: wallet } = useWalletClient();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.value])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; hash: Hex | null } | { ok: false; error: string } | null>(null);

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
    <li className="grid grid-cols-[2.75rem_1fr] gap-x-2 py-8 first:pt-0 last:pb-0 sm:grid-cols-[3.5rem_1fr]">
      <span className="pt-1 font-pixel text-lg text-garant sm:text-xl">{String(n).padStart(2, "0")}</span>
      <form onSubmit={submit} className="min-w-0">
        <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{help}</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {fields.map((f) => (
            <label key={f.name} className="text-sm text-muted">
              {f.label}
              <div className="mt-1.5 flex items-baseline gap-1 rounded-lg border border-rule bg-white/5 px-3 py-2 text-ink transition focus-within:border-garant">
                {f.unit ? <span className="text-muted">{f.unit}</span> : null}
                <input
                  type="number"
                  min={0}
                  step={f.step ?? 1}
                  value={values[f.name] || ""}
                  onChange={(e) => setValues({ ...values, [f.name]: Number(e.target.value) })}
                  className="w-24 bg-transparent font-display text-xl tabular-nums outline-none focus:border-garant"
                />
              </div>
            </label>
          ))}
          {auth.signedIn ? (
            <button disabled={busy || !wallet} className="btn btn-primary">
              {busy ? `${action}…` : action}
            </button>
          ) : (
            <button
              type="button"
              onClick={auth.signIn}
              disabled={!auth.enabled}
              className="btn btn-glass"
            >
              Sign in to {action.toLowerCase()}
            </button>
          )}
        </div>
        {result ? (
          result.ok ? (
            <p role="status" className="mt-3 text-sm text-garant">
              {result.hash ? (
                <>
                  Done.{" "}
                  <a href={explorerTx(result.hash)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    View the transaction
                  </a>
                </>
              ) : (
                "Nothing to withdraw yet."
              )}
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
