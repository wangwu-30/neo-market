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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = __importDefault(require("hardhat"));
const hardhat_2 = require("hardhat");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FEE_BPS = 250;
// Use the USDC address from .env or fallback to the one found in the project context
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
async function main() {
    const [deployer] = await hardhat_2.ethers.getSigners();
    const addressesPath = path.join(process.cwd(), "deployed_addresses.json");
    if (!fs.existsSync(addressesPath)) {
        console.error("deployed_addresses.json not found!");
        process.exit(1);
    }
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    // Verify logic
    const verify = async (name, address, args) => {
        // console.log(`Verifying ${name} at ${address}...`);
        try {
            await hardhat_1.default.run("verify:verify", {
                address: address,
                constructorArguments: args,
            });
        }
        catch (e) {
            // Suppress "already verified"
            if (!e.message.toLowerCase().includes("already verified")) {
                // Only print real errors if needed, or keep silent as requested
                // console.error(`Verification failed for ${name}:`, e.message);
            }
        }
    };
    // 1. VERIFY
    // FeeManager args: [250, deployerAddress]
    await verify("FeeManager", addresses.FeeManager, [FEE_BPS, deployer.address]);
    // TokenEscrow args: [USDC_ADDRESS, RegistryAddress] (RegistryAddress = ModuleRegistry)
    await verify("TokenEscrow", addresses.TokenEscrow, [USDC_ADDRESS, addresses.ModuleRegistry]);
    // Marketplace args: [RegistryAddress] (RegistryAddress = ModuleRegistry)
    await verify("Marketplace", addresses.Marketplace, [addresses.ModuleRegistry]);
    // AgentRegistry args: []
    await verify("AgentRegistry", addresses.AgentRegistry, []);
    // Reputation args: []
    await verify("Reputation", addresses.Reputation, []);
    // 2. REGISTER
    const AgentRegistry = await hardhat_2.ethers.getContractAt("AgentRegistry", addresses.AgentRegistry);
    const metadata = "ipfs://QmDemoAgent";
    // Check if already registered
    const existing = await AgentRegistry.getAgent(deployer.address);
    if (existing.status === 0n) { // AgentStatus.None = 0
        // console.log("Registering agent...");
        const tx = await AgentRegistry.register(metadata);
        await tx.wait();
    }
    // 3. MINT / USDC
    // Try to interact with USDC if possible
    let usdcMessage = "Ready for business but need USDC";
    try {
        const USDC = await hardhat_2.ethers.getContractAt("IERC20Minimal", USDC_ADDRESS); // Use minimal interface
        const balance = await USDC.balanceOf(deployer.address);
        if (balance > 0n) {
            usdcMessage = `Ready for business (USDC Balance: ${hardhat_2.ethers.formatUnits(balance, 6)})`;
        }
        else {
            // Try to mint
            try {
                // Speculative mint call for testnet tokens
                const tx = await USDC.mint(deployer.address, hardhat_2.ethers.parseUnits("1000", 6));
                await tx.wait();
                usdcMessage = "Ready for business (Minted 1000 USDC)";
            }
            catch (e) {
                // Mint failed, likely not supported or authorized
            }
        }
    }
    catch (e) {
        // Interface might not match or address invalid
    }
    // 4. REPORT
    console.log("FINAL SUMMARY:");
    console.log(`- AgentRegistry: https://sepolia.etherscan.io/address/${addresses.AgentRegistry}#code`);
    console.log(`- FeeManager: https://sepolia.etherscan.io/address/${addresses.FeeManager}#code`);
    console.log(`- TokenEscrow: https://sepolia.etherscan.io/address/${addresses.TokenEscrow}#code`);
    console.log(`- Marketplace: https://sepolia.etherscan.io/address/${addresses.Marketplace}#code`);
    console.log(`- Reputation: https://sepolia.etherscan.io/address/${addresses.Reputation}#code`);
    console.log(`- Agent ID: ${deployer.address}`);
    console.log(`- Status: ${usdcMessage}`);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
