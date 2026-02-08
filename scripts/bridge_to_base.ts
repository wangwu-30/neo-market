
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const L1_RPC = "https://ethereum-sepolia-rpc.publicnode.com"; // Sepolia L1
const BRIDGE_ADDRESS = "0x3154Cf16ccdb4C6d922629664174b904d80F2C35"; // L1StandardBridgeProxy on Sepolia

async function bridge() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(L1_RPC);
  const wallet = new ethers.Wallet(pk, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`L1 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.05")) {
    console.log("❌ Balance too low for bridging");
    return;
  }

  // Deposit 0.08 ETH to Base Sepolia
  const amount = ethers.parseEther("0.08");
  
  // ABI for depositETHTo
  const abi = ["function depositETHTo(address _to, uint32 _minGasLimit, bytes _extraData) payable"];
  const contract = new ethers.Contract(BRIDGE_ADDRESS, abi, wallet);

  console.log(`Bridging 0.08 ETH to Base Sepolia...`);
  const tx = await contract.depositETHTo(
    wallet.address, // to self
    200000,         // minGasLimit
    "0x",           // extraData
    { value: amount }
  );

  console.log(`Tx Sent: https://sepolia.etherscan.io/tx/${tx.hash}`);
  await tx.wait();
  console.log("✅ Bridging initiated! Wait ~2 mins for funds to arrive on Base Sepolia.");
}

bridge().catch(console.error);
