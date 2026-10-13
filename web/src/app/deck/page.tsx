import type { Metadata } from "next";
import Link from "next/link";
import { Glyph, Slashes } from "@/components/glyph";
import { HexVideo } from "@/components/hex-video";
import { SiteNav } from "@/components/site-nav";
import { DeckControls } from "./deck-controls";

export const metadata: Metadata = {
  title: "Garant · Deck",
  description: "Fully funded guarantees on exchange rates and weather, priced on Kuru and settled on Monad.",
};

const TITLES = ["Garant", "The gap", "The contract", "Two ways in", "Settlement", "Why Monad", "Business", "Try it"];

// Each slide is a card on the inside of a sphere; DeckControls seats them and turns the sphere. The glass is its own
// layer at the back of the card, so pieces marked data-pop (inner cards, figures, glass objects) can lift off it in 3D.
const SLIDE = "absolute left-0 top-0 flex h-[min(40rem,70svh)] w-[min(60rem,82vw)] items-center px-6 py-10 [backface-visibility:hidden] sm:px-12 lg:px-16";
const PANE = <div aria-hidden className="glass absolute inset-0 [transform:translateZ(-1px)]" />;
const H2 = "font-display text-[clamp(1.5rem,3.6vw,3.1rem)] font-bold leading-[1.04] tracking-[-0.005em]";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div data-in className="border-l border-rule pl-5">
      <p className="whitespace-nowrap font-pixel text-3xl text-ink sm:text-4xl">{value}</p>
      <p className="mt-2 max-w-[16rem] text-sm leading-snug text-muted">{label}</p>
    </div>
  );
}

export default function DeckPage() {
  return (
    <>
      <SiteNav />
      <DeckControls titles={TITLES} />

      <div id="deck" className="fixed inset-0 overflow-hidden">
        <div data-sphere className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]">
        <section data-slide className={SLIDE}>
          {PANE}
          <div className="relative z-10 max-w-2xl">
            <h1 data-in className="font-display text-[clamp(1.56rem,3.36vw,3.24rem)] font-bold leading-[1.04] tracking-[-0.005em]">
              Prediction markets let people bet on the world.{" "}
              <span className="sheen-text">Garant lets them protect themselves from it.</span>
            </h1>
          </div>
          <div data-pop="200" className="pointer-events-none absolute -right-60 top-1/2 hidden w-[28rem] -translate-y-1/2 lg:block">
            <HexVideo className="w-full opacity-90" />
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 data-in className={`${H2}`}>
                Some people can&apos;t afford for the number to move.
              </h2>
              <p data-in className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
                A family on a fixed peso budget lives on the dollar rate. An organiser with one outdoor date lives on the
                forecast. Neither can hedge today: the tools are built for traders, and claims take weeks.
              </p>
            </div>
            <div data-pop="90" className="grid gap-8">
              <Stat value="₱62.50" label="The floor a transferred dollar is guaranteed, for 30 days" />
              <Stat value="30 days" label="How long the floor holds for a protected transfer" />
            </div>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="w-full">
            <h2 data-in className={`${H2} max-w-4xl`}>One dollar in. Two claims out.</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <div data-in data-pop="70" className="glass p-7">
                <p className="font-pixel text-3xl text-floor">PROTECT</p>
                <p className="mt-3 text-muted">Pays <span className="text-ink">p</span> per token once the series settles. It trades against AUSD on a Kuru order book, so an open market sets the price.</p>
              </div>
              <div className="flex items-center justify-center">
                <div data-in data-pop="150" className="glass grid size-28 place-items-center text-center">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">lock<br /><span className="text-ink">1 AUSD</span></span>
                </div>
              </div>
              <div data-in data-pop="70" className="glass p-7">
                <p className="font-pixel text-3xl text-garant">BACK</p>
                <p className="mt-3 text-muted">Pays <span className="text-ink">1 − p</span>. Held by underwriters, who earn the premium and know their worst case up front.</p>
              </div>
            </div>
            <p data-in className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-muted">
              A complete set always redeems 1:1. Collateral equals outstanding sets plus unredeemed claims. Every payout
              is funded before anyone buys.
            </p>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="w-full">
            <h2 data-in className={`${H2} max-w-4xl`}>One engine, two products.</h2>
            <div className="relative mt-12 grid gap-5 md:grid-cols-2">
              <div data-pop="230" className="pointer-events-none absolute -bottom-14 -left-36 z-10 w-40">
                <Glyph kind="arrows" className="w-full" tilt={-4} />
              </div>
              <div data-pop="230" className="pointer-events-none absolute -bottom-16 -right-24 z-10 h-48">
                <Slashes still className="h-full" tilt={6} />
              </div>
              <div data-in data-pop="90" className="glass relative min-h-64 p-8">
                <p className="font-pixel text-2xl text-floor">01</p>
                <h3 className="mt-16 font-display text-3xl font-bold">Protected transfers</h3>
                <p className="mt-3 max-w-md text-muted">A remittance app calls one API. The family is guaranteed at least ₱62.50 per dollar; if USD/PHP falls, the shortfall is paid automatically.</p>
              </div>
              <div data-in data-pop="90" className="glass relative min-h-64 p-8">
                <p className="font-pixel text-2xl text-floor">02</p>
                <h3 className="mt-16 font-display text-3xl font-bold">Event rain cover</h3>
                <p className="mt-3 max-w-md text-muted">An organiser picks a date, a place and a rainfall level. Two weather sources settle it. Minutes, not weeks of claims.</p>
              </div>
            </div>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 data-in className={`${H2}`}>It settles itself, from two sources.</h2>
              <p data-in className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
                A Chainlink CRE workflow reads two independent data sources. If they agree, the report is posted. If they
                don&apos;t, the series voids and every set redeems at exactly half. A short review window lets a guardian
                stop a bad report before it pays.
              </p>
            </div>
            <div data-pop="90" className="grid gap-8 sm:grid-cols-2">
              <Stat value="55–59 s" label="From expiry to a CRE report on chain" />
              <Stat value="100%" label="Of the maximum payout locked as collateral" />
              <Stat value="20 = 20" label="AUSD in and AUSD out across the live rain and FX loop" />
              <Stat value="7" label="Series settled live on Monad testnet, rain and exchange rate" />
            </div>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="relative w-full">
            <h2 data-in className={`${H2} max-w-4xl`}>Cheap enough for a micro-premium. Fast enough to feel instant.</h2>
            <div data-pop="90" className="mt-12 grid gap-8 sm:grid-cols-3">
              <Stat value="~0.3 s" label="Block time: settlement follows the oracle print within moments" />
              <Stat value="89,731" label="Gas to finalize a series, so small premiums are viable" />
              <Stat value="On-chain" label="Order book on Kuru, not off-chain matching" />
            </div>
            <div data-pop="220" className="absolute -right-24 -top-36 hidden w-44 lg:block">
              <Glyph kind="hash" className="w-full" tilt={8} />
            </div>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 data-in className={`${H2}`}>We sell to the apps. Not against them.</h2>
              <p data-in className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
                Fifteen-plus teams build the same remittance app. Garant is the guarantee they add to checkout, on a
                take rate of the premium with a share back to the partner. Underwriters earn income that doesn&apos;t move
                with crypto prices.
              </p>
            </div>
            <div data-pop="90" className="grid gap-8 sm:grid-cols-2">
              <Stat value="10–15%" label="Target take rate on premium, shared with the partner app" />
              <Stat value="USD→PHP" label="First corridor, then MXN and INR" />
            </div>
          </div>
        </section>

        <section data-slide className={SLIDE}>
          {PANE}
          <div className="relative w-full">
            <div data-pop="200" className="absolute -right-36 top-1/2 hidden w-72 -translate-y-1/2 lg:block">
              <Glyph kind="braces" className="w-full" tilt={-5} />
            </div>
            <h2 data-in className={`${H2} max-w-3xl`}>
              Live on testnet. <span className="sheen-text">Nothing to install.</span>
            </h2>
            <p data-in className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
              Testnet by choice: we won&apos;t put an unaudited product on mainnet with real money. Sign in, take free test
              funds, buy a cover or underwrite one.
            </p>
            <div data-in className="mt-10 flex flex-wrap gap-4">
              <Link href="/app" className="btn btn-glass">Open the app</Link>
              <Link href="/partner" className="btn btn-glass">Protect a transfer</Link>
              <Link href="/api" className="btn btn-glass">Partner API</Link>
            </div>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
