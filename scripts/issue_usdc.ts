
import { ethers } from "hardhat";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Issuer:", deployer.address);

  // 1. Deploy Mock USDC
  console.log("\n1. Deploying Test USDC...");
  const USDC = await ethers.getContractFactory("USDCMock");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("   ✅ Test USDC:", usdcAddr);

  // 2. Mint 1,000,000 USDC to deployer
  console.log("   Minting 1M USDC to deployer...");
  await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
  console.log("   ✅ Minted.");

  // 3. Load existing addresses
  const addrPath = path.join(process.cwd(), "deployed_addresses.json");
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
  const registryAddr = addrs.ModuleRegistry;

  // 4. Redeploy TokenEscrow with new USDC
  console.log("\n2. Redeploying TokenEscrow (linked to Test USDC)...");
  const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy(usdcAddr, registryAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("   ✅ New TokenEscrow:", escrowAddr);

  // 5. Update Registry
  console.log("\n3. Updating ModuleRegistry...");
  const registry = await ethers.getContractAt("ModuleRegistry", registryAddr);
  const TOKEN_ESCROW_KEY = await registry.TOKEN_ESCROW();
  
  const tx = await registry.setModule(TOKEN_ESCROW_KEY, escrowAddr);
  await tx.wait();
  console.log("   ✅ Registry updated.");

  // 6. Update Reputation Updater
  console.log("\n4. Updating Reputation...");
  const reputation = await ethers.getContractAt("Reputation", addrs.Reputation);
  const tx2 = await reputation.setUpdater(escrowAddr);
  await tx2.wait();
  console.log("   ✅ Reputation updater set.");

  // 7. Verify new contracts
  console.log("\n5. Verifying...");
  try {
    await hre.run("verify:verify", { address: usdcAddr, constructorArguments: [] });
  } catch (e) {}
  try {
    await hre.run("verify:verify", { address: escrowAddr, constructorArguments: [usdcAddr, registryAddr] });
  } catch (e) {}

  // 8. Update address file
  addrs.usdc = usdcAddr;
  addrs.TokenEscrow = escrowAddr;
  fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2));
  console.log("\n🎉 System upgraded with Test USDC!");
}

main().catch(console.error);
