import { erc20Abi, type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName, type Hex, type PublicClient, type WalletClient } from 'viem';

export function account(wallet: WalletClient): Address {
  if (!wallet.account) throw new Error('wallet client has no account');
  return wallet.account.address;
}

/** Simulate, send and wait for one contract write; throws on revert. */
export async function send<
  const abi extends Abi,
  fn extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(
  wallet: WalletClient,
  client: PublicClient,
  call: { address: Address; abi: abi; functionName: fn; args: ContractFunctionArgs<abi, 'nonpayable' | 'payable', fn>; value?: bigint },
): Promise<Hex> {
  const { request } = await client.simulateContract({ ...(call as any), account: wallet.account });
  const hash = await wallet.writeContract(request as any);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`transaction reverted: ${hash}`);
  return hash;
}

export async function approveIfNeeded(
  wallet: WalletClient,
  client: PublicClient,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<Hex | null> {
  const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account(wallet), spender] });
  if (allowance >= amount) return null;
  return send(wallet, client, { address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] });
}
