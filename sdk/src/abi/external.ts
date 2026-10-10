export const kuruOrderBookAbi = [
  { type: 'function', name: 'getL2Book', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes' }] },
  {
    type: 'function',
    name: 'addSellOrder',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_price', type: 'uint32' },
      { name: 'size', type: 'uint96' },
      { name: '_postOnly', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'placeAndExecuteMarketBuy',
    stateMutability: 'payable',
    inputs: [
      { name: '_quoteSize', type: 'uint96' },
      { name: '_minAmountOut', type: 'uint256' },
      { name: '_isMargin', type: 'bool' },
      { name: '_isFillOrKill', type: 'bool' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  // event layouts as emitted by the deployed OrderBook: nothing indexed, Trade price at 1e18
  {
    type: 'event',
    name: 'Trade',
    inputs: [
      { name: 'orderId', type: 'uint40', indexed: false },
      { name: 'makerAddress', type: 'address', indexed: false },
      { name: 'isBuy', type: 'bool', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'updatedSize', type: 'uint96', indexed: false },
      { name: 'takerAddress', type: 'address', indexed: false },
      { name: 'txOrigin', type: 'address', indexed: false },
      { name: 'filledSize', type: 'uint96', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrderCreated',
    inputs: [
      { name: 'orderId', type: 'uint40', indexed: false },
      { name: 'owner', type: 'address', indexed: false },
      { name: 'size', type: 'uint96', indexed: false },
      { name: 'price', type: 'uint32', indexed: false },
      { name: 'isBuy', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrdersCanceled',
    inputs: [
      { name: 'orderId', type: 'uint40[]', indexed: false },
      { name: 'owner', type: 'address', indexed: false },
    ],
  },
] as const;

export const kuruMarginAccountAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_token', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getBalance',
    stateMutability: 'view',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_token', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const kuruRouterAbi = [
  {
    type: 'function',
    name: 'deployProxy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_type', type: 'uint8' },
      { name: '_baseAssetAddress', type: 'address' },
      { name: '_quoteAssetAddress', type: 'address' },
      { name: '_sizePrecision', type: 'uint96' },
      { name: '_pricePrecision', type: 'uint32' },
      { name: '_tickSize', type: 'uint32' },
      { name: '_minSize', type: 'uint96' },
      { name: '_maxSize', type: 'uint96' },
      { name: '_takerFeeBps', type: 'uint256' },
      { name: '_makerFeeBps', type: 'uint256' },
      { name: '_kuruAmmSpread', type: 'uint96' },
    ],
    outputs: [{ name: 'proxy', type: 'address' }],
  },
  {
    type: 'event',
    name: 'MarketRegistered',
    inputs: [
      { name: 'baseAsset', type: 'address', indexed: false },
      { name: 'quoteAsset', type: 'address', indexed: false },
      { name: 'market', type: 'address', indexed: false },
      { name: 'vaultAddress', type: 'address', indexed: false },
      { name: 'pricePrecision', type: 'uint32', indexed: false },
      { name: 'sizePrecision', type: 'uint96', indexed: false },
      { name: 'tickSize', type: 'uint32', indexed: false },
      { name: 'minSize', type: 'uint96', indexed: false },
      { name: 'maxSize', type: 'uint96', indexed: false },
      { name: 'takerFeeBps', type: 'uint256', indexed: false },
      { name: 'makerFeeBps', type: 'uint256', indexed: false },
      { name: 'kuruAmmSpread', type: 'uint96', indexed: false },
    ],
  },
] as const;

export const pythAbi = [
  {
    type: 'function',
    name: 'getUpdateFee',
    stateMutability: 'view',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [{ name: 'feeAmount', type: 'uint256' }],
  },
] as const;
