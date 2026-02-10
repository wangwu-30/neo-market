import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("USDCMock", ADDRS.usdc);
  
  const amount = ethers.parseUnits("1000", 6);
  console.log(`Approving ${ADDRS.TokenEscrow} to spend 1000 USDC...`);
  const tx = await token.approve(ADDRS.TokenEscrow, amount);
  await tx.wait();
  console.log("✅ Approved.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
