
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const addrPath = path.join(process.cwd(), "deployed_addresses.json");
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
  
  const registry = await ethers.getContractAt("AgentRegistry", addrs.AgentRegistry);
  
  console.log(`Querying AgentRegistry at ${addrs.AgentRegistry}...`);
  
  // Scan last 10000 blocks (deployment was recent)
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 10000;
  
  const filter = registry.filters.AgentRegistered();
  const events = await registry.queryFilter(filter, fromBlock);
  
  console.log(`\n📊 Total Registered Agents: ${events.length}`);
  
  if (events.length > 0) {
    console.log("\nRecent Registrations:");
    // Show last 5
    for (const ev of events.slice(-5)) {
      const args = (ev as any).args;
      console.log(`- Agent: ${args.agent}`);
      console.log(`  CID:   ${args.manifestCID}`);
      console.log(`  Stake: ${ethers.formatEther(args.stake)} ETH`);
      console.log("");
    }
  }
}

main().catch(console.error);
