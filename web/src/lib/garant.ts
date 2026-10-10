// Local stand-in for @garant/sdk with the same signatures. Reads return demo
// data and writes throw until the contracts are deployed; replace this file's
// body with `export * from "@garant/sdk"` once the package is available.
import type { Address, Hex, PublicClient, WalletClient } from "viem";

export type SeriesView = {
  id: bigint;
  kind: "BINARY" | "FX_FLOOR";
  state: "OPEN" | "RESOLVED" | "VOIDED";
  label: string;
  strike: bigint;
  lower: bigint;
  expiry: number;
  protect: Address;
  back: Address;
  market: Address | null;
  payout: bigint;
  resolver: Address;
  oracleRef: Hex;
};

export type Quote = {
  seriesId: bigint;
  protectAmount: bigint;
  costAusd: bigint;
  avgPrice: number;
  validUntil: number;
};

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const now = () => Math.floor(Date.now() / 1000);

const demo = (s: Partial<SeriesView> & Pick<SeriesView, "id" | "kind" | "label" | "strike" | "expiry">): SeriesView => ({
  state: "OPEN",
  lower: 0n,
  protect: ZERO,
  back: ZERO,
  market: null,
  payout: 0n,
  resolver: ZERO,
  oracleRef: "0x",
  ...s,
});

const DEMO_SERIES: SeriesView[] = [
  demo({ id: 0n, kind: "FX_FLOOR", label: "USD/PHP floor 62.50, 9 Nov 2026", strike: 6_250_000_000n, lower: 6_000_000_000n, expiry: Date.UTC(2026, 10, 9, 16) / 1000 }),
  demo({ id: 1n, kind: "BINARY", label: "Manila rain 10 mm, 10 Sep 2026", strike: 1000n, expiry: Date.UTC(2026, 8, 11) / 1000, state: "RESOLVED", payout: 10n ** 18n }),
  demo({ id: 2n, kind: "BINARY", label: "Manila rain 10 mm, 1 Oct 2026", strike: 1000n, expiry: Date.UTC(2026, 9, 2) / 1000, state: "RESOLVED", payout: 0n }),
  demo({ id: 3n, kind: "BINARY", label: "Manila rain 10 mm, 11 Sep 2026", strike: 1000n, expiry: Date.UTC(2026, 8, 12) / 1000, state: "VOIDED", payout: 5n * 10n ** 17n }),
  demo({ id: 4n, kind: "FX_FLOOR", label: "USD/PHP floor 62.50, 9 Oct 2026", strike: 6_250_000_000n, lower: 6_000_000_000n, expiry: Date.UTC(2026, 9, 9, 16) / 1000, state: "RESOLVED", payout: 0n }),
  demo({ id: 5n, kind: "FX_FLOOR", label: "USD/PHP floor 63.00, 9 Oct 2026", strike: 6_300_000_000n, lower: 6_000_000_000n, expiry: Date.UTC(2026, 9, 9, 16) / 1000, state: "RESOLVED", payout: 64_833_333_333_333_333n }),
];

const DEMO_ASK: Record<"BINARY" | "FX_FLOOR", number> = { FX_FLOOR: 0.03, BINARY: 0.18 };

const notDeployed = (): never => {
  throw new Error("Garant contracts are not deployed yet");
};

export async function listSeries(_client: PublicClient): Promise<SeriesView[]> {
  return DEMO_SERIES;
}

// N = notional * (K - L) / L, in 6-decimal PROTECT units
export function sizeFxFloor({ notionalUsd, strike, lower }: { notionalUsd: number; strike: bigint; lower: bigint }): bigint {
  return (BigInt(Math.round(notionalUsd * 1e6)) * (strike - lower)) / lower;
}

export async function quote(
  _client: PublicClient,
  { seriesId, protectAmount }: { seriesId: bigint; protectAmount: bigint },
): Promise<Quote> {
  const s = DEMO_SERIES.find((x) => x.id === seriesId) ?? notDeployed();
  const avgPrice = DEMO_ASK[s.kind];
  return {
    seriesId,
    protectAmount,
    costAusd: (protectAmount * BigInt(Math.round(avgPrice * 1e4))) / 10_000n,
    avgPrice,
    validUntil: now() + 60,
  };
}

export async function protect(
  _wallet: WalletClient,
  _args: { quote: Quote; beneficiary: Address; maxCostAusd: bigint },
): Promise<Hex[]> {
  return notDeployed();
}

export async function mintSets(_wallet: WalletClient, _args: { seriesId: bigint; amount: bigint }): Promise<Hex> {
  return notDeployed();
}

export async function postAsk(_wallet: WalletClient, _args: { seriesId: bigint; price: number; size: bigint }): Promise<Hex> {
  return notDeployed();
}

export async function withdrawProceeds(_wallet: WalletClient, _args: { amount: bigint }): Promise<Hex> {
  return notDeployed();
}

export async function status(
  _client: PublicClient,
  { seriesId }: { seriesId: bigint; account: Address },
): Promise<{ protect: bigint; back: bigint; state: SeriesView["state"]; payout: bigint; claimable: bigint }> {
  const s = DEMO_SERIES.find((x) => x.id === seriesId) ?? notDeployed();
  return { protect: 0n, back: 0n, state: s.state, payout: s.payout, claimable: 0n };
}

export async function claim(_wallet: WalletClient, _args: { seriesId: bigint }): Promise<Hex> {
  return notDeployed();
}
