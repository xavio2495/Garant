import type { Metadata } from "next";
import { UnderwriteView } from "./underwrite-view";

export const metadata: Metadata = { title: "Underwrite · Garant" };

export default function UnderwritePage() {
  return (
    <>
      <p className="eyebrow">Underwrite</p>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Back the guarantees. Earn the fee.
      </h1>
      <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted">
        Each dollar you lock creates one guarantee and one backing share. You sell the guarantee at a price you set. At
        settlement the backing share returns whatever the guarantee didn&apos;t pay out, so your worst case is known
        before you start.
      </p>
      <UnderwriteView />
    </>
  );
}
