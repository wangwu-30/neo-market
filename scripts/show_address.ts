
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.log("❌ PRIVATE_KEY is missing in .env");
} else {
  try {
    const wallet = new ethers.Wallet(pk);
    console.log("\n✅ 你的钱包地址: " + wallet.address);
    console.log("👉 复制这个地址去领水: https://www.alchemy.com/faucets/base-sepolia\n");
  } catch (e) {
    console.log("❌ 私钥格式不对，请确保它是 64 个字符的 16 进制字符串（可以带或不带 0x）");
  }
}
