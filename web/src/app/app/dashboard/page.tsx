import type { Metadata } from "next";
import { AppHero } from "@/components/app/app-hero";
import { Glyph } from "@/components/glyph";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard · Garant" };

export default function DashboardPage() {
  return (
    <>
      <AppHero
        title="Every guarantee, fully funded."
        lead="Live figures from Monad testnet, indexed by Envio. Money locked always covers the most that could be paid out."
        object={<Glyph kind="hash" still tilt={6} className="w-40" />}
      />
      <DashboardView />
    </>
  );
}
