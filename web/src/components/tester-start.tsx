"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { explorerTx } from "@/lib/chain";

const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;

type State = { kind: "idle" | "busy" } | { kind: "done"; message: string; txs: string[] } | { kind: "error"; message: string };

// Gets a new tester from zero to a funded testnet wallet in two clicks
export function TesterStart() {
  const auth = useAuth();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function topUp() {
    if (!auth.address) return;
    setState({ kind: "busy" });
    const r = await fetch("/api/faucet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: auth.address }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string; message?: string; txs?: string[] } | null;
    if (!r?.ok || !j) return setState({ kind: "error", message: j?.error ?? "Top-up failed. Try again in a minute." });
    setState({ kind: "done", message: j.message ?? "Sent testnet MON for gas and test dollars (AUSD).", txs: j.txs ?? [] });
  }

  const steps = [
    {
      title: "Sign in",
      body: auth.signedIn ? "You're signed in." : "With email, Google or a browser wallet.",
      action: !auth.signedIn && auth.enabled && (
        <button onClick={auth.signIn} disabled={!auth.ready} className="rounded-full bg-ink px-4 py-1.5 text-sm text-paper disabled:opacity-50">
          Sign in
        </button>
      ),
    },
    {
      title: "Get test funds",
      body: "Free testnet MON and AUSD. Nothing here is real money.",
      action: auth.signedIn && state.kind !== "done" && (
        <button
          onClick={topUp}
          disabled={state.kind === "busy"}
          className="rounded-full bg-garant px-4 py-1.5 text-sm text-paper disabled:opacity-50"
        >
          {state.kind === "busy" ? "Sending…" : "Get test funds"}
        </button>
      ),
    },
    {
      title: "Try it",
      body: (
        <>
          Buy <Link href="/cover" className="text-garant underline underline-offset-4">rain cover</Link> or{" "}
          <Link href="/underwrite" className="text-garant underline underline-offset-4">underwrite</Link> a guarantee
          {FEEDBACK_URL && (
            <>
              , then{" "}
              <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="text-garant underline underline-offset-4">
                tell us what you think
              </a>
            </>
          )}
          .
        </>
      ),
    },
  ];

  return (
    <section aria-labelledby="tester-start" className="border-b border-rule py-10">
      <h2 id="tester-start" className="font-display text-2xl font-medium">
        Testing Garant? Start here
      </h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="border-l-2 border-floor pl-3">
            <p className="text-sm text-muted">Step {i + 1}</p>
            <h3 className="font-medium">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            {s.action && <div className="mt-3">{s.action}</div>}
          </li>
        ))}
      </ol>
      {state.kind === "done" && (
        <p role="status" className="mt-5 text-sm text-garant">
          {state.message}{" "}
          {state.txs.map((h, i) => (
            <a key={h} href={explorerTx(h)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              tx {i + 1}
            </a>
          )).reduce<ReactNode[]>((a, el) => (a.length ? [...a, " · ", el] : [el]), [])}
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="mt-5 text-sm text-alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
