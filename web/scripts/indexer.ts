import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hardcoded for independence
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const MARKET_ADDR = "0x339f142deE647aD8518db6b7e2045B5F3d5aEeFc";

// Define ABI
const MARKET_ABI = parseAbi([
  "function jobCount() view returns (uint256)",
  "function getJob(uint256) view returns ((uint256 jobId, address buyer, string jobSpecCID, uint8 sku, uint256 budget, address paymentToken, uint64 deadline, uint8 status))",
  "function selectedBidOf(uint256) view returns (uint256)",
  "function getBid(uint256) view returns ((uint256 bidId, uint256 jobId, address agent, string bidCID, uint256 price, uint64 eta))",
  "function bidCount() view returns (uint256)"
]);

async function main() {
  console.log("🔄 Syncing data from Sepolia...");
  
  const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC)
  });

  // 1. Fetch Job Count
  const count = await client.readContract({
    address: MARKET_ADDR,
    abi: MARKET_ABI,
    functionName: 'jobCount'
  });
  
  console.log(`  Found ${count} jobs.`);
  
  const jobs: any[] = [];
  const agentStats: Record<string, { wins: number }> = {};
  
  // Initialize Stats for known agents (could fetch from Registry event logs in V2)
  const KNOWN_AGENTS = ["0xfc33a39d546CB88e82beBF0b246E4C458E562A56", "0xCe59bF37db13844D5Ae20E4AD79511020d082D6b"];
  KNOWN_AGENTS.forEach(a => agentStats[a.toLowerCase()] = { wins: 0 });

  for (let i = 1; i <= Number(count); i++) {
    try {
      const job = await client.readContract({
        address: MARKET_ADDR,
        abi: MARKET_ABI,
        functionName: 'getJob',
        args: [BigInt(i)]
      });
      
      // Calculate Agent Stats
      const status = Number(job.status);
      // Selected (2) or Completed (4)
      if (status === 2 || status === 4) {
          try {
              const bidId = await client.readContract({
                  address: MARKET_ADDR,
                  abi: MARKET_ABI,
                  functionName: 'selectedBidOf',
                  args: [BigInt(i)]
              });
              
              if (bidId > 0n) {
                  const bid = await client.readContract({
                      address: MARKET_ADDR,
                      abi: MARKET_ABI,
                      functionName: 'getBid',
                      args: [bidId]
                  });
                  
                  const agent = bid.agent.toLowerCase();
                  if (!agentStats[agent]) agentStats[agent] = { wins: 0 };
                  agentStats[agent].wins += 1;
                  
                  // Log completion
                  if (status === 4) {
                    console.log(`    ✅ Completed: ${bid.price}`);
                  } else {
                    console.log(`    🔒 Locked: ${bid.price} (Status ${status} != 4)`);
                  }

                  console.log(`  Job #${i} (Status ${status}) - Winner: ${agent} - Bid: ${bid.price}`);
              } else {
                  console.warn(`  Warning: Job #${i} has status ${status} but no selected bid.`);
              }
          } catch(e) {
              console.warn(`  Failed to fetch winning bid for job ${i}`, e);
          }
      }

      let title = `Job #${job.jobId}`;
      let description = "";
      
      // Try to fetch IPFS metadata if CID is present
      if (job.jobSpecCID && job.jobSpecCID.startsWith("ipfs://")) {
         // ... (keep existing IPFS fetch logic if needed, but for speed we might skip it or keep short timeout)
      } else if (job.jobSpecCID.length > 40) {
          // Assume it's a raw CID without prefix for the new job 3
          // Or just use it as title if we can't fetch
      }

      jobs.push({
        id: job.jobId.toString(),
        buyer: job.buyer,
        spec: job.jobSpecCID,
        budget: job.budget.toString(),
        status: status,
        title,
        description
      });
    } catch (e) {
      console.error(`  Failed to fetch job ${i}`, e);
    }
  }

  // 2. Format Agent Data
  const agents = Object.entries(agentStats).map(([addr, stat]) => ({
      address: addr,
      cid: "ipfs://QmAgentProfile", // Placeholder
      wins: stat.wins
  })).sort((a, b) => b.wins - a.wins);

  // Prepare output data
  const data = {
    updatedAt: new Date().toISOString(),
    stats: {
      totalJobs: Number(count),
      activeAgents: agents.length
    },
    jobs: jobs.reverse(), // Newest first
    agents
  };


  // Write to public/data.json
  // Script is in agent-market/web/scripts/, output is in agent-market/web/public/
  const outDir = path.join(__dirname, "../public");
  
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outFile = path.join(outDir, "data.json");
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✅ Synced to ${outFile}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
