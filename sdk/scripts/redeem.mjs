// Redeem a settled series from the deployer and tester wallets and print the payout math.
//   SERIES=7 node scripts/redeem.mjs   (needs DEPLOYER_PRIVATE_KEY and TESTER_PRIVATE_KEY)
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, erc20Abi, formatUnits, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as sdk from '../dist/index.js';

const d = JSON.parse(readFileSync(new URL('../../deployments/10143.json', import.meta.url), 'utf8'));
sdk.setDeployments(d);
const seriesId = BigInt(process.env.SERIES);
const client = createPublicClient({ chain: monadTestnet, transport: http() });
const fmt = (v) => formatUnits(v, 6);
const pct = (p) => `${(Number(p) / 1e16).toFixed(4)}%`;

const s = (await sdk.listSeries(client)).find((x) => x.id === seriesId);
console.log(`series ${s.id} "${s.label}" ${s.state}, PROTECT payout ${pct(s.payout)}, BACK payout ${pct(10n ** 18n - s.payout)}`);
if (s.state === 'OPEN') process.exit(1);

for (const [name, key] of [['deployer (underwriter)', process.env.DEPLOYER_PRIVATE_KEY], ['tester (beneficiary)', process.env.TESTER_PRIVATE_KEY]]) {
  const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account: privateKeyToAccount(key) });
  const who = wallet.account.address;
  const st = await sdk.status(client, { seriesId, account: who });
  if (st.protect + st.back === 0n) {
    console.log(`${name}: nothing to redeem`);
    continue;
  }
  const sets = st.protect < st.back ? st.protect : st.back;
  const before = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [who] });
  const hash = await sdk.claim(wallet, { seriesId });
  const after = await client.readContract({ address: d.ausd, abi: erc20Abi, functionName: 'balanceOf', args: [who] });
  console.log(
    `${name} ${who}\n` +
      `  holds ${fmt(st.protect)} PROTECT + ${fmt(st.back)} BACK = ${fmt(sets)} complete sets (pay 1 each)` +
      ` + ${fmt(st.protect - sets)} PROTECT x ${pct(s.payout)} + ${fmt(st.back - sets)} BACK x ${pct(10n ** 18n - s.payout)}\n` +
      `  expected ${fmt(st.claimable)} AUSD, received ${fmt(after - before)} AUSD, tx ${hash}`,
  );
}
