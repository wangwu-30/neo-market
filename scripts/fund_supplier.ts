
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

async function main() {
  const pk = process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk!, provider);

  // 1. Send Gas to Supplier
  const supplier = "0xCe59bF37db13844D5Ae20E4AD79511020d082D6b";
  console.log(`💸 Sending 0.002 ETH to ${supplier}...`);
  const tx = await wallet.sendTransaction({
    to: supplier,
    value: ethers.parseEther("0.002")
  });
  console.log(`   Tx: ${tx.hash}`);
  await tx.wait();
  console.log("   ✅ Gas sent.");
}

main().catch(console.error);
