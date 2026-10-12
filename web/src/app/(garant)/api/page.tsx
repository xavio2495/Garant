import type { Metadata } from "next";

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

export default function ApiPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Add a rate guarantee to your checkout.</h1>
      <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted">
        Quote, buy and check guarantees over plain HTTPS with JSON. Amounts are strings with six decimals (1000000 =
        $1.00) and exchange rates have eight. Errors return a status code and a body of the form{" "}
        <code className="rounded bg-garant-soft px-1">{`{ "error": "…" }`}</code>.
      </p>
      <div className="mt-12 divide-y divide-rule border-y border-rule">
        {ENDPOINTS.map((e) => (
          <section key={e.path} className="grid gap-4 py-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="break-all font-display text-lg">
                <span className="mr-2 rounded bg-garant-soft px-2 py-0.5 text-sm text-garant">{e.method}</span>
                {e.path}
              </h2>
              <p className="mt-2 max-w-[34rem] leading-relaxed text-muted">{e.does}</p>
              {e.errors.length ? (
                <dl className="mt-4 space-y-1 text-sm">
                  {e.errors.map(([code, msg]) => (
                    <div key={msg} className="flex gap-3">
                      <dt className="w-10 shrink-0 text-alert">{code}</dt>
                      <dd className="text-muted">{msg}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-paper">{e.example}</pre>
          </section>
        ))}
      </div>
    </>
  );
}
