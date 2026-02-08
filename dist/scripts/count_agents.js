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
const hardhat_1 = require("hardhat");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    const addrPath = path.join(process.cwd(), "deployed_addresses.json");
    const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
    const registry = await hardhat_1.ethers.getContractAt("AgentRegistry", addrs.AgentRegistry);
    console.log(`Querying AgentRegistry at ${addrs.AgentRegistry}...`);
    // Scan last 10000 blocks (deployment was recent)
    const currentBlock = await hardhat_1.ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 10000;
    const filter = registry.filters.AgentRegistered();
    const events = await registry.queryFilter(filter, fromBlock);
    console.log(`\n📊 Total Registered Agents: ${events.length}`);
    if (events.length > 0) {
        console.log("\nRecent Registrations:");
        // Show last 5
        for (const ev of events.slice(-5)) {
            const args = ev.args;
            console.log(`- Agent: ${args.agent}`);
            console.log(`  CID:   ${args.manifestCID}`);
            console.log(`  Stake: ${hardhat_1.ethers.formatEther(args.stake)} ETH`);
            console.log("");
        }
    }
}
main().catch(console.error);
