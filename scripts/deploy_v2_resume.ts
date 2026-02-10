/**
 * V2 Production deployment script for agent-market.
 * Pivoted to Infrastructure & Dual-Badge Honor system.
 */

import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const FLAT_FEE = ethers.parseUnits("2.0", 6); // 2 USDC Flat Fee

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

async function main() {
  requireEnv("PRIVATE_KEY");
  requireEnv("BASE_RPC_URL");

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress || usdcAddress === "") {
    throw new Error("Missing USDC_ADDRESS. Required for TokenEscrow.");
  }

  const [deployer] = await ethers.getSigners();
  const treasuryAddress = process.env.TREASURY_ADDRESS ?? deployer.address;

  const network = await ethers.provider.getNetwork();
  console.log("🚀 Resuming V2 Alpha deployment to Network:", network.name);
  console.log("Deployer:", deployer.address);
  
  // Hardcoded addresses from partial deployment to avoid redeploying everything
  const registryAddress = "0xb8c7BF1B41A15D6DB05DcE1EAe72FE472Bb3f3FA";
  const agentRegistryAddress = "0x1c3064933f13B38786654fec6BEF4D0830812Fb1";
  const feeManagerAddress = "0xfB577045D919b4eABCF4A7fa4A0285C9E8a7ae7c";
  const neoBadgeAddress = "0xFf910c2d09bF46a80243100A9E42d4cD7D9ce902";
  const escrowAddress = "0x154779F8eE4cd34a29e010006310FB36dDd7DFCd";
  const marketplaceAddress = "0x78Fb14780eE1862d7BAd2Fd4b42007B3624e444a";
  const reputationAddress = "0x356392b4Db4226112b89113a10a9e688619FC4A8";

  const registry = await ethers.getContractAt("ModuleRegistry", registryAddress);
  const neoBadge = await ethers.getContractAt("NeoBadge", neoBadgeAddress);
  const reputation = await ethers.getContractAt("Reputation", reputationAddress);

  // Wiring
  console.log("\nWiring ModuleRegistry...");
  const FEE_MANAGER = ethers.id("FEE_MANAGER");
  const TREASURY = ethers.id("TREASURY");
  const REPUTATION = ethers.id("REPUTATION");
  const AGENT_REGISTRY = ethers.id("AGENT_REGISTRY");
  const TOKEN_ESCROW = ethers.id("TOKEN_ESCROW");
  const NEO_BADGE = ethers.id("NEO_BADGE");

  // Only run wiring for parts that might have failed
  console.log("Updating modules...");
  await (await registry.setModule(AGENT_REGISTRY, agentRegistryAddress)).wait();
  await (await registry.setModule(TOKEN_ESCROW, escrowAddress)).wait();
  await (await registry.setModule(FEE_MANAGER, feeManagerAddress)).wait();
  await (await registry.setModule(TREASURY, treasuryAddress)).wait();
  await (await registry.setModule(REPUTATION, reputationAddress)).wait();
  await (await registry.setModule(NEO_BADGE, neoBadgeAddress)).wait();
  
  // NeoBadge ownership to Escrow
  console.log("Setting NeoBadge owner to TokenEscrow...");
  const currentBadgeOwner = await neoBadge.owner();
  if (currentBadgeOwner.toLowerCase() !== escrowAddress.toLowerCase()) {
    await (await neoBadge.transferOwnership(escrowAddress)).wait();
  }

  // Reputation updater to Escrow
  console.log("Setting Reputation updater to TokenEscrow...");
  await (await reputation.setUpdater(escrowAddress)).wait();

  console.log("✅ Wiring Done.");

  const out = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    treasury: treasuryAddress,
    usdc: usdcAddress,
    ModuleRegistry: registryAddress,
    AgentRegistry: agentRegistryAddress,
    FeeManager: feeManagerAddress,
    NeoBadge: neoBadgeAddress,
    TokenEscrow: escrowAddress,
    Marketplace: marketplaceAddress,
    Reputation: reputationAddress,
  };

  const outPath = path.join(process.cwd(), "deployed_addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log("\n🎉 V2 Alpha deployed successfully! Addresses saved to", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
