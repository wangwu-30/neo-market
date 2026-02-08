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
const hardhat_1 = require("hardhat");
const hardhat_2 = __importDefault(require("hardhat"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    const [deployer] = await hardhat_1.ethers.getSigners();
    const addrPath = path.join(process.cwd(), "deployed_addresses.json");
    const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
    // Hardcode new USDC from previous step
    const usdcAddr = "0x1723FDdEaaB893D6d4d841BeBD80099cB47cB82e";
    addrs.usdc = usdcAddr; // Save it now
    console.log("Resuming from Escrow deployment...");
    // Manual Gas Boost (REMOVED)
    // const feeData = await ethers.provider.getFeeData();
    // const overrides = {
    //   maxFeePerGas: feeData.maxFeePerGas! * 2n,
    //   maxPriorityFeePerGas: feeData.maxPriorityFeePerGas! * 2n
    // };
    const overrides = {}; // Use default gas
    // 2. Redeploy TokenEscrow
    console.log("2. Redeploying TokenEscrow...");
    const TokenEscrow = await hardhat_1.ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdcAddr, addrs.ModuleRegistry, overrides);
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();
    console.log("   ✅ New TokenEscrow:", escrowAddr);
    // 3. Update Registry
    console.log("3. Updating ModuleRegistry...");
    const registry = await hardhat_1.ethers.getContractAt("ModuleRegistry", addrs.ModuleRegistry);
    const TOKEN_ESCROW_KEY = await registry.TOKEN_ESCROW();
    const tx = await registry.setModule(TOKEN_ESCROW_KEY, escrowAddr, overrides);
    await tx.wait();
    console.log("   ✅ Registry updated.");
    // 4. Update Reputation
    console.log("4. Updating Reputation...");
    const reputation = await hardhat_1.ethers.getContractAt("Reputation", addrs.Reputation);
    const tx2 = await reputation.setUpdater(escrowAddr, overrides);
    await tx2.wait();
    console.log("   ✅ Reputation updater set.");
    // 5. Verify
    console.log("5. Verifying...");
    try {
        await hardhat_2.default.run("verify:verify", { address: usdcAddr, constructorArguments: [] });
    }
    catch (e) { }
    try {
        await hardhat_2.default.run("verify:verify", { address: escrowAddr, constructorArguments: [usdcAddr, addrs.ModuleRegistry] });
    }
    catch (e) { }
    addrs.TokenEscrow = escrowAddr;
    fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2));
    console.log("\n🎉 System fixed & upgraded!");
}
main().catch(console.error);
