import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("USDCMock", ADDRS.usdc);
  
  const amount = ethers.parseUnits("10000", 6);
  console.log(`Minting 10000 USDC to ${deployer.address}...`);
  // Mock USDC has mint function
  try {
      const tx = await token.mint(deployer.address, amount);
      await tx.wait();
      console.log("✅ Minted.");
  } catch(e: any) {
      console.error("❌ Mint failed:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
