import { createWalletClient, http, isAddress, parseAbi, parseEther, formatEther, type Address, type Hash } from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { chain, publicClient } from "@/lib/chain";
import { deployments } from "@/lib/garant";
import { fail, json } from "@/lib/json";

// Public testnet AUSD faucet; anyone may call it for any address
const AUSD_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as const;
const faucetAbi = parseAbi(["function requestFunds(address)"]);
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

// Enough gas for a few purchases or mints; skipped once a wallet already has half of it
const MON_DRIP = parseEther(process.env.FAUCET_MON ?? "0.1");
const AUSD_ENOUGH = 100_000_000n; // 100 AUSD
const MON_RESERVE = parseEther("0.2");

const inFlight = new Set<string>();

// POST { address } tops a tester wallet up with testnet MON and AUSD, once
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { address?: string };
  if (!body.address || !isAddress(body.address)) return fail(400, "address must be an address");
  const to = body.address as Address;
  const key = process.env.FAUCET_PRIVATE_KEY ?? process.env.TESTER_PRIVATE_KEY;
  if (!key) return fail(503, "Faucet is not configured");
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`, { nonceManager });

  const id = to.toLowerCase();
  if (inFlight.has(id)) return fail(429, "Already topping up this wallet");
  inFlight.add(id);
  try {
    const [code, mon, ausd, reserve] = await Promise.all([
      publicClient.getCode({ address: to }),
      publicClient.getBalance({ address: to }),
      publicClient.readContract({ address: deployments.ausd as Address, abi: erc20, functionName: "balanceOf", args: [to] }),
      publicClient.getBalance({ address: account.address }),
    ]);
    if (code && code !== "0x") return fail(400, "Send test funds to a wallet address, not a contract");

    const wallet = createWalletClient({ account, chain, transport: http() });
    const txs: Hash[] = [];
    if (mon < MON_DRIP / 2n) {
      if (reserve < MON_DRIP + MON_RESERVE) return fail(503, "The faucet is out of testnet MON. Try faucet.monad.xyz");
      txs.push(await wallet.sendTransaction({ to, value: MON_DRIP }));
    }
    if (ausd < AUSD_ENOUGH) {
      txs.push(await wallet.writeContract({ address: AUSD_FAUCET, abi: faucetAbi, functionName: "requestFunds", args: [to] }));
    }
    if (!txs.length) return json({ address: to, txs, message: "This wallet already has test funds" });
    await Promise.all(txs.map((hash) => publicClient.waitForTransactionReceipt({ hash })));
    return json({ address: to, txs, mon: mon < MON_DRIP / 2n ? formatEther(MON_DRIP) : "0" });
  } catch (e) {
    return fail(502, `Top-up failed: ${(e as Error).message.split("\n")[0]}`);
  } finally {
    inFlight.delete(id);
  }
}
