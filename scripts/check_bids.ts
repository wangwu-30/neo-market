import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const ADDRS = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployed_addresses.json"), "utf-8"));
const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(rpc);

async function main() {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Marketplace.sol/Marketplace.json"), "utf-8"));
    const market = new ethers.Contract(ADDRS.Marketplace, artifact.abi, provider);
    const count = await market.bidCount();
    console.log("Bid Count:", count.toString());
}
main();
