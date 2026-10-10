import { indexer } from "envio";

const KINDS = ["BINARY", "FX_FLOOR"] as const;

const logId = (e: { chainId: number; block: { number: number }; logIndex: number }) =>
  `${e.chainId}_${e.block.number}_${e.logIndex}`;

async function bumpAccount(
  context: any,
  account: string,
  minted: bigint,
  redeemed: bigint,
) {
  const a = await context.Account.get(account);
  context.Account.set({
    id: account,
    mintedTotal: (a?.mintedTotal ?? 0n) + minted,
    redeemedTotal: (a?.redeemedTotal ?? 0n) + redeemed,
  });
}

indexer.onEvent(
  { contract: "OutcomeSeries", event: "SeriesCreated" },
  async ({ event, context }) => {
    const p = event.params;
    context.Series.set({
      id: p.id.toString(),
      kind: KINDS[Number(p.kind)],
      state: "OPEN",
      label: p.label,
      strike: p.strike,
      lower: p.lower,
      expiry: p.expiry,
      protect: p.protect,
      back: p.back,
      market: undefined,
      payout: 0n,
      resolver: p.resolver,
      createdAt: event.block.timestamp,
      resolvedAt: undefined,
      observed: undefined,
      observedAt: undefined,
      settleBlock: undefined,
    });
  },
);

indexer.contractRegister(
  { contract: "OutcomeSeries", event: "MarketSet" },
  async ({ event, context }) => {
    context.chain.KuruMarket.add(event.params.market);
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "MarketSet" },
  async ({ event, context }) => {
    const id = event.params.id.toString();
    const s = await context.Series.getOrThrow(id);
    context.Series.set({ ...s, market: event.params.market });
    context.Market.set({ id: event.params.market, series_id: id });
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "Minted" },
  async ({ event, context }) => {
    const p = event.params;
    context.Mint.set({
      id: logId(event),
      series_id: p.id.toString(),
      account: p.account,
      amount: p.amount,
      block: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });
    await bumpAccount(context, p.account, p.amount, 0n);
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "SetRedeemed" },
  async ({ event, context }) => {
    const p = event.params;
    context.SetRedeem.set({
      id: logId(event),
      series_id: p.id.toString(),
      account: p.account,
      amount: p.amount,
      block: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });
    await bumpAccount(context, p.account, 0n, p.amount);
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "Resolved" },
  async ({ event, context }) => {
    const p = event.params;
    const s = await context.Series.getOrThrow(p.id.toString());
    context.Series.set({
      ...s,
      state: "RESOLVED",
      payout: p.payout,
      observed: p.observed,
      observedAt: p.observedAt,
      resolvedAt: event.block.timestamp,
      settleBlock: event.block.number,
    });
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "Voided" },
  async ({ event, context }) => {
    const s = await context.Series.getOrThrow(event.params.id.toString());
    context.Series.set({
      ...s,
      state: "VOIDED",
      payout: 500000000000000000n,
      resolvedAt: event.block.timestamp,
      settleBlock: event.block.number,
    });
  },
);

indexer.onEvent(
  { contract: "OutcomeSeries", event: "Redeemed" },
  async ({ event, context }) => {
    const p = event.params;
    context.Redemption.set({
      id: logId(event),
      series_id: p.id.toString(),
      account: p.account,
      protectIn: p.protectIn,
      backIn: p.backIn,
      ausdOut: p.ausdOut,
      block: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });
    await bumpAccount(context, p.account, 0n, p.ausdOut);
  },
);

indexer.onEvent(
  { contract: "CREResolver", event: "ReportReceived" },
  async ({ event, context }) => {
    const p = event.params;
    context.WeatherReport.set({
      id: p.id.toString(),
      series_id: p.id.toString(),
      outcome: Number(p.outcome),
      observedA: p.observedA,
      observedB: p.observedB,
      finalizeAfter: p.finalizeAfter,
    });
  },
);

indexer.onEvent(
  { contract: "KuruMarket", event: "Trade" },
  async ({ event, context }) => {
    const p = event.params;
    const m = await context.Market.getOrThrow(event.srcAddress);
    context.Trade.set({
      id: logId(event),
      series_id: m.series_id,
      market: event.srcAddress,
      maker: p.maker,
      taker: p.taker,
      isBuy: p.isBuy,
      price: p.price,
      filledSize: p.filledSize,
      block: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });
  },
);
