import { HexVideo } from "@/components/hex-video";

// One glass object fixed behind the landing page; the motion layer moves it from chapter to chapter
export function HexStage() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      <div data-stage-obj className="absolute left-1/2 top-1/2 size-[min(80vmin,840px)]">
        <HexVideo className="size-full" />
      </div>
    </div>
  );
}
