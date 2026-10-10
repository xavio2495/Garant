import { erc20Abi, publicActions, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { outcomeSeriesAbi, pythAbi, pythResolverAbi } from './abi/index.js';
import { getDeployments } from './deployments.js';
import { marketAdapter } from './market.js';
import { account, approveIfNeeded, send } from './tx.js';

export * from './abi/index.js';
export { setDeployments, getDeployments, type Deployments } from './deployments.js';
export { KURU_MARKET_PARAMS, decodeL2Asks, type Level } from './market.js';

const ONE = 10n ** 18n;
const KINDS = ['BINARY', 'FX_FLOOR'] as const;
const STATES = ['OPEN', 'RESOLVED', 'VOIDED'] as const;
const ZERO: Address = '0x0000000000000000000000000000000000000000';
const QUOTE_TTL_SECONDS = 60;

export type SeriesView = {
  id: bigint;
  kind: (typeof KINDS)[number];
  state: (typeof STATES)[number];
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
  protectAmount: bigint; // PROTECT, 6 dp
  costAusd: bigint; // AUSD, 6 dp
  avgPrice: number; // AUSD per PROTECT
  validUntil: number; // unix seconds
};

export type Status = { protect: bigint; back: bigint; state: SeriesView['state']; payout: bigint; claimable: bigint };

function reader(wallet: WalletClient): PublicClient {
  return wallet.extend(publicActions) as unknown as PublicClient;
}

async function readSeries(client: PublicClient, id: bigint) {
  return client.readContract({ address: getDeployments().outcomeSeries, abi: outcomeSeriesAbi, functionName: 'series', args: [id] });
}

export async function listSeries(client: PublicClient): Promise<SeriesView[]> {
  const address = getDeployments().outcomeSeries;
  const count = await client.readContract({ address, abi: outcomeSeriesAbi, functionName: 'seriesCount' });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const series = await client.multicall({
    allowFailure: false,
    contracts: ids.map((id) => ({ address, abi: outcomeSeriesAbi, functionName: 'series', args: [id] }) as const),
  });
  // the label is not stored on-chain; PROTECT is named "<label> PROTECT"
  const names = await client.multicall({
    allowFailure: false,
    contracts: series.map((s) => ({ address: s.protect, abi: erc20Abi, functionName: 'name' }) as const),
  });
  return series.map((s, i) => ({
    id: ids[i],
    kind: KINDS[s.kind],
    state: STATES[s.state],
    label: names[i].replace(/ PROTECT$/, ''),
    strike: BigInt(s.strike),
    lower: BigInt(s.lower),
    expiry: Number(s.expiry),
    protect: s.protect,
    back: s.back,
    market: s.market === ZERO ? null : s.market,
    payout: s.payout,
    resolver: s.resolver,
    oracleRef: s.oracleRef,
  }));
}

/** PROTECT needed so a full payout covers the shortfall from K down to L: N = notional*(K-L)/L (6 dp). */
export function sizeFxFloor({ notionalUsd, strike, lower }: { notionalUsd: bigint; strike: bigint; lower: bigint }): bigint {
  if (lower <= 0n || lower >= strike) throw new Error('need 0 < lower < strike');
  return (notionalUsd * (strike - lower)) / lower;
}

export async function quote(client: PublicClient, { seriesId, protectAmount }: { seriesId: bigint; protectAmount: bigint }): Promise<Quote> {
  const s = await readSeries(client, seriesId);
  if (s.market === ZERO) throw new Error(`series ${seriesId} has no market`);
  const m = marketAdapter();
  const { costAusd } = m.fillCost(await m.asks(client, s.market), protectAmount);
  return {
    seriesId,
    protectAmount,
    costAusd,
    avgPrice: Number(costAusd) / Number(protectAmount),
    validUntil: Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS,
  };
}

/** Buys exactly the quoted PROTECT (fill-or-kill, capped at the quoted cost) and sends it to the beneficiary. */
export async function protect(
  wallet: WalletClient,
  { quote: q, beneficiary, maxCostAusd }: { quote: Quote; beneficiary: Address; maxCostAusd: bigint },
): Promise<Hex[]> {
  if (q.costAusd > maxCostAusd) throw new Error(`quote cost ${q.costAusd} exceeds max ${maxCostAusd}`);
  if (Date.now() / 1000 > q.validUntil) throw new Error('quote expired');
  const client = reader(wallet);
  const s = await readSeries(client, q.seriesId);
  if (s.market === ZERO) throw new Error(`series ${q.seriesId} has no market`);

  const hashes = await marketAdapter().buy(wallet, client, s.market, q);
  if (beneficiary.toLowerCase() !== account(wallet).toLowerCase()) {
    hashes.push(
      await send(wallet, client, { address: s.protect, abi: erc20Abi, functionName: 'transfer', args: [beneficiary, q.protectAmount] }),
    );
  }
  return hashes;
}

export async function mintSets(wallet: WalletClient, { seriesId, amount }: { seriesId: bigint; amount: bigint }): Promise<Hex> {
  const client = reader(wallet);
  const { ausd, outcomeSeries } = getDeployments();
  await approveIfNeeded(wallet, client, ausd, outcomeSeries, amount);
  return send(wallet, client, { address: outcomeSeries, abi: outcomeSeriesAbi, functionName: 'mint', args: [seriesId, amount, account(wallet)] });
}

/** price: AUSD per PROTECT in (0, 1), on a 0.001 tick. size: PROTECT, 6 dp. */
export async function postAsk(wallet: WalletClient, { seriesId, price, size }: { seriesId: bigint; price: number; size: bigint }): Promise<Hex> {
  const units = Math.round(price * 10_000);
  if (units <= 0 || units >= 10_000 || units % 10 !== 0) throw new Error('price must be in (0, 1) on a 0.001 tick');
  const client = reader(wallet);
  const s = await readSeries(client, seriesId);
  if (s.market === ZERO) throw new Error(`series ${seriesId} has no market`);
  return marketAdapter().postAsk(wallet, client, s.market, s.protect, BigInt(units), size);
}

/** Moves the underwriter's sale proceeds (AUSD) from the market's margin account to the wallet. */
export async function withdrawProceeds(wallet: WalletClient): Promise<Hex | null> {
  return marketAdapter().withdrawProceeds(wallet, reader(wallet));
}

export async function status(client: PublicClient, { seriesId, account: who }: { seriesId: bigint; account: Address }): Promise<Status> {
  const s = await readSeries(client, seriesId);
  const [p, b] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: s.protect, abi: erc20Abi, functionName: 'balanceOf', args: [who] },
      { address: s.back, abi: erc20Abi, functionName: 'balanceOf', args: [who] },
    ],
  });
  const state = STATES[s.state];
  // mirrors OutcomeSeries: matched pairs pay 1, the unmatched remainder is rounded down
  const sets = p < b ? p : b;
  const claimable = state === 'OPEN' ? 0n : sets + ((p - sets) * s.payout) / ONE + ((b - sets) * (ONE - s.payout)) / ONE;
  return { protect: p, back: b, state, payout: s.payout, claimable };
}

export async function claim(wallet: WalletClient, { seriesId }: { seriesId: bigint }): Promise<Hex> {
  return send(wallet, reader(wallet), {
    address: getDeployments().outcomeSeries,
    abi: outcomeSeriesAbi,
    functionName: 'redeem',
    args: [seriesId, account(wallet)],
  });
}

/** Crypto floors on PythResolver only: fetches the first Hermes print at/after expiry and settles. FX series settle via CRE. */
export async function resolvePyth(
  wallet: WalletClient,
  { seriesId, apiKey, hermesUrl = 'https://hermes.pyth.network' }: { seriesId: bigint; apiKey: string; hermesUrl?: string },
): Promise<Hex> {
  if (!apiKey) throw new Error('PYTH_API_KEY is required for Hermes');
  const client = reader(wallet);
  const s = await readSeries(client, seriesId);
  const res = await fetch(`${hermesUrl}/v2/updates/price/${s.expiry}?ids[]=${s.oracleRef}&encoding=hex`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Hermes ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { binary: { data: string[] } };
  const updateData = body.binary.data.map((d) => `0x${d}` as Hex);
  const { pyth, pythResolver } = getDeployments();
  const fee = await client.readContract({ address: pyth, abi: pythAbi, functionName: 'getUpdateFee', args: [updateData] });
  return send(wallet, client, { address: pythResolver, abi: pythResolverAbi, functionName: 'resolve', args: [seriesId, updateData], value: fee });
}
