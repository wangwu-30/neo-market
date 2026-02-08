"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const L1_RPC = "https://ethereum-sepolia-rpc.publicnode.com"; // Sepolia L1
const BRIDGE_ADDRESS = "0x3154Cf16ccdb4C6d922629664174b904d80F2C35"; // L1StandardBridgeProxy on Sepolia
async function bridge() {
    const pk = process.env.PRIVATE_KEY;
    if (!pk)
        throw new Error("Missing PRIVATE_KEY");
    const provider = new ethers_1.ethers.JsonRpcProvider(L1_RPC);
    const wallet = new ethers_1.ethers.Wallet(pk, provider);
    const balance = await provider.getBalance(wallet.address);
    console.log(`L1 Balance: ${ethers_1.ethers.formatEther(balance)} ETH`);
    if (balance < ethers_1.ethers.parseEther("0.05")) {
        console.log("❌ Balance too low for bridging");
        return;
    }
    // Deposit 0.08 ETH to Base Sepolia
    const amount = ethers_1.ethers.parseEther("0.08");
    // ABI for depositETHTo
    const abi = ["function depositETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable"];
    const contract = new ethers_1.ethers.Contract(BRIDGE_ADDRESS, abi, wallet);
    console.log(`Bridging 0.08 ETH to Base Sepolia...`);
    const tx = await contract.depositETHTo(wallet.address, // to self
    200000, // minGasLimit
    "0x", // extraData
    { value: amount });
    console.log(`Tx Sent: https://sepolia.etherscan.io/tx/${tx.hash}`);
    await tx.wait();
    console.log("✅ Bridging initiated! Wait ~2 mins for funds to arrive on Base Sepolia.");
}
bridge().catch(console.error);
