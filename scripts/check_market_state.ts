import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const market = await ethers.getContractAt("Marketplace", ADDRS.Marketplace);
  const count = await market.jobCount();
  console.log("Contract Address:", ADDRS.Marketplace);
  console.log("Job Count:", count.toString());
  
  if (count > 0n) {
      const job = await market.getJob(count);
      console.log("Latest Job Buyer:", job.buyer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
