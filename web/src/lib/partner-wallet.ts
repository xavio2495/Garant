import "server-only";
import { createWalletClient, http, isAddressEqual, type Account, type Address, type Hex, type WalletClient } from "viem";
import { writeContract } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";
import { chain } from "@/lib/chain";
import { deployments, type SeriesView } from "@/lib/garant";

export class PolicyError extends Error {}

// Largest AUSD amount the partner wallet may spend in one request (6 dp)
export const MAX_AUSD_PER_REQUEST = BigInt(Math.round(Number(process.env.PARTNER_MAX_AUSD_PER_REQUEST ?? "5") * 1e6));

type Call = { address: Address; abi: unknown; functionName: string; args?: readonly unknown[] };

// Every transaction the partner wallet signs is checked here first: only the
// series' market, its PROTECT token, AUSD and OutcomeSeries are reachable, AUSD
// can only be approved to the market within the cap, and PROTECT can only go to
// the beneficiary.
function check(call: Call, series: SeriesView, beneficiary: Address) {
  const to = call.address;
  const args = call.args ?? [];
  if (series.market && isAddressEqual(to, series.market)) {
    if (call.functionName !== "placeAndExecuteMarketBuy") throw new PolicyError(`Policy: ${call.functionName} on the market is not allowed`);
    return;
  }
  if (isAddressEqual(to, deployments.ausd as Address)) {
    const [spender, amount] = args as [Address, bigint];
    if (call.functionName !== "approve" || !series.market || !isAddressEqual(spender, series.market))
      throw new PolicyError("Policy: AUSD may only be approved to this series' market");
    // Under Privy the spend cap is enforced by Privy's policy at signing time
    if (!usesPrivy && amount > MAX_AUSD_PER_REQUEST) throw new PolicyError(capMessage(amount));
    return;
  }
  if (isAddressEqual(to, series.protect)) {
    const [recipient] = args as [Address];
    if (call.functionName !== "transfer" || !isAddressEqual(recipient, beneficiary))
      throw new PolicyError("Policy: protection can only be sent to the beneficiary");
    return;
  }
  if (isAddressEqual(to, deployments.outcomeSeries as Address)) return;
  throw new PolicyError(`Policy: contract ${to} is not on the allow-list`);
}

export const capMessage = (cost: bigint) =>
  `Policy: this purchase costs $${(Number(cost) / 1e6).toFixed(2)}, over the partner limit of $${(Number(MAX_AUSD_PER_REQUEST) / 1e6).toFixed(2)} per request`;

// With Privy configured the partner wallet is a Privy server wallet: Privy signs only what
// its own policy allows (see scripts/privy-setup.mjs). Otherwise a local key signs.
const privy = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
  walletId: process.env.PRIVY_WALLET_ID,
  address: process.env.PRIVY_WALLET_ADDRESS as Address | undefined,
  authKey: process.env.PRIVY_AUTHORIZATION_KEY,
};
export const usesPrivy = Boolean(privy.appId && privy.appSecret && privy.walletId && privy.address && privy.authKey);

function signer(): Account | null {
  if (usesPrivy) {
    const client = new PrivyClient({ appId: privy.appId!, appSecret: privy.appSecret! });
    return createViemAccount(client, {
      walletId: privy.walletId!,
      address: privy.address as Hex,
      authorizationContext: { authorization_private_keys: [privy.authKey!] },
    });
  }
  const key = process.env.TESTER_PRIVATE_KEY;
  return key ? privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`) : null;
}

// A request Privy refused under the wallet's policy
export const isPrivyPolicyDenial = (e: unknown) => /policy_violation/i.test(String((e as Error)?.message ?? e));

export function partnerWallet(series: SeriesView, beneficiary: Address): WalletClient {
  const account = signer();
  if (!account) throw new Error("Partner wallet is not configured");
  return createWalletClient({ account, chain, transport: http() })
    .extend((client) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeContract: (args: any) => {
        check(args as Call, series, beneficiary);
        return writeContract(client, args);
      },
      sendTransaction: () => {
        throw new PolicyError("Policy: raw transactions are not allowed");
      },
    })) as unknown as WalletClient;
}

export const partnerAddress = (): Address | null => (usesPrivy ? privy.address! : (signer()?.address ?? null));
