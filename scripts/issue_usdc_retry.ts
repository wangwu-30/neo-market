
import { ethers } from "hardhat";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
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
  const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy(usdcAddr, addrs.ModuleRegistry, overrides);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("   ✅ New TokenEscrow:", escrowAddr);

  // 3. Update Registry
  console.log("3. Updating ModuleRegistry...");
  const registry = await ethers.getContractAt("ModuleRegistry", addrs.ModuleRegistry);
  const TOKEN_ESCROW_KEY = await registry.TOKEN_ESCROW();
  
  const tx = await registry.setModule(TOKEN_ESCROW_KEY, escrowAddr, overrides);
  await tx.wait();
  console.log("   ✅ Registry updated.");

  // 4. Update Reputation
  console.log("4. Updating Reputation...");
  const reputation = await ethers.getContractAt("Reputation", addrs.Reputation);
  const tx2 = await reputation.setUpdater(escrowAddr, overrides);
  await tx2.wait();
  console.log("   ✅ Reputation updater set.");

  // 5. Verify
  console.log("5. Verifying...");
  try {
    await hre.run("verify:verify", { address: usdcAddr, constructorArguments: [] });
  } catch (e) {}
  try {
    await hre.run("verify:verify", { address: escrowAddr, constructorArguments: [usdcAddr, addrs.ModuleRegistry] });
  } catch (e) {}

  addrs.TokenEscrow = escrowAddr;
  fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2));
  console.log("\n🎉 System fixed & upgraded!");
}

main().catch(console.error);
