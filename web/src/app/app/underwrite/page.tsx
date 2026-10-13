import type { Metadata } from "next";
import { AppHero } from "@/components/app/app-hero";
import { Glyph } from "@/components/glyph";
import { UnderwriteView } from "./underwrite-view";

export const metadata: Metadata = { title: "Underwrite · Garant" };

export default function UnderwritePage() {
  return (
    <>
      <AppHero
        title="Back the guarantees. Earn the fee."
        lead="Each dollar you lock creates one guarantee and one backing share. You sell the guarantee at a price you set. At settlement the backing share returns whatever the guarantee didn't pay out, so your worst case is known before you start."
        object={<Glyph kind="plus" still tilt={-8} className="w-40" />}
      />
      <UnderwriteView />
    </>
  );
}
