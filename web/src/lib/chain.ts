import { monadTestnet } from "viem/chains";
import { createPublicClient, http } from "viem";

export const chain = monadTestnet;
export const publicClient = createPublicClient({ chain, transport: http() });
export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;
