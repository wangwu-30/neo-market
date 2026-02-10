import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const market = await ethers.getContractAt("Marketplace", ADDRS.Marketplace);
  
  const jobId = 1;
  const job = await market.getJob(jobId);
  console.log("Job #1 Buyer:", job.buyer);
  console.log("Current Signer:", deployer.address);
  console.log("Match:", job.buyer.toLowerCase() === deployer.address.toLowerCase());
  
  const bidId = 1;
  const bid = await market.getBid(bidId);
  console.log("Bid #1 Job ID:", bid.jobId.toString());
  
  console.log("Attempting selection via script...");
  const sow = ethers.ZeroHash;
  const tx = await market.selectBid(jobId, bidId, sow);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("🎉 Selected!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
