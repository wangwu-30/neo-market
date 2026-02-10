import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log("Redeploying Marketplace with account:", deployer.address);

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(ADDRS.ModuleRegistry);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("Marketplace redeployed to:", marketplaceAddress);

  const registry = await ethers.getContractAt("ModuleRegistry", ADDRS.ModuleRegistry);
  const MARKETPLACE = ethers.id("MARKETPLACE"); // Wait, check ModuleKeys.sol
  
  // Re-checking module keys
  const marketplaceKey = ethers.keccak256(ethers.toUtf8Bytes("MARKETPLACE")); 
  // Actually, checking Marketplace.sol: bytes32 public constant TOKEN_ESCROW = ModuleKeys.TOKEN_ESCROW;
  // It doesn't define its own key for Registry.
  // Marketplace is usually called directly, but let's check registry.
  
  ADDRS.Marketplace = marketplaceAddress;
  fs.writeFileSync(ADDR_PATH, JSON.stringify(ADDRS, null, 2));
  console.log("Updated deployed_addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
