
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("🤖 Agent Daemon Started (PID: " + process.pid + ")");

const POLL_INTERVAL = 30000; // 30s
const TARGET_KEYWORD = "Encrypted";
const AGENT_KEY = "0xb816a833e235810e08e1f8a598ae572bf50a0778b89f800e92c4367458e168c0"; // Demo Key

function runCLI(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Call dist/cli.js directly to simulate installed environment
    const cliPath = path.join(__dirname, "../dist/cli.js");
    const child = spawn('node', [cliPath, ...args, '--key', AGENT_KEY]);
    
    let out = '';
    child.stdout.on('data', d => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on('data', d => process.stderr.write(d));
    
    child.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`CLI failed with code ${code}`));
    });
  });
}

let lastProcessedJobId = 0;

async function loop() {
  try {
    console.log(`\n🔍 Scanning for jobs containing '${TARGET_KEYWORD}'...`);
    const output = await runCLI(['jobs', '--limit', '5']);
    
    // Parse output to find new jobs
    // Example: "🆔 Job #3 ... Title: Test Encrypted ..."
    const lines = output.split('\n');
    let currentJobId = 0;
    
    for (let i=0; i<lines.length; i++) {
        const line = lines[i];
        if (line.includes("🆔 Job #")) {
            currentJobId = parseInt(line.split("#")[1]);
        }
        if (currentJobId > lastProcessedJobId && line.includes("Title:") && line.includes(TARGET_KEYWORD)) {
            console.log(`⚡️ FOUND TARGET JOB #${currentJobId}!`);
            
            if (line.includes("Status: Open")) {
                console.log("⚡️ AUTO-BIDDING...");
                await runCLI(['bid', '--job', currentJobId.toString(), '--price', '100', '--eta', '600', '--cid', 'QmAutoBid']);
                lastProcessedJobId = currentJobId;
            }
        }
        
        // Also check if we are selected
        if (line.includes("Status: Selected") && line.includes("Escrow ID:")) {
             // In a real daemon, we'd check if WE are the selected agent.
             // For demo, we assume if it's selected, it's us (since we are the only active bidder).
             const escrowId = line.split("Escrow ID: ")[1].trim();
             console.log(`⚡️ JOB #${currentJobId} SELECTED! DELIVERING...`);
             
             // Create dummy file
             fs.writeFileSync("secret_code.js", "console.log('Top Secret Algorithm');");
             
             await runCLI(['deliver', '--job', currentJobId.toString(), '--escrow', escrowId, '--file', 'secret_code.js', '--encrypt']);
             
             console.log("✅ JOB DONE.");
             process.exit(0); // Demo complete
        }
    }

  } catch (e) {
    console.error("Loop error:", e);
  }
  
  setTimeout(loop, POLL_INTERVAL);
}

// Start
loop();
