import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying USDCMock with account:", deployer.address);

  const USDCMock = await ethers.getContractFactory("USDCMock");
  const usdc = await USDCMock.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("USDCMock deployed to:", usdcAddress);

  const ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
  const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));
  ADDRS.usdc = usdcAddress;
  fs.writeFileSync(ADDR_PATH, JSON.stringify(ADDRS, null, 2));
  console.log("Updated deployed_addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
