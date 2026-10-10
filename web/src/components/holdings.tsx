"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import type { Address } from "viem";
import { useAuth } from "@/components/providers";
import { claim, status, type SeriesView } from "@/lib/garant";
import { explorerTx, publicClient } from "@/lib/chain";
import { toNum6, usd } from "@/lib/format";
import { useSeries } from "@/lib/use-series";

const STATE = { OPEN: "Open", RESOLVED: "Settled", VOIDED: "Voided" };

export function Holdings({ title, filter }: { title: string; filter?: (s: SeriesView) => boolean }) {
  const auth = useAuth();
  const { data: series } = useSeries();
  const shown = (series ?? []).filter(filter ?? (() => true));
  const { data: rows, isLoading } = useQuery({
    queryKey: ["holdings", auth.address, shown.map((s) => s.id.toString()).join()],
    enabled: !!auth.address && shown.length > 0,
    queryFn: async () => {
      const all = await Promise.all(
        shown.map(async (s) => ({ series: s, ...(await status(publicClient, { seriesId: s.id, account: auth.address as Address })) })),
      );
      return all.filter((r) => r.protect > 0n || r.back > 0n);
    },
  });

  if (!auth.signedIn) return null;

  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl font-medium">{title}</h2>
      {isLoading ? (
        <p className="mt-3 text-muted">Loading…</p>
      ) : rows?.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-rule">
                <th className="py-2 pr-4 font-normal">Series</th>
                <th className="py-2 pr-4 text-right font-normal">Guarantees</th>
                <th className="py-2 pr-4 text-right font-normal">Backing shares</th>
                <th className="py-2 pr-4 font-normal">State</th>
                <th className="py-2 text-right font-normal">To collect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.series.id.toString()} className="border-b border-rule">
                  <td className="py-3 pr-4">{r.series.label}</td>
                  <td className="py-3 pr-4 text-right">{toNum6(r.protect).toLocaleString("en-US")}</td>
                  <td className="py-3 pr-4 text-right">{toNum6(r.back).toLocaleString("en-US")}</td>
                  <td className="py-3 pr-4">{STATE[r.state]}</td>
                  <td className="py-3 text-right">
                    {r.state === "OPEN" ? (
                      <span className="text-muted">After settlement</span>
                    ) : (
                      <ClaimButton seriesId={r.series.id} amount={r.claimable} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-muted">Nothing held yet.</p>
      )}
    </section>
  );
}

function ClaimButton({ seriesId, amount }: { seriesId: bigint; amount: bigint }) {
  const { data: wallet } = useWalletClient();
  const qc = useQueryClient();
  const [state, setState] = useState<{ busy: boolean; hash?: string; error?: string }>({ busy: false });

  if (state.hash)
    return (
      <a href={explorerTx(state.hash)} target="_blank" rel="noreferrer" className="text-garant underline underline-offset-4">
        Collected
      </a>
    );

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        disabled={!wallet || state.busy || amount === 0n}
        onClick={async () => {
          if (!wallet) return;
          setState({ busy: true });
          try {
            const hash = await claim(wallet, { seriesId });
            setState({ busy: false, hash });
            qc.invalidateQueries({ queryKey: ["holdings"] });
          } catch (e) {
            setState({ busy: false, error: (e as Error).message });
          }
        }}
        className="rounded-full bg-ink px-4 py-1.5 text-paper disabled:opacity-40"
      >
        {state.busy ? "Collecting…" : `Collect ${usd(toNum6(amount))}`}
      </button>
      {state.error ? <span role="alert" className="max-w-xs text-xs text-alert">{state.error}</span> : null}
    </span>
  );
}
