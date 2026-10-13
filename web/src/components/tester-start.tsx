"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { explorerTx } from "@/lib/chain";

const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;

// Measured on the live testnet loop (the same figures the deck quotes)
const PROOF = ["55–59 s from expiry to settlement report", "100% of every payout locked", "20 AUSD in, 20 out", "7 series settled live"];

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
        <button onClick={auth.signIn} disabled={!auth.ready} className="btn btn-primary px-4 py-2">
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
          className="btn btn-primary px-4 py-2"
        >
          {state.kind === "busy" ? "Sending…" : "Get test funds"}
        </button>
      ),
    },
    {
      title: "Try it",
      body: (
        <>
          Buy rain cover, or back the guarantees and earn the fee
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
    <div className="contents">
      <div data-part className="max-w-5xl">
        <h2 id="tester-start" className="font-display text-[clamp(1.5rem,3.4vw,3.2rem)] leading-[1.08]">
          Live on Monad testnet. <span className="text-muted">Start here.</span>
        </h2>
        <p className="mt-4 font-mono text-[0.68rem] uppercase leading-relaxed tracking-[0.18em] text-muted">
          {PROOF.join(" · ")} <span className="text-floor">· measured on testnet</span>
        </p>
      </div>
      <div data-arc="start" className="arc mt-10 grid gap-5 md:grid-cols-3">
        <ol className="contents">
          {steps.map((s, i) => (
            <li key={s.title} data-card className="glass glass-quiet flex flex-col p-6 sm:p-7">
              <p className="font-pixel text-xl text-floor">0{i + 1}</p>
              <h3 className="mt-8 font-display text-xl leading-tight sm:text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              {s.action && <div className="mt-4">{s.action}</div>}
            </li>
          ))}
        </ol>
        {/* Floats in front of the last card on the stage, rather than sitting inside it */}
        <div data-pop="2" className="justify-self-end md:col-start-3">
          <Link href="/app" className="btn btn-glass px-6 py-3">Open the app</Link>
        </div>
      </div>
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
    </div>
  );
}
