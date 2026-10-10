// Read-only settlement and gas metrics from the live deployment on Monad testnet.
//   node scripts/metrics.mjs            (optional MON_USD=<price> for a USD/AUSD estimate)
// Monad charges gas_limit * gas price, so costs use each transaction's gas limit.
import { readFileSync } from 'node:fs';
import { createPublicClient, formatEther, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import * as sdk from '../dist/index.js';

const d = JSON.parse(readFileSync(new URL('../../deployments/10143.json', import.meta.url), 'utf8'));
sdk.setDeployments(d);
const client = createPublicClient({ chain: monadTestnet, transport: http() });
const MAX_RANGE = 100n; // public RPC eth_getLogs limit
const BURST = 10; // public RPC allows 25 requests/s
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** All events of `abi` emitted by `address` since the deployment block. */
async function logs(address, abi) {
  const head = await client.getBlockNumber();
  const ranges = [];
  for (let from = BigInt(d.startBlock); from <= head; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n > head ? head : from + MAX_RANGE - 1n;
    ranges.push([from, to]);
  }
  const out = [];
  for (let i = 0; i < ranges.length; i += BURST) {
    const batch = await Promise.all(
      ranges.slice(i, i + BURST).map(([fromBlock, toBlock]) => client.getContractEvents({ address, abi, fromBlock, toBlock })),
    );
    out.push(...batch.flat());
    await sleep(600);
  }
  return out;
}

const blockTime = new Map();
async function timeOf(blockNumber) {
  if (!blockTime.has(blockNumber)) blockTime.set(blockNumber, Number((await client.getBlock({ blockNumber })).timestamp));
  return blockTime.get(blockNumber);
}

async function txCost(hash) {
  const [tx, rc] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  return { gasUsed: rc.gasUsed, gasLimit: tx.gas, price: rc.effectiveGasPrice };
}

const series = await sdk.listSeries(client);
const osLogs = await logs(d.outcomeSeries, sdk.outcomeSeriesAbi);
const pick = (all, name) => all.filter((l) => l.eventName === name);
const [resolved, voided, minted, redeemed] = ['Resolved', 'Voided', 'Minted', 'Redeemed'].map((n) => pick(osLogs, n));
const weather = pick(await logs(d.creResolver, sdk.creResolverAbi), 'ReportReceived');
const fx = pick(await logs(d.creFxResolver, sdk.creFxResolverAbi), 'FxReportReceived');
const trades = [];
for (const s of series.filter((x) => x.market)) trades.push(...pick(await logs(s.market, sdk.kuruOrderBookAbi), 'Trade'));

// settlement latency per series
const reports = new Map([...weather, ...fx].map((l) => [l.args.id, l]));
const settles = new Map([...resolved, ...voided].map((l) => [l.args.id, l]));
const rows = [];
for (const s of series) {
  const r = reports.get(s.id);
  const f = settles.get(s.id);
  if (!f) continue;
  const fT = await timeOf(f.blockNumber);
  const rT = r ? await timeOf(r.blockNumber) : null;
  rows.push({
    id: Number(s.id),
    label: s.label,
    state: s.state,
    payout: Number(s.payout) / 1e18,
    'expiry→report s': rT === null ? '-' : rT - s.expiry,
    reportBlock: r ? Number(r.blockNumber) : '-',
    settleBlock: Number(f.blockNumber),
    'report→settle blocks': r ? Number(f.blockNumber - r.blockNumber) : '-',
    'report→settle s': rT === null ? '-' : fT - rT,
    'expiry→settle s': fT - s.expiry,
  });
}
console.log('\nSettlement (report→settle includes the 600 s challenge window)');
console.table(rows);

// gas per step: latest transaction of each kind
const steps = {
  mint: minted.at(-1)?.transactionHash,
  'protect (Kuru market buy)': trades.at(-1)?.transactionHash,
  'weather report (CRE)': weather.at(-1)?.transactionHash,
  'fx report (CRE)': fx.at(-1)?.transactionHash,
  'finalize → settle': resolved.findLast((l) => reports.has(l.args.id))?.transactionHash,
  'pyth resolve': resolved.findLast((l) => !reports.has(l.args.id))?.transactionHash,
  redeem: redeemed.at(-1)?.transactionHash,
};
const gasPrice = await client.getGasPrice();
const monUsd = process.env.MON_USD ? Number(process.env.MON_USD) : null;
const gasRows = [];
for (const [step, hash] of Object.entries(steps)) {
  if (!hash) {
    gasRows.push({ step, tx: '(none yet)' });
    continue;
  }
  const c = await txCost(hash);
  const mon = Number(formatEther(c.gasLimit * gasPrice));
  gasRows.push({
    step,
    gasUsed: Number(c.gasUsed),
    gasLimit: Number(c.gasLimit),
    'MON @ current price': mon.toFixed(6),
    'AUSD est': monUsd === null ? 'set MON_USD' : (mon * monUsd).toFixed(4),
    tx: hash.slice(0, 12) + '…',
  });
}
console.log(`\nGas per step (current gas price ${Number(gasPrice) / 1e9} gwei; Monad bills gas limit)`);
console.table(gasRows);
