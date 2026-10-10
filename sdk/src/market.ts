import { hexToBigInt, sliceHex, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';

import { kuruMarginAccountAbi, kuruOrderBookAbi } from './abi/index.js';
import { getDeployments } from './deployments.js';
import { account, approveIfNeeded, send } from './tx.js';

/** Kuru market parameters every Garant PROTECT/AUSD market is created with. */
export const KURU_MARKET_PARAMS = {
  sizePrecision: 1_000_000n,
  pricePrecision: 10_000n,
  tickSize: 10n,
  minSize: 1_000_000n,
  maxSize: 10n ** 15n,
  takerFeeBps: 0n,
  makerFeeBps: 0n,
  kuruAmmSpread: 100n,
} as const;

// AUSD is 6 dp and Kuru prices are in 1e-4 AUSD, so one price unit = 100 AUSD base units.
const AUSD_PER_PRICE_UNIT = 1_000_000n / KURU_MARKET_PARAMS.pricePrecision;

export type Level = { price: bigint; size: bigint }; // price in 1e-4 AUSD, size in 6 dp PROTECT

export type Fill = { protectAmount: bigint; costAusd: bigint };

export interface MarketAdapter {
  asks(client: PublicClient, market: Address): Promise<Level[]>;
  fillCost(asks: Level[], protectAmount: bigint): Fill;
  buy(wallet: WalletClient, client: PublicClient, market: Address, fill: Fill): Promise<Hex[]>;
  postAsk(wallet: WalletClient, client: PublicClient, market: Address, protect: Address, price: bigint, size: bigint): Promise<Hex>;
  withdrawProceeds(wallet: WalletClient, client: PublicClient): Promise<Hex | null>;
}

/** getL2Book layout: blockNumber, (price,size)* bids, 0, (price,size)* asks — 32-byte words. */
export function decodeL2Asks(book: Hex): Level[] {
  const words: bigint[] = [];
  for (let i = 2; i < book.length; i += 64) words.push(hexToBigInt(sliceHex(book, (i - 2) / 2, (i - 2) / 2 + 32)));
  let i = 1;
  while (i < words.length && words[i] !== 0n) i += 2;
  const asks: Level[] = [];
  for (i += 1; i + 1 < words.length && words[i] !== 0n; i += 2) asks.push({ price: words[i], size: words[i + 1] });
  return asks.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
}

export const kuru: MarketAdapter = {
  async asks(client, market) {
    const book = await client.readContract({ address: market, abi: kuruOrderBookAbi, functionName: 'getL2Book' });
    return decodeL2Asks(book);
  },

  fillCost(asks, protectAmount) {
    let left = protectAmount;
    let cost = 0n; // in 1e-10 AUSD (price unit * size unit)
    for (const { price, size } of asks) {
      if (left === 0n) break;
      const take = left < size ? left : size;
      cost += take * price;
      left -= take;
    }
    if (left > 0n) throw new Error(`not enough PROTECT on the book: short ${left}`);
    // round up to a whole Kuru quote unit so the market buy covers the full amount
    const units = (cost + KURU_MARKET_PARAMS.sizePrecision - 1n) / KURU_MARKET_PARAMS.sizePrecision;
    return { protectAmount, costAusd: units * AUSD_PER_PRICE_UNIT };
  },

  async buy(wallet, client, market, fill) {
    const { ausd } = getDeployments();
    const hashes: Hex[] = [];
    const approval = await approveIfNeeded(wallet, client, ausd, market, fill.costAusd);
    if (approval) hashes.push(approval);
    hashes.push(
      await send(wallet, client, {
        address: market,
        abi: kuruOrderBookAbi,
        functionName: 'placeAndExecuteMarketBuy',
        args: [fill.costAusd / AUSD_PER_PRICE_UNIT, fill.protectAmount, false, true],
      }),
    );
    return hashes;
  },

  async postAsk(wallet, client, market, protect, price, size) {
    const { kuruMarginAccount } = getDeployments();
    await approveIfNeeded(wallet, client, protect, kuruMarginAccount, size);
    await send(wallet, client, {
      address: kuruMarginAccount,
      abi: kuruMarginAccountAbi,
      functionName: 'deposit',
      args: [account(wallet), protect, size],
    });
    return send(wallet, client, {
      address: market,
      abi: kuruOrderBookAbi,
      functionName: 'addSellOrder',
      args: [Number(price), size, true],
    });
  },

  async withdrawProceeds(wallet, client) {
    const { ausd, kuruMarginAccount } = getDeployments();
    const balance = await client.readContract({
      address: kuruMarginAccount,
      abi: kuruMarginAccountAbi,
      functionName: 'getBalance',
      args: [account(wallet), ausd],
    });
    if (balance === 0n) return null;
    return send(wallet, client, {
      address: kuruMarginAccount,
      abi: kuruMarginAccountAbi,
      functionName: 'withdraw',
      args: [balance, ausd],
    });
  },
};

export function marketAdapter(): MarketAdapter {
  const { marketMode } = getDeployments();
  if (marketMode !== 'kuru') throw new Error(`unsupported marketMode ${marketMode}`);
  return kuru;
}

