// Creates (or refreshes) the partner's Privy server wallet and the policy that limits what it signs.
//   node scripts/privy-setup.mjs           first run: key, policy, wallet; appends PRIVY_* to ../.env
//   node scripts/privy-setup.mjs --fund    also sends MON and AUSD from TESTER_PRIVATE_KEY
// Re-run after opening a new partner series: it refreshes the policy's allow-list.
// Needs NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET.
import { appendFileSync, readFileSync } from 'node:fs';
import { PrivyClient, generateP256KeyPair } from '@privy-io/node';
import { createPublicClient, createWalletClient, erc20Abi, http, parseEther, parseUnits } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as sdk from '@garant/sdk';

const env = process.env;
const ENV_FILE = new URL('../../.env', import.meta.url);
const d = JSON.parse(readFileSync(new URL('../../deployments/10143.json', import.meta.url), 'utf8'));
sdk.setDeployments(d);

const cap = parseUnits(env.PARTNER_MAX_AUSD_PER_REQUEST ?? '5', 6);
const client = createPublicClient({ chain: monadTestnet, transport: http() });
const privy = new PrivyClient({ appId: env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });

// Partner series: open USD/PHP floors with at least a week to run (as in web/src/lib/garant.ts)
const now = Date.now() / 1000;
const series = (await sdk.listSeries(client)).filter(
  (s) => s.kind === 'FX_FLOOR' && s.state === 'OPEN' && s.label.startsWith('USD/PHP') && s.expiry > now + 7 * 24 * 3600 && s.market,
);
if (!series.length) throw new Error('no open partner series');
const markets = series.map((s) => s.market.toLowerCase());
const protects = series.map((s) => s.protect.toLowerCase());

const onMonad = { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '10143' };
const to = (v) => ({ field_source: 'ethereum_transaction', field: 'to', operator: Array.isArray(v) ? 'in' : 'eq', value: v });
const approveAbi = [erc20Abi.find((f) => f.name === 'approve')];
const transferAbi = [erc20Abi.find((f) => f.name === 'transfer')];
const call = (field, operator, value, abi) => ({ field_source: 'ethereum_calldata', field, operator, value, abi });
const rule = (name, conditions) => ({ name, method: 'eth_signTransaction', action: 'ALLOW', conditions: [onMonad, ...conditions] });

// Anything not allowed here is refused by Privy
const rules = [
  rule('Buy on a partner series market', [to(markets)]),
  rule(`Approve at most ${env.PARTNER_MAX_AUSD_PER_REQUEST ?? '5'} AUSD to a partner market`, [
    to(d.ausd.toLowerCase()),
    call('approve.spender', 'in', markets, approveAbi),
    call('approve.amount', 'lte', cap.toString(), approveAbi),
  ]),
  rule('Send PROTECT to the beneficiary', [to(protects), call('transfer.amount', 'gt', '0', transferAbi)]),
];

let { PRIVY_AUTHORIZATION_KEY: authKey, PRIVY_POLICY_ID: policyId, PRIVY_WALLET_ID: walletId, PRIVY_WALLET_ADDRESS: address } = env;
const auth = () => ({ authorization_private_keys: [authKey] });

if (policyId && walletId) {
  await privy.policies().update(policyId, { rules, authorization_context: auth() });
  console.log(`policy ${policyId} refreshed for series ${series.map((s) => s.id).join(', ')}`);
} else {
  const keys = await generateP256KeyPair();
  authKey = keys.privateKey;
  const owner = { public_key: keys.publicKey };
  const policy = await privy.policies().create({ version: '1.0', name: 'Garant partner purchases', chain_type: 'ethereum', rules, owner });
  const wallet = await privy.wallets().create({ chain_type: 'ethereum', owner, policy_ids: [policy.id] });
  [policyId, walletId, address] = [policy.id, wallet.id, wallet.address];
  appendFileSync(
    ENV_FILE,
    `\nPRIVY_AUTHORIZATION_KEY=${authKey}\nPRIVY_POLICY_ID=${policyId}\nPRIVY_WALLET_ID=${walletId}\nPRIVY_WALLET_ADDRESS=${address}\n`,
  );
  console.log(`created policy ${policyId} and wallet ${walletId} ${address}; PRIVY_* appended to .env`);
}

if (process.argv.includes('--fund')) {
  const funder = createWalletClient({ chain: monadTestnet, transport: http(), account: privateKeyToAccount(env.TESTER_PRIVATE_KEY) });
  const mon = await funder.sendTransaction({ to: address, value: parseEther(env.PRIVY_FUND_MON ?? '0.2') });
  await client.waitForTransactionReceipt({ hash: mon });
  const ausd = await funder.writeContract({ address: d.ausd, abi: erc20Abi, functionName: 'transfer', args: [address, parseUnits('50', 6)] });
  await client.waitForTransactionReceipt({ hash: ausd });
  console.log(`funded ${address}: MON ${mon}, AUSD ${ausd}`);
}
