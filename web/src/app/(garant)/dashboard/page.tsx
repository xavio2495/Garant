import type { Metadata } from "next";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard · Garant" };

export default function DashboardPage() {
  return (
    <>
      <p className="eyebrow">Live on Monad testnet</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Every guarantee, fully funded.</h1>
      <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted">
        Live figures from Monad testnet, indexed by Envio. Money locked always covers the most that could be paid out.
      </p>
      <DashboardView />
    </>
  );
}
