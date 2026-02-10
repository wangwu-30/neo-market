const hre = require("hardhat");

async function main() {
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  // We need to attach to the deployed address
  const addresses = require("../deployed_addresses.json");
  const marketplaceAddress = addresses.Marketplace;
  const marketplace = await Marketplace.attach(marketplaceAddress);

  const bidCount = await marketplace.bidCount();
  console.log(`Total bids: ${bidCount}`);

  for (let i = Number(bidCount); i >= 1; i--) {
    try {
      const bid = await marketplace.getBid(i);
      // console.log(`Checking bid ${i}: Job ${bid.jobId}`);
      if (bid.jobId.toString() === "2") {
        console.log(`Found Bid for Job 2:`);
        console.log(`ID: ${i}`);
        console.log(`Agent: ${bid.agent}`);
        console.log(`Price: ${bid.price}`);
        console.log(`CID: ${bid.bidCID}`);
        break; 
      }
    } catch (e) {
      console.log(`Error reading bid ${i}: ${e.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
