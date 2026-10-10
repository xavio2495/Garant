import { indexer } from "envio";

const KINDS = ["BINARY", "FX_FLOOR"] as const;

const logId = (e: { chainId: number; block: { number: number }; logIndex: number }) =>
  `${e.chainId}_${e.block.number}_${e.logIndex}`;

const STATS_ID = "global";

async function bumpStats(context: any, delta: Partial<Record<"minted" | "setRedeemed" | "redeemedAusd" | "protectPaid" | "tradeVolume", bigint> & Record<"accounts" | "trades", number>>) {
  const s = await context.Stats.get(STATS_ID);
  context.Stats.set({
    id: STATS_ID,
    minted: (s?.minted ?? 0n) + (delta.minted ?? 0n),
    setRedeemed: (s?.setRedeemed ?? 0n) + (delta.setRedeemed ?? 0n),
    redeemedAusd: (s?.redeemedAusd ?? 0n) + (delta.redeemedAusd ?? 0n),
    protectPaid: (s?.protectPaid ?? 0n) + (delta.protectPaid ?? 0n),
    accounts: (s?.accounts ?? 0) + (delta.accounts ?? 0),
    trades: (s?.trades ?? 0) + (delta.trades ?? 0),
    tradeVolume: (s?.tradeVolume ?? 0n) + (delta.tradeVolume ?? 0n),
  });
}

async function bumpAccount(
  context: any,
  account: string,
  minted: bigint,
  redeemed: bigint,
) {
  const a = await context.Account.get(account);
  if (!a) await bumpStats(context, { accounts: 1 });
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
      minted: 0n,
      setRedeemed: 0n,
      protectRedeemed: 0n,
      protectPaid: 0n,
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
    await bumpStats(context, { minted: p.amount });
    const s = await context.Series.getOrThrow(p.id.toString());
    context.Series.set({ ...s, minted: s.minted + p.amount });
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
    await bumpStats(context, { setRedeemed: p.amount });
    const s = await context.Series.getOrThrow(p.id.toString());
    context.Series.set({ ...s, setRedeemed: s.setRedeemed + p.amount });
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
    const s = await context.Series.getOrThrow(p.id.toString());
    const paid = (p.protectIn * s.payout) / 10n ** 18n;
    context.Series.set({ ...s, protectRedeemed: s.protectRedeemed + p.protectIn, protectPaid: s.protectPaid + paid });
    await bumpStats(context, { redeemedAusd: p.ausdOut, protectPaid: paid });
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
  { contract: "CREFxResolver", event: "FxReportReceived" },
  async ({ event, context }) => {
    const p = event.params;
    context.FxReport.set({
      id: p.id.toString(),
      series_id: p.id.toString(),
      outcome: Number(p.outcome),
      rateA: p.rateA,
      rateB: p.rateB,
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
    // Kuru prices are 1e18-scaled; sizes are 6 dp, so this is AUSD in 6 dp
    await bumpStats(context, { trades: 1, tradeVolume: (p.filledSize * p.price) / 10n ** 18n });
  },
);
