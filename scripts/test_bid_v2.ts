import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const market = await ethers.getContractAt("Marketplace", ADDRS.Marketplace);
  
  const jobId = 4;
  const bidCID = "ipfs://QmDemoProposalV2";
  const price = ethers.parseUnits("40", 6);
  const eta = 3600;
  const maxRevisions = 5;

  console.log(`Placing bid on Job #${jobId}...`);
  try {
    const tx = await market.placeBid(jobId, bidCID, price, eta, maxRevisions);
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("🎉 Bid placed successfully!");
  } catch (e: any) {
    console.error("❌ Bid failed:", e.message);
    if (e.data) {
        console.error("Error data:", e.data);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
