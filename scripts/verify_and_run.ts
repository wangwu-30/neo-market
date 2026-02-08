import hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const FEE_BPS = 250;
// Use the USDC address from .env or fallback to the one found in the project context
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addressesPath = path.join(process.cwd(), "deployed_addresses.json");
  
  if (!fs.existsSync(addressesPath)) {
      console.error("deployed_addresses.json not found!");
      process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
  
  // Verify logic
  const verify = async (name: string, address: string, args: any[]) => {
    // console.log(`Verifying ${name} at ${address}...`);
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: args,
        });
    } catch (e: any) {
        // Suppress "already verified"
        if (!e.message.toLowerCase().includes("already verified")) {
             // Only print real errors if needed, or keep silent as requested
             // console.error(`Verification failed for ${name}:`, e.message);
        }
    }
  };

  // 1. VERIFY
  // FeeManager args: [250, deployerAddress]
  await verify("FeeManager", addresses.FeeManager, [FEE_BPS, deployer.address]);
  
  // TokenEscrow args: [USDC_ADDRESS, RegistryAddress] (RegistryAddress = ModuleRegistry)
  await verify("TokenEscrow", addresses.TokenEscrow, [USDC_ADDRESS, addresses.ModuleRegistry]);
  
  // Marketplace args: [RegistryAddress] (RegistryAddress = ModuleRegistry)
  await verify("Marketplace", addresses.Marketplace, [addresses.ModuleRegistry]);
  
  // AgentRegistry args: []
  await verify("AgentRegistry", addresses.AgentRegistry, []);
  
  // Reputation args: []
  await verify("Reputation", addresses.Reputation, []);

  // 2. REGISTER
  const AgentRegistry = await ethers.getContractAt("AgentRegistry", addresses.AgentRegistry);
  const metadata = "ipfs://QmDemoAgent";
  
  // Check if already registered
  const existing = await AgentRegistry.getAgent(deployer.address);
  if (existing.status === 0n) { // AgentStatus.None = 0
      // console.log("Registering agent...");
      const tx = await AgentRegistry.register(metadata);
      await tx.wait();
  }

  // 3. MINT / USDC
  // Try to interact with USDC if possible
  let usdcMessage = "Ready for business but need USDC";
  try {
      const USDC = await ethers.getContractAt("IERC20Minimal", USDC_ADDRESS); // Use minimal interface
      const balance = await USDC.balanceOf(deployer.address);
      if (balance > 0n) {
          usdcMessage = `Ready for business (USDC Balance: ${ethers.formatUnits(balance, 6)})`;
      } else {
          // Try to mint
          try {
              // Speculative mint call for testnet tokens
              const tx = await USDC.mint(deployer.address, ethers.parseUnits("1000", 6));
              await tx.wait();
              usdcMessage = "Ready for business (Minted 1000 USDC)";
          } catch (e) {
              // Mint failed, likely not supported or authorized
          }
      }
  } catch (e) {
      // Interface might not match or address invalid
  }

  // 4. REPORT
  console.log("FINAL SUMMARY:");
  console.log(`- AgentRegistry: https://sepolia.etherscan.io/address/${addresses.AgentRegistry}#code`);
  console.log(`- FeeManager: https://sepolia.etherscan.io/address/${addresses.FeeManager}#code`);
  console.log(`- TokenEscrow: https://sepolia.etherscan.io/address/${addresses.TokenEscrow}#code`);
  console.log(`- Marketplace: https://sepolia.etherscan.io/address/${addresses.Marketplace}#code`);
  console.log(`- Reputation: https://sepolia.etherscan.io/address/${addresses.Reputation}#code`);
  console.log(`- Agent ID: ${deployer.address}`);
  console.log(`- Status: ${usdcMessage}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
