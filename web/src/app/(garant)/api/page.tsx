import type { Metadata } from "next";

export const metadata: Metadata = { title: "Partner API · Garant" };

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/quote?notionalUsd=200",
    does: "Prices a rate guarantee for a transfer. Returns the open USD/PHP series, the cost, and today's reference rate.",
    example: `{
  "series": { "id": "0", "label": "USD/PHP floor 62.50, 9 Nov 2026", "strike": "6250000000", "lower": "6000000000", "expiry": 1794240000 },
  "quote": { "protectAmount": "8333333", "costAusd": "916700", "avgPrice": 0.11, "validUntil": 1791669243 },
  "reference": { "rate": 62.821, "date": "2026-10-09" }
}`,
  },
  {
    method: "POST",
    path: "/api/protect",
    does: "Buys a guarantee for a transfer from your partner account. Body: notionalUsd, and optionally beneficiary (otherwise your account holds it and collects for the recipient). Purchases above your per-request limit are refused with 403.",
    example: `{ "seriesId": "0", "protectAmount": "8333333", "costAusd": "916700", "beneficiary": "0x8B49…e9b1", "txs": ["0x…", "0x…"] }

403 { "error": "Policy: this purchase costs $9.17, over the partner limit of $5.00 per request" }`,
  },
  {
    method: "GET",
    path: "/api/status?seriesId=0&account=0x…",
    does: "Shows a recipient's guarantee: amount held, whether the series has settled, and what can be claimed.",
    example: `{ "protect": "8333333", "back": "0", "state": "OPEN", "payout": "0", "claimable": "0" }`,
  },
  {
    method: "GET",
    path: "/api/series",
    does: "Lists every series with its terms and state.",
    example: `{ "series": [ { "id": "0", "kind": "FX_FLOOR", "state": "OPEN", … } ] }`,
  },
  {
    method: "GET",
    path: "/api/rate",
    does: "Today's USD/PHP reference rate from the European Central Bank, the fixing that FX guarantees settle on.",
    example: `{ "pair": "USD/PHP", "source": "ECB", "rate": 62.821, "date": "2026-10-09" }`,
  },
];

export default function ApiPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Add a rate guarantee to your checkout.</h1>
      <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-muted">
        Quote, buy and check guarantees over plain HTTPS. Amounts are integers with six decimals (1000000 = $1.00) and
        exchange rates have eight. Every purchase runs through your partner account, which has a spending limit and
        can only reach Garant&apos;s contracts.
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
            </div>
            <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-paper">{e.example}</pre>
          </section>
        ))}
      </div>
    </>
  );
}
