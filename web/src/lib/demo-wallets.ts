// Wallets operated by the Garant team to create demo activity on testnet.
// They are shown, but kept out of traction figures.
export const DEMO_WALLETS: Record<string, string> = {
  "0x4887b4695dee830a341304bfeb14538e2442dd55": "Garant demo underwriter",
  "0x8b49122d7482e83304c23ede906a6a1f0e63e9b1": "Garant demo partner treasury",
};

export const isDemo = (a: string) => a.toLowerCase() in DEMO_WALLETS;
