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
const ADDRS = {
    ModuleRegistry: "0xF15d928954F9Ac529CF706027e5E1829B1aBed34",
    AgentRegistry: "0xF040bE18dfb1f0ac50c599fb187668a0B428481C",
    FeeManager: "0x2F6fB6bE3F176B2e424405C27E02fE0414237B83",
    TokenEscrow: "0x93838551F77f732831F435A3C395805Ce8609be6",
    Marketplace: "0x339f142deE647aD8518db6b7e2045B5F3d5aEeFc",
    Reputation: "0xf9a166CaF953F6D50af3a63BC0D02084C832a791"
};
const FEE_BPS = 250;
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
async function verifyContract(name, address, args) {
    try {
        await hardhat_1.default.run("verify:verify", { address, constructorArguments: args });
        console.log(`✅ Verified ${name}`);
    }
    catch (e) {
        if (e.message?.includes("Already Verified"))
            console.log(`✅ ${name} already verified`);
        else
            console.log(`⚠️ Verify failed for ${name}: ${e.message}`);
    }
}
async function main() {
    const [deployer] = await hardhat_2.ethers.getSigners();
    console.log("Resuming wiring & verification...");
    console.log("Deployer:", deployer.address);
    const registry = await hardhat_2.ethers.getContractAt("ModuleRegistry", ADDRS.ModuleRegistry);
    const reputation = await hardhat_2.ethers.getContractAt("Reputation", ADDRS.Reputation);
    const KEYS = {
        AGENT: await registry.AGENT_REGISTRY(),
        ESCROW: await registry.TOKEN_ESCROW(),
        REPUTATION: await registry.REPUTATION(),
        FEE: hardhat_2.ethers.id("FEE_MANAGER"),
        TREASURY: hardhat_2.ethers.id("TREASURY")
    };
    // Helper to retry tx
    const setModule = async (key, addr, label) => {
        try {
            const current = await registry.modules(key);
            if (current === addr) {
                console.log(`  ${label} already set.`);
                return;
            }
            console.log(`  Setting ${label}...`);
            const tx = await registry.setModule(key, addr);
            await tx.wait();
            console.log(`  ✅ ${label} set.`);
        }
        catch (e) {
            console.error(`  ❌ Failed to set ${label}:`, e);
        }
    };
    await setModule(KEYS.AGENT, ADDRS.AgentRegistry, "AgentRegistry");
    await setModule(KEYS.ESCROW, ADDRS.TokenEscrow, "TokenEscrow");
    await setModule(KEYS.FEE, ADDRS.FeeManager, "FeeManager");
    await setModule(KEYS.TREASURY, deployer.address, "Treasury"); // Default to deployer
    await setModule(KEYS.REPUTATION, ADDRS.Reputation, "Reputation");
    console.log("  Setting Reputation updater...");
    try {
        const tx = await reputation.setUpdater(ADDRS.TokenEscrow);
        await tx.wait();
        console.log("  ✅ Reputation updater set.");
    }
    catch (e) {
        console.log("  ⚠️ Failed/Already set updater.");
    }
    console.log("\nVerifying...");
    await verifyContract("ModuleRegistry", ADDRS.ModuleRegistry, []);
    await verifyContract("AgentRegistry", ADDRS.AgentRegistry, []);
    await verifyContract("FeeManager", ADDRS.FeeManager, [FEE_BPS, deployer.address]);
    await verifyContract("TokenEscrow", ADDRS.TokenEscrow, [USDC_ADDRESS, ADDRS.ModuleRegistry]);
    await verifyContract("Marketplace", ADDRS.Marketplace, [ADDRS.ModuleRegistry]);
    await verifyContract("Reputation", ADDRS.Reputation, []);
    const outPath = path.join(process.cwd(), "deployed_addresses.json");
    fs.writeFileSync(outPath, JSON.stringify({ ...ADDRS, network: "sepolia", chainId: 11155111 }, null, 2));
    console.log(`\n🎉 Done! Saved to ${outPath}`);
}
main().catch(console.error);
