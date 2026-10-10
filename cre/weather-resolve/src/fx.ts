import { type Hex, hexToString } from "viem";
import { isoDate } from "./weather";

export type FxSpec = { base: string; quote: string; yyyymmdd: number };

export type FxDecision =
  | { kind: "report"; outcome: number; rateA: bigint; rateB: bigint }
  | { kind: "retry"; reason: string };

export const FX_OUTCOME = { OK: 0, VOID: 2 } as const;

// bytes32("USD/PHP") -> { base: "USD", quote: "PHP" }
export function decodePair(pair: Hex): { base: string; quote: string } {
  const [base, quote, ...rest] = hexToString(pair, { size: 32 }).replace(/\0+$/, "").split("/");
  if (!base || !quote || rest.length) throw new Error(`bad pair ${pair}`);
  if (base.toUpperCase() !== "USD") throw new Error(`unsupported base ${base}`);
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

export function fxSourceAUrl(s: FxSpec): string {
  return `https://api.frankfurter.dev/v1/${isoDate(s.yyyymmdd)}?base=${s.base.toUpperCase()}&symbols=${s.quote.toUpperCase()}`;
}

export function fxSourceBUrl(s: FxSpec): string {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${isoDate(s.yyyymmdd)}/v1/currencies/${s.base.toLowerCase()}.json`;
}

const positive = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

// Both parsers return null unless the source's fixing date is the requested date.
export function parseFxA(json: any, s: FxSpec): number | null {
  if (json?.date !== isoDate(s.yyyymmdd)) return null;
  return positive(json?.rates?.[s.quote.toUpperCase()]);
}

export function parseFxB(json: any, s: FxSpec): number | null {
  if (json?.date !== isoDate(s.yyyymmdd)) return null;
  return positive(json?.[s.base.toLowerCase()]?.[s.quote.toLowerCase()]);
}

export const to8dp = (rate: number): bigint => BigInt(Math.round(rate * 1e8));

// Mirrors the contract: VOID when |A - B| * 10_000 > tolBps * mid.
export function decideFx(a: number | null, b: number | null, tolBps: number): FxDecision {
  if (a === null) return { kind: "retry", reason: "source A missing or wrong date" };
  if (b === null) return { kind: "retry", reason: "source B missing or wrong date" };
  const rateA = to8dp(a);
  const rateB = to8dp(b);
  const diff = rateA > rateB ? rateA - rateB : rateB - rateA;
  const mid = (rateA + rateB) / 2n;
  const outcome = diff * 10_000n <= BigInt(tolBps) * mid ? FX_OUTCOME.OK : FX_OUTCOME.VOID;
  return { kind: "report", outcome, rateA, rateB };
}
