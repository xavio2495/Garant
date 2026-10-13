import type { ReactNode } from "react";
import { Panel, Pop } from "@/components/app/panel";
import { Stage } from "@/components/app/stage";

// Each app page opens on one glass card: the title, a line on what the page does, and its glass object breaking out
// past the top corner
export function AppHero({ title, lead, object }: { title: ReactNode; lead: ReactNode; object: ReactNode }) {
  return (
    <Stage>
      <Panel className="p-7 sm:p-10 lg:pr-60">
        <h1 data-split className="max-w-3xl font-display text-[clamp(1.56rem,3.4vw,2.8rem)] leading-[1.04]">
          {title}
        </h1>
        <p data-rise="0.25" className="mt-5 max-w-[38rem] text-lg leading-relaxed text-muted">
          {lead}
        </p>
        <Pop z={150} className="pointer-events-none absolute -right-10 top-8 hidden sm:block">
          {object}
        </Pop>
      </Panel>
    </Stage>
  );
}
