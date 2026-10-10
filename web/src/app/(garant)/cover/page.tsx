import type { Metadata } from "next";
import { CoverView } from "./cover-view";

export const metadata: Metadata = { title: "Rain cover · Garant" };

export default function CoverPage() {
  return (
    <>
      <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Get paid if it rains on the day.
      </h1>
      <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-muted">
        Choose a date and a rainfall level. If two independent weather services both measure at least that much rain,
        the cover pays out in full. There&apos;s no claim to file.
      </p>
      <CoverView />
    </>
  );
}
