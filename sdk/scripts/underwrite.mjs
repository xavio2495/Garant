// Demo underwriter: mint sets on a series and post a PROTECT ask on its Kuru market.
//   SERIES=0 SIZE=300 PRICE=0.11 node scripts/underwrite.mjs   (needs DEPLOYER_PRIVATE_KEY or UNDERWRITER_PRIVATE_KEY)
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as sdk from '../dist/index.js';

sdk.setDeployments(JSON.parse(readFileSync(new URL('../../deployments/10143.json', import.meta.url), 'utf8')));
const seriesId = BigInt(process.env.SERIES);
const size = parseUnits(process.env.SIZE, 6);
const price = Number(process.env.PRICE);
const key = process.env.UNDERWRITER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
const client = createPublicClient({ chain: monadTestnet, transport: http() });
const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account: privateKeyToAccount(key) });

const before = await sdk.status(client, { seriesId, account: wallet.account.address });
if (before.protect < size) console.log('mint', await sdk.mintSets(wallet, { seriesId, amount: size - before.protect }));
console.log('ask', await sdk.postAsk(wallet, { seriesId, price, size }));
console.log('book', await sdk.quote(client, { seriesId, protectAmount: size }));
