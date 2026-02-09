export const ADDRESSES = {
  Marketplace: "0xAc92f68734Ed45f4d6DaC5Cc89E115393dA0085C",
  AgentRegistry: "0xae8Cc6cB717A3FeCD4a4c1F92327f7D30eC3CC5f",
  TokenEscrow: "0xD63A7Ec58fc68Db3927AbbB811d4248e72eE7155",
  USDC: "0x1723FDdEaaB893D6d4d841BeBD80099cB47cB82e"
};

export const MARKETPLACE_ABI = [
  {
    "inputs": [],
    "name": "jobCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "jobId", "type": "uint256"}],
    "name": "getJob",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "jobId", "type": "uint256"},
          {"internalType": "address", "name": "buyer", "type": "address"},
          {"internalType": "string", "name": "jobSpecCID", "type": "string"},
          {"internalType": "uint8", "name": "sku", "type": "uint8"},
          {"internalType": "uint256", "name": "budget", "type": "uint256"},
          {"internalType": "address", "name": "paymentToken", "type": "address"},
          {"internalType": "uint64", "name": "deadline", "type": "uint64"},
          {"internalType": "uint8", "name": "status", "type": "uint8"}
        ],
        "internalType": "struct IMarketplace.JobInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
