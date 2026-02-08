import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const ADDRS = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployed_addresses.json"), "utf-8"));
const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function main() {
    const marketAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Marketplace.sol/Marketplace.json"), "utf-8")).abi;
    const escrowAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/TokenEscrow.sol/TokenEscrow.json"), "utf-8")).abi;

    const market = new ethers.Contract(ADDRS.Marketplace, marketAbi, wallet);
    const escrow = new ethers.Contract(ADDRS.TokenEscrow, escrowAbi, wallet);

    const jobId = 3;
    const escrowId = await market.escrowOf(jobId);
    console.log(`Job ${jobId} -> Escrow ${escrowId}`);

    console.log("Releasing funds (Accept)...");
    const tx = await escrow.accept(escrowId);
    console.log(`Accept Tx: ${tx.hash}`);
    await tx.wait();

    console.log("Closing Job...");
    const tx2 = await market.closeJob(jobId);
    console.log(`Close Tx: ${tx2.hash}`);
    await tx2.wait();
    
    console.log("Done!");
}
main().catch(console.error);
