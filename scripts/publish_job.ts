
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [buyer] = await ethers.getSigners();
  const addrPath = path.join(process.cwd(), "deployed_addresses.json");
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));

  const market = await ethers.getContractAt("Marketplace", addrs.Marketplace);
  const usdc = await ethers.getContractAt("USDCMock", addrs.usdc);

  const budget = ethers.parseUnits("300", 6);
  
  // Approve
  console.log("Approving USDC...");
  await (await usdc.approve(addrs.TokenEscrow, budget)).wait();

  // Publish
  console.log("Publishing Job: 'Need Landing Page CSS fix'...");
  const deadline = Math.floor(Date.now() / 1000) + 3600 * 24;
  
  // Use a recognizable CID (fake but descriptive)
  const tx = await market.publishJob(
    "ipfs://QmJobSpec_CSS_Fix_Cyberpunk", 
    3, 
    budget, 
    addrs.usdc, 
    deadline
  );
  console.log(`✅ Job Published! Tx: ${tx.hash}`);
}

main().catch(console.error);
