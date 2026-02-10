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
  console.log("🚀 Deploying V2 Alpha to Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasuryAddress);
  console.log("USDC:", usdcAddress);
  console.log("");

  // 1. ModuleRegistry
  console.log("Deploying ModuleRegistry...");
  const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
  const registry = await ModuleRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  ModuleRegistry:", registryAddress);

  // 2. AgentRegistry
  console.log("Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("  AgentRegistry:", agentRegistryAddress);

  // 3. FeeManager (Flat Fee)
  console.log("Deploying FeeManager (V2 Flat Fee)...");
  const FeeManager = await ethers.getContractFactory("FeeManager");
  const feeManager = await FeeManager.deploy(FLAT_FEE, treasuryAddress);
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("  FeeManager:", feeManagerAddress);

  // 4. NeoBadge (SBT)
  console.log("Deploying NeoBadge (Soulbound Honor)...");
  const NeoBadge = await ethers.getContractFactory("NeoBadge");
  const neoBadge = await NeoBadge.deploy();
  await neoBadge.waitForDeployment();
  const neoBadgeAddress = await neoBadge.getAddress();
  console.log("  NeoBadge:", neoBadgeAddress);

  // 5. TokenEscrow (V2)
  console.log("Deploying TokenEscrow (V2)...");
  const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy(usdcAddress, registryAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("  TokenEscrow:", escrowAddress);

  // 6. Marketplace
  console.log("Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(registryAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("  Marketplace:", marketplaceAddress);

  // 7. Reputation
  console.log("Deploying Reputation...");
  const Reputation = await ethers.getContractFactory("Reputation");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("  Reputation:", reputationAddress);

  // Wiring
  console.log("\nWiring ModuleRegistry...");
  const FEE_MANAGER = ethers.id("FEE_MANAGER");
  const TREASURY = ethers.id("TREASURY");
  const ARBITRATION = ethers.id("ARBITRATION");
  const REPUTATION = ethers.id("REPUTATION");
  const AGENT_REGISTRY = ethers.id("AGENT_REGISTRY");
  const TOKEN_ESCROW = ethers.id("TOKEN_ESCROW");
  const NEO_BADGE = ethers.id("NEO_BADGE");

  await (await registry.setModule(AGENT_REGISTRY, agentRegistryAddress)).wait();
  await (await registry.setModule(TOKEN_ESCROW, escrowAddress)).wait();
  await (await registry.setModule(FEE_MANAGER, feeManagerAddress)).wait();
  await (await registry.setModule(TREASURY, treasuryAddress)).wait();
  await (await registry.setModule(REPUTATION, reputationAddress)).wait();
  await (await registry.setModule(NEO_BADGE, neoBadgeAddress)).wait();
  
  // NeoBadge ownership to Escrow
  console.log("Setting NeoBadge owner to TokenEscrow...");
  await (await neoBadge.transferOwnership(escrowAddress)).wait();

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
