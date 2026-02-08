"use strict";
/**
 * Production deployment script for agent-market on Base Sepolia / Base Mainnet.
 *
 * Required env:
 *   PRIVATE_KEY       - Deployer private key
 *   BASE_RPC_URL      - Base RPC endpoint
 *   ETHERSCAN_API_KEY - Basescan API key for verification
 *
 * Optional env:
 *   TREASURY_ADDRESS  - Fee treasury (default: deployer)
 *   USDC_ADDRESS      - USDC token on chain (required for TokenEscrow)
 *
 * Usage:
 *   npx hardhat run scripts/deploy_prod.ts --network baseSepolia
 *   npx hardhat run scripts/deploy_prod.ts --network base
 */
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
const FEE_BPS = 250; // 2.5%
function requireEnv(name) {
    const v = process.env[name];
    if (!v || v === "") {
        throw new Error(`Missing required env: ${name}`);
    }
    return v;
}
async function verifyContract(name, address, constructorArguments) {
    try {
        await hardhat_1.default.run("verify:verify", {
            address,
            constructorArguments,
        });
        console.log(`  Verified: ${name}`);
    }
    catch (e) {
        if (e.message?.includes("Already Verified")) {
            console.log(`  Already verified: ${name}`);
        }
        else {
            console.warn(`  Verify failed for ${name}:`, e.message ?? e);
        }
    }
}
async function main() {
    requireEnv("PRIVATE_KEY");
    requireEnv("BASE_RPC_URL");
    requireEnv("ETHERSCAN_API_KEY");
    const usdcAddress = process.env.USDC_ADDRESS;
    if (!usdcAddress || usdcAddress === "") {
        throw new Error("Missing USDC_ADDRESS. Set to the USDC contract address on this chain (e.g. Base Sepolia test token or Base Mainnet 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)");
    }
    const [deployer] = await hardhat_2.ethers.getSigners();
    const treasuryAddress = process.env.TREASURY_ADDRESS ?? deployer.address;
    const network = await hardhat_2.ethers.provider.getNetwork();
    console.log("Network:", network.name, "chainId:", network.chainId.toString());
    console.log("Deployer:", deployer.address);
    console.log("Treasury:", treasuryAddress);
    console.log("USDC:", usdcAddress);
    console.log("");
    // 1. ModuleRegistry
    console.log("Deploying ModuleRegistry...");
    const ModuleRegistry = await hardhat_2.ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("  ModuleRegistry:", registryAddress);
    // 2. AgentRegistry
    console.log("Deploying AgentRegistry...");
    const AgentRegistry = await hardhat_2.ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();
    await agentRegistry.waitForDeployment();
    const agentRegistryAddress = await agentRegistry.getAddress();
    console.log("  AgentRegistry:", agentRegistryAddress);
    // 3. FeeManager (2.5%)
    console.log("Deploying FeeManager (2.5%)...");
    const FeeManager = await hardhat_2.ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(FEE_BPS, treasuryAddress);
    await feeManager.waitForDeployment();
    const feeManagerAddress = await feeManager.getAddress();
    console.log("  FeeManager:", feeManagerAddress);
    // 4. TokenEscrow
    console.log("Deploying TokenEscrow...");
    const TokenEscrow = await hardhat_2.ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdcAddress, registryAddress);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("  TokenEscrow:", escrowAddress);
    // 5. Marketplace
    console.log("Deploying Marketplace...");
    const Marketplace = await hardhat_2.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(registryAddress);
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("  Marketplace:", marketplaceAddress);
    // 6. Reputation
    console.log("Deploying Reputation...");
    const Reputation = await hardhat_2.ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy();
    await reputation.waitForDeployment();
    const reputationAddress = await reputation.getAddress();
    console.log("  Reputation:", reputationAddress);
    // Wire ModuleRegistry
    const AGENT_REGISTRY = await registry.AGENT_REGISTRY();
    const TOKEN_ESCROW = await registry.TOKEN_ESCROW();
    const REPUTATION = await registry.REPUTATION();
    const FEE_MANAGER = hardhat_2.ethers.id("FEE_MANAGER");
    const TREASURY = hardhat_2.ethers.id("TREASURY");
    console.log("\nWiring ModuleRegistry...");
    await registry.setModule(AGENT_REGISTRY, agentRegistryAddress);
    await registry.setModule(TOKEN_ESCROW, escrowAddress);
    await registry.setModule(FEE_MANAGER, feeManagerAddress);
    await registry.setModule(TREASURY, treasuryAddress);
    await registry.setModule(REPUTATION, reputationAddress);
    await reputation.setUpdater(escrowAddress);
    console.log("  Done.");
    // Verify on Etherscan
    console.log("\nVerifying contracts on Etherscan...");
    await verifyContract("ModuleRegistry", registryAddress, []);
    await verifyContract("AgentRegistry", agentRegistryAddress, []);
    await verifyContract("FeeManager", feeManagerAddress, [
        FEE_BPS,
        treasuryAddress,
    ]);
    await verifyContract("TokenEscrow", escrowAddress, [
        usdcAddress,
        registryAddress,
    ]);
    await verifyContract("Marketplace", marketplaceAddress, [registryAddress]);
    await verifyContract("Reputation", reputationAddress, []);
    const out = {
        network: network.name,
        chainId: Number(network.chainId),
        deployer: deployer.address,
        treasury: treasuryAddress,
        usdc: usdcAddress,
        ModuleRegistry: registryAddress,
        AgentRegistry: agentRegistryAddress,
        FeeManager: feeManagerAddress,
        TokenEscrow: escrowAddress,
        Marketplace: marketplaceAddress,
        Reputation: reputationAddress,
    };
    const outPath = path.join(process.cwd(), "deployed_addresses.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
    console.log("\nSaved addresses to", outPath);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
