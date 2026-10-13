import type { Metadata } from "next";
import { AppHero } from "@/components/app/app-hero";
import { Slashes } from "@/components/glyph";
import { CoverView } from "./cover-view";

export const metadata: Metadata = { title: "Rain cover · Garant" };

export default function CoverPage() {
  return (
    <>
      <AppHero
        title={<>Get paid if it <span className="sheen-text">rains</span> on the day.</>}
        lead="Choose a date in Manila and a rainfall level. If two independent weather services both measure at least that much rain, the cover pays out in full. There's no claim to file."
        object={<Slashes still tilt={6} className="h-48" />}
      />
      <CoverView />
    </>
  );
}
