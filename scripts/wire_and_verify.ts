
import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

async function verifyContract(name: string, address: string, args: any[]) {
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ Verified ${name}`);
  } catch (e: any) {
    if (e.message?.includes("Already Verified")) console.log(`✅ ${name} already verified`);
    else console.log(`⚠️ Verify failed for ${name}: ${e.message}`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Resuming wiring & verification...");
  console.log("Deployer:", deployer.address);

  const registry = await ethers.getContractAt("ModuleRegistry", ADDRS.ModuleRegistry);
  const reputation = await ethers.getContractAt("Reputation", ADDRS.Reputation);

  const KEYS = {
    AGENT: await registry.AGENT_REGISTRY(),
    ESCROW: await registry.TOKEN_ESCROW(),
    REPUTATION: await registry.REPUTATION(),
    FEE: ethers.id("FEE_MANAGER"),
    TREASURY: ethers.id("TREASURY")
  };

  // Helper to retry tx
  const setModule = async (key: string, addr: string, label: string) => {
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
    } catch (e) {
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
  } catch (e) {
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
