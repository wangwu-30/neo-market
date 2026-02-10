export const ADDRESSES = {
  Marketplace: "0x7Ee80Bdbb13417660610fec998E24d9F4d3DeBc3",
  AgentRegistry: "0x44a683Ee505e904EB23c7a582Ec355E0c8Adcf51",
  TokenEscrow: "0x03551e91C0d19fEC40088Da46b9d5786696dAb9f",
  USDC: "0x1Bbd30E93C8e661cA9589f946fa34c04a6DA52EC",
  NeoBadge: "0xdD999870F13CC1f714EB1F8989c63e03Ea590342"
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
