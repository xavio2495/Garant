import type { Metadata } from "next";
import { Glyph } from "@/components/glyph";

export const metadata: Metadata = { title: "Partner API · Garant" };

type Endpoint = { method: string; path: string; does: string; example: string; errors: [number, string][] };

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/quote?notionalUsd=200",
    does: "Prices a rate guarantee for a transfer of up to $10,000. Returns the USD/PHP series on sale, the cost, and today's reference rate. You can also quote any series directly with seriesId and protectAmount.",
    example: `{
  "series": { "id": "0", "kind": "FX_FLOOR", "state": "OPEN", "label": "USD/PHP 62.50 floor 2026-11-09",
              "strike": "6250000000", "lower": "6000000000", "expiry": 1794240000, "market": "0x0E72…0718", … },
  "quote": { "seriesId": "0", "protectAmount": "8333333", "costAusd": "916700", "avgPrice": 0.11, "validUntil": 1791669243 },
  "reference": { "rate": 62.821, "date": "2026-10-09" }
}`,
    errors: [
      [400, "notionalUsd must be greater than 0 and at most 10000"],
      [400, "Pass notionalUsd, or seriesId and protectAmount"],
      [404, "No open exchange-rate guarantee right now"],
      [409, "Not enough offers to price this guarantee: …"],
    ],
  },
  {
    method: "POST",
    path: "/api/protect",
    does: "Buys a guarantee for a transfer from your partner account. Body: notionalUsd, and optionally beneficiary. Without a beneficiary your account holds the guarantee and collects for the recipient. Your partner account is a Privy server wallet. Privy signs only what the account's policy allows: calls to Garant's contracts on Monad, and approvals within your per-request limit. Anything else is refused before it is signed.",
    example: `{ "notionalUsd": 200, "beneficiary": "0x…" }

{ "seriesId": "0", "protectAmount": "8333333", "costAusd": "916700",
  "beneficiary": "0x8B49…e9b1", "signer": "privy", "txs": ["0x142f…ec45", "0x2e72…4e8d"] }`,
    errors: [
      [400, "notionalUsd must be greater than 0 and at most 10000"],
      [400, "beneficiary must be an address"],
      [403, "Blocked by the Privy wallet policy. This purchase costs $9.17, over the partner limit of $5.00 per request"],
      [404, "No open exchange-rate guarantee right now"],
      [409, "Not enough offers to price this guarantee: …"],
      [502, "Purchase failed: …"],
      [503, "Partner wallet is not configured"],
    ],
  },
  {
    method: "GET",
    path: "/api/status?seriesId=0&account=0x…",
    does: "Shows what an account holds in a series and what it can collect once the series settles.",
    example: `{ "protect": "8333636", "back": "0", "state": "OPEN", "payout": "0", "claimable": "0" }`,
    errors: [
      [400, "Pass seriesId and a valid account"],
      [404, "Series 99 not found"],
    ],
  },
  {
    method: "GET",
    path: "/api/series",
    does: "Lists every series with its terms, market and state.",
    example: `{ "series": [ { "id": "0", "kind": "FX_FLOOR", "state": "OPEN", "label": "USD/PHP 62.50 floor 2026-11-09", … } ] }`,
    errors: [],
  },
  {
    method: "GET",
    path: "/api/rate",
    does: "Today's USD/PHP reference rate from the European Central Bank, the fixing that exchange-rate guarantees settle on.",
    example: `{ "pair": "USD/PHP", "source": "ECB", "rate": 62.821, "date": "2026-10-09" }`,
    errors: [[502, "Reference rate unavailable"]],
  },
];

// Where each endpoint sits in the bento (desktop): the big three on top, the three small reads along the bottom.
// The outer columns turn in towards the reader, so the whole grid reads as one curved screen.
const AREA = [
  "lg:[grid-area:quote] lg:[transform:translateZ(-110px)]",
  "lg:[grid-area:protect] lg:origin-left lg:[transform:translateZ(-70px)_rotateY(-9deg)]",
  "lg:[grid-area:status] lg:origin-right lg:[transform:translateZ(-70px)_rotateY(9deg)]",
  "lg:[grid-area:series] lg:[transform:translateZ(-110px)]",
  "lg:[grid-area:rate] lg:origin-left lg:[transform:translateZ(-70px)_rotateY(-9deg)]",
];

// One screen of glass tiles on desktop: the introduction, then each endpoint with what it does, a real response and
// its errors. Long examples scroll inside their tile; the page itself only scrolls to reach the footer.
export default function ApiPage() {
  return (
    <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:h-[calc(100svh-5.25rem)] lg:pb-8">
      <div className="grid gap-3 lg:h-full lg:[perspective:1400px] lg:[transform-style:preserve-3d] lg:grid-cols-6 lg:grid-rows-[1fr_1fr_auto] lg:[grid-template-areas:'intro_intro_quote_quote_protect_protect''intro_intro_quote_quote_protect_protect''status_status_series_series_rate_rate']">
        <section className="glass curved relative z-10 flex min-h-0 flex-col p-6 sm:p-8 lg:origin-right lg:[grid-area:intro] lg:[transform:rotateY(11deg)]">
          <Glyph kind="braces" className="absolute -right-8 -top-10 z-10 w-36" tilt={-8} still />
          <h1 className="max-w-md font-display text-[clamp(1.5rem,2.6vw,2.6rem)] leading-[1.05]">
            Add a rate guarantee to your <span className="sheen-text">checkout.</span>
          </h1>
          <p className="mt-auto pt-6 text-sm leading-relaxed text-muted">
            Quote, buy and check guarantees over plain HTTPS with JSON. Amounts are strings with six decimals (1000000 =
            $1.00); exchange rates have eight.
          </p>
          <p className="mt-3 text-sm text-muted">
            Errors return a status and{" "}
            <code className="border border-rule bg-white/5 px-1.5 py-0.5 font-mono text-xs text-ink">{`{ "error": "…" }`}</code>
          </p>
        </section>

        {ENDPOINTS.map((e, i) => (
          <section key={e.path} className={`glass glass-quiet curved flex min-h-0 min-w-0 flex-col overflow-hidden p-5 ${AREA[i]}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="font-pixel text-lg text-floor">{String(i + 1).padStart(2, "0")}</span>
              <span className={`px-2 py-0.5 font-mono text-[0.68rem] font-semibold tracking-wider text-black ${e.method === "POST" ? "bg-floor" : "bg-garant"}`}>
                {e.method}
              </span>
              <h2 className="min-w-0 truncate font-mono text-sm text-ink" title={e.path}>{e.path}</h2>
            </div>
            <p className="mt-3 text-[0.8rem] leading-relaxed text-muted">{e.does}</p>
            <pre data-lenis-prevent className="scroll-tiny mt-3 min-h-10 min-w-0 flex-1 overflow-auto border border-rule bg-black/50 p-3 font-mono text-[0.68rem] leading-relaxed text-ink">
              {e.example}
            </pre>
            {e.errors.length ? (
              <dl className="mt-3 space-y-1 text-[0.72rem]">
                {e.errors.map(([code, msg]) => (
                  <div key={msg} className="flex gap-2">
                    <dt className="w-8 shrink-0 font-mono text-alert">{code}</dt>
                    <dd className="min-w-0 truncate text-muted" title={msg}>{msg}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
