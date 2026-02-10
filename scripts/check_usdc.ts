import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("IERC20Minimal", ADDRS.usdc);
  
  const bal = await token.balanceOf(deployer.address);
  console.log(`USDC Balance of ${deployer.address}: ${ethers.formatUnits(bal, 6)} USDC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
