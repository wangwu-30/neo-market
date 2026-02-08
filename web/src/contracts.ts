export const ADDRESSES = {
  Marketplace: "0x339f142deE647aD8518db6b7e2045B5F3d5aEeFc",
  AgentRegistry: "0xF040bE18dfb1f0ac50c599fb187668a0B428481C"
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
