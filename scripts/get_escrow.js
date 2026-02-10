const hre = require("hardhat");

async function main() {
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const addresses = require("../deployed_addresses.json");
  const marketplaceAddress = addresses.Marketplace;
  const marketplace = await Marketplace.attach(marketplaceAddress);

  const jobId = 2;
  const escrowId = await marketplace.escrowOf(jobId);
  console.log(`Escrow ID for Job ${jobId}: ${escrowId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
