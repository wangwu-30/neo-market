
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Hardcoded for independence
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const MARKET_ADDR = "0x339f142deE647aD8518db6b7e2045B5F3d5aEeFc";
const REGISTRY_ADDR = "0xF040bE18dfb1f0ac50c599fb187668a0B428481C";

const MARKET_ABI = [
  "function jobCount() view returns (uint256)",
  "function getJob(uint256) view returns (tuple(uint256 jobId, address buyer, string jobSpecCID, uint8 sku, uint256 budget, address paymentToken, uint64 deadline, uint8 status))"
];

async function main() {
  console.log("🔄 Syncing data from Sepolia...");
  const provider = new ethers.JsonRpcProvider(RPC);
  const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

  // 1. Fetch Jobs
  const count = await market.jobCount();
  console.log(`  Found ${count} jobs.`);
  
  const jobs = [];
  for (let i = 1; i <= Number(count); i++) {
    try {
      const job = await market.getJob(i);
      
      // Try fetch IPFS title if possible, else raw
      let title = "Job #" + i;
      let description = "";
      
      if (job.jobSpecCID.startsWith("ipfs://")) {
         // In a real indexer, we would fetch IPFS here. 
         // For now, let's keep it light or use a timeout.
         // We'll skip fetch for this sync script to keep it fast, frontend can fetch or we improve this later.
         // Or better: fetch it here so frontend is fast!
         try {
             const cid = job.jobSpecCID.replace("ipfs://", "");
             const res = await fetch(`https://ipfs.io/ipfs/${cid}`, { signal: AbortSignal.timeout(3000) });
             if (res.ok) {
                 const json = await res.json();
                 if (json.title) title = json.title;
                 if (json.description) description = json.description;
             }
         } catch(e) {}
      }

      jobs.push({
        id: job.jobId.toString(),
        buyer: job.buyer,
        spec: job.jobSpecCID,
        budget: job.budget.toString(),
        status: Number(job.status),
        title,
        description
      });
    } catch (e) {
      console.error(`  Failed to fetch job ${i}`, e);
    }
  }

  // 2. Fetch Agents (Mock for now, or scan logs if we add log scanning)
  // To keep this script simple and robust without log scanning overhead every time:
  // We'll just hardcode the known agents or use a cached list.
  // For V0.5, let's just output the current state.
  const agents = [
      { address: "0xfc33a39d546CB88e82beBF0b246E4C458E562A56", cid: "ipfs://QmDemoAgent" }
  ];

  const data = {
    updatedAt: new Date().toISOString(),
    stats: {
      totalJobs: Number(count),
      activeAgents: agents.length
    },
    jobs: jobs.reverse(), // Newest first
    agents
  };

  const outDir = path.join(__dirname, "../web/public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  fs.writeFileSync(path.join(outDir, "data.json"), JSON.stringify(data, null, 2));
  console.log(`✅ Synced to ${outDir}/data.json`);
}

main().catch(console.error);
