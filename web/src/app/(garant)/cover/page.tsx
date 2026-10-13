import type { Metadata } from "next";
import { CoverView } from "./cover-view";

export const metadata: Metadata = { title: "Rain cover · Garant" };

export default function CoverPage() {
  return (
    <>
      <p className="eyebrow">Rain cover · Manila</p>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Get paid if it <span className="prism-text">rains</span> on the day.
      </h1>
      <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-muted">
        Choose a date and a rainfall level. If two independent weather services both measure at least that much rain,
        the cover pays out in full. There&apos;s no claim to file.
      </p>
      <CoverView />
    </>
  );
}
