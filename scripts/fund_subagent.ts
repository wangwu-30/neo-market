import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const subAgent = "0xCe59bF37db13844D5Ae20E4AD79511020d082D6b";
    console.log(`Sending 0.05 ETH from ${wallet.address} to ${subAgent}...`);

    const tx = await wallet.sendTransaction({
        to: subAgent,
        value: ethers.parseEther("0.05")
    });
    console.log(`Tx: ${tx.hash}`);
    await tx.wait();
    console.log("Sent!");
}

main().catch(console.error);
