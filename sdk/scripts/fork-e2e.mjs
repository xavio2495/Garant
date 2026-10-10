// End-to-end SDK check against a local anvil fork of Monad testnet that already ran Deploy + Seed:
//   anvil --fork-url https://testnet-rpc.monad.xyz --chain-id 31337 --port 8546
//   (contracts) forge script script/Deploy.s.sol ... && forge script script/Seed.s.sol ...
//   pnpm build && pnpm test:fork
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPublicClient, createTestClient, createWalletClient, defineChain, erc20Abi, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as sdk from '../dist/index.js';

const RPC = process.env.FORK_RPC ?? 'http://127.0.0.1:8546';
const d = JSON.parse(readFileSync(new URL('../../deployments/31337.json', import.meta.url), 'utf8'));
sdk.setDeployments(d);

const chain = defineChain({
  id: 31337,
  name: 'monad-fork',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
});
const transport = http(RPC);
const client = createPublicClient({ chain, transport });
const test = createTestClient({ chain, transport, mode: 'anvil' });
// anvil default accounts 1 and 2
const maker = createWalletClient({ chain, transport, account: privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') });
const taker = createWalletClient({ chain, transport, account: privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a') });
const beneficiary = '0x000000000000000000000000000000000000bEEF';

// fund AUSD from the testnet faucet contract
const FAUCET = '0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C';
await test.impersonateAccount({ address: FAUCET });
await test.setBalance({ address: FAUCET, value: 10n ** 18n });
for (const who of [maker.account.address, taker.account.address]) {
  const hash = await createWalletClient({ chain, transport, account: FAUCET }).writeContract({
    address: d.ausd, abi: erc20Abi, functionName: 'transfer', args: [who, 1_000_000_000n],
  });
  await client.waitForTransactionReceipt({ hash });
}

const series = await sdk.listSeries(client);
assert.equal(series.length, 7);
assert.equal(series[0].label, 'USD/PHP 62.50 floor 2026-11-09');
assert.equal(series[1].kind, 'BINARY');
assert.ok(series.every((s) => s.market && s.state === 'OPEN'));
console.log('listSeries ok', series.map((s) => `${s.id}:${s.label}`));

assert.equal(sdk.sizeFxFloor({ notionalUsd: 200_000_000n, strike: 6_250_000_000n, lower: 6_000_000_000n }), 8_333_333n);

// underwriter: mint sets, post 100 PROTECT @ 0.05
await sdk.mintSets(maker, { seriesId: 0n, amount: 100_000_000n });
await sdk.postAsk(maker, { seriesId: 0n, price: 0.05, size: 100_000_000n });

// partner: quote 40 PROTECT, buy, deliver to beneficiary
const q = await sdk.quote(client, { seriesId: 0n, protectAmount: 40_000_000n });
assert.equal(q.costAusd, 2_000_000n);
assert.equal(q.avgPrice, 0.05);
await assert.rejects(sdk.protect(taker, { quote: q, beneficiary, maxCostAusd: 1_999_999n }), /exceeds max/);
const hashes = await sdk.protect(taker, { quote: q, beneficiary, maxCostAusd: 2_000_000n });
assert.equal(hashes.length, 3);
const st = await sdk.status(client, { seriesId: 0n, account: beneficiary });
assert.equal(st.protect, 40_000_000n);
assert.equal(st.claimable, 0n);
console.log('quote/protect ok', q);

const before = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [maker.account.address] });
await sdk.withdrawProceeds(maker);
const after = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [maker.account.address] });
assert.equal(after - before, 2_000_000n);
console.log('withdrawProceeds ok');

// settle series 5 (K 63.00) with the 2026-10-09 fixings through the CRE forwarder, then claim
await sdk.mintSets(maker, { seriesId: 5n, amount: 10_000_000n });
const s5 = series[5];
await test.setNextBlockTimestamp({ timestamp: BigInt(s5.expiry) });
await test.mine({ blocks: 1 });
await test.impersonateAccount({ address: d.creForwarder });
await test.setBalance({ address: d.creForwarder, value: 10n ** 18n });
const fwd = createWalletClient({ chain, transport, account: d.creForwarder });
const fxAbi = parseAbi(['function onReport(bytes,bytes)', 'function finalize(uint256)']);
const { encodeAbiParameters } = await import('viem');
const report = encodeAbiParameters(
  [{ type: 'uint256' }, { type: 'uint8' }, { type: 'int64' }, { type: 'int64' }],
  [5n, 0, 6_282_100_000n, 6_279_000_000n],
);
await client.waitForTransactionReceipt({ hash: await fwd.writeContract({ address: d.creFxResolver, abi: fxAbi, functionName: 'onReport', args: ['0x', report] }) });
await test.increaseTime({ seconds: 600 });
await test.mine({ blocks: 1 });
await client.waitForTransactionReceipt({ hash: await taker.writeContract({ address: d.creFxResolver, abi: fxAbi, functionName: 'finalize', args: [5n] }) });

const payout = ((6_300_000_000n - 6_280_550_000n) * 10n ** 18n) / 300_000_000n;
const st5 = await sdk.status(client, { seriesId: 5n, account: maker.account.address });
assert.equal(st5.state, 'RESOLVED');
assert.equal(st5.payout, payout);
assert.equal(st5.claimable, 10_000_000n); // a full set pays 1 regardless of payout
const b5 = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [maker.account.address] });
await sdk.claim(maker, { seriesId: 5n });
const a5 = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [maker.account.address] });
assert.equal(a5 - b5, 10_000_000n);
console.log('settle/status/claim ok, payout', payout);
console.log('ALL OK');
