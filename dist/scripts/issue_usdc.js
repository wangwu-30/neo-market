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
    console.log("Issuer:", deployer.address);
    // 1. Deploy Mock USDC
    console.log("\n1. Deploying Test USDC...");
    const USDC = await hardhat_1.ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddr = await usdc.getAddress();
    console.log("   ✅ Test USDC:", usdcAddr);
    // 2. Mint 1,000,000 USDC to deployer
    console.log("   Minting 1M USDC to deployer...");
    await usdc.mint(deployer.address, hardhat_1.ethers.parseUnits("1000000", 6));
    console.log("   ✅ Minted.");
    // 3. Load existing addresses
    const addrPath = path.join(process.cwd(), "deployed_addresses.json");
    const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
    const registryAddr = addrs.ModuleRegistry;
    // 4. Redeploy TokenEscrow with new USDC
    console.log("\n2. Redeploying TokenEscrow (linked to Test USDC)...");
    const TokenEscrow = await hardhat_1.ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdcAddr, registryAddr);
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();
    console.log("   ✅ New TokenEscrow:", escrowAddr);
    // 5. Update Registry
    console.log("\n3. Updating ModuleRegistry...");
    const registry = await hardhat_1.ethers.getContractAt("ModuleRegistry", registryAddr);
    const TOKEN_ESCROW_KEY = await registry.TOKEN_ESCROW();
    const tx = await registry.setModule(TOKEN_ESCROW_KEY, escrowAddr);
    await tx.wait();
    console.log("   ✅ Registry updated.");
    // 6. Update Reputation Updater
    console.log("\n4. Updating Reputation...");
    const reputation = await hardhat_1.ethers.getContractAt("Reputation", addrs.Reputation);
    const tx2 = await reputation.setUpdater(escrowAddr);
    await tx2.wait();
    console.log("   ✅ Reputation updater set.");
    // 7. Verify new contracts
    console.log("\n5. Verifying...");
    try {
        await hardhat_2.default.run("verify:verify", { address: usdcAddr, constructorArguments: [] });
    }
    catch (e) { }
    try {
        await hardhat_2.default.run("verify:verify", { address: escrowAddr, constructorArguments: [usdcAddr, registryAddr] });
    }
    catch (e) { }
    // 8. Update address file
    addrs.usdc = usdcAddr;
    addrs.TokenEscrow = escrowAddr;
    fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2));
    console.log("\n🎉 System upgraded with Test USDC!");
}
main().catch(console.error);
