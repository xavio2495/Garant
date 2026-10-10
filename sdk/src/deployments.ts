import type { Address } from 'viem';

export type Deployments = {
  chainId: number;
  startBlock: number;
  ausd: Address;
  pyth: Address;
  outcomeSeries: Address;
  pythResolver: Address;
  creResolver: Address;
  creFxResolver: Address;
  creForwarder: Address;
  marketMode: 'kuru';
  kuruRouter: Address;
  kuruMarginAccount: Address;
};

let current: Deployments | undefined;

/** Load the contents of deployments/<chainId>.json once at startup. */
export function setDeployments(d: Deployments): void {
  current = d;
}

export function getDeployments(): Deployments {
  if (!current) throw new Error('@garant/sdk: call setDeployments() first');
  return current;
}
