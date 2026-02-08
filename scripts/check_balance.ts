
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

async function check() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const address = "0xfc33a39d546CB88e82beBF0b246E4C458E562A56";
  const balance = await provider.getBalance(address);
  console.log(`Base Sepolia Balance: ${ethers.formatEther(balance)} ETH`);
}

check().catch(console.error);
