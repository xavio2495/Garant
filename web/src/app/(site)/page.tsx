import { Story } from "@/components/landing/story";
import { Loader } from "@/components/loader";
import { StoryRail } from "@/components/story-rail";

const CHAPTERS = [
  { id: "arrive", title: "Garant" },
  { id: "about", title: "About" },
  { id: "engine", title: "One engine" },
  { id: "start", title: "Try it" },
  { id: "footer", title: "Footer" },
] as const;

// Preloader, then one pinned stage that tells the whole story, then the footer
export default function Home() {
  return (
    <>
      <Loader />
      <StoryRail chapters={CHAPTERS} />
      <Story />
    </>
  );
}
