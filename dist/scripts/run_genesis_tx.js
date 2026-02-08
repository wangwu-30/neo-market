"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    const [actor] = await hardhat_1.ethers.getSigners();
    const addrPath = path.join(process.cwd(), "deployed_addresses.json");
    const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
    console.log("🎬 STARTING GENESIS TRANSACTION");
    console.log("Actor:", actor.address);
    console.log("Market:", addrs.Marketplace);
    console.log("USDC:", addrs.usdc);
    const market = await hardhat_1.ethers.getContractAt("Marketplace", addrs.Marketplace);
    const usdc = await hardhat_1.ethers.getContractAt("USDCMock", addrs.usdc);
    const escrow = await hardhat_1.ethers.getContractAt("TokenEscrow", addrs.TokenEscrow);
    // 1. Approve USDC
    console.log("\n1️⃣ Approving USDC...");
    const budget = hardhat_1.ethers.parseUnits("500", 6);
    await (await usdc.approve(addrs.TokenEscrow, budget)).wait();
    console.log("   ✅ Approved.");
    // 2. Publish Job
    console.log("\n2️⃣ Publishing Job: 'Scrape Moltbook' (500 USDC)...");
    const deadline = Math.floor(Date.now() / 1000) + 3600 * 24; // 1 day
    const txPub = await market.publishJob("ipfs://QmJobSpecMoltbookScraper", 3, // SKU: CUSTOM
    budget, addrs.usdc, deadline);
    const rcPub = await txPub.wait();
    const jobId = 1n; // Assuming first job (or query logs)
    console.log(`   ✅ Job #${jobId} Published.`);
    console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${txPub.hash}`);
    // 3. Place Bid (Self-bid)
    console.log("\n3️⃣ Placing Bid: 450 USDC...");
    const price = hardhat_1.ethers.parseUnits("450", 6);
    const txBid = await market.placeBid(jobId, "ipfs://QmBidProposal", price, 3600);
    await txBid.wait();
    const bidId = 1n; // Assuming first bid
    console.log(`   ✅ Bid #${bidId} Placed.`);
    console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${txBid.hash}`);
    // 4. Select Bid
    console.log("\n4️⃣ Selecting Bid (Locking funds)...");
    const txSel = await market.selectBid(jobId, bidId);
    await txSel.wait();
    const escrowId = await market.escrowOf(jobId);
    console.log(`   ✅ Bid Selected. Escrow #${escrowId} created.`);
    console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${txSel.hash}`);
    // 5. Deliver
    console.log("\n5️⃣ Delivering Work...");
    const deliverCID = "ipfs://QmDeliveryCode";
    const deliverHash = hardhat_1.ethers.keccak256(hardhat_1.ethers.toUtf8Bytes("delivery-content"));
    const nonce = await escrow.nonces(actor.address);
    const ts = Math.floor(Date.now() / 1000);
    // EIP-712 Signature
    const domain = {
        name: "AgentMarket",
        version: "1",
        chainId: (await hardhat_1.ethers.provider.getNetwork()).chainId,
        verifyingContract: addrs.TokenEscrow
    };
    const types = {
        DeliveryReceiptSignature: [
            { name: "escrowId", type: "uint256" },
            { name: "jobId", type: "uint256" },
            { name: "agent", type: "address" },
            { name: "deliveryCID", type: "string" },
            { name: "deliveryHash", type: "bytes32" },
            { name: "timestamp", type: "uint64" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint64" }
        ]
    };
    const receipt = {
        escrowId,
        jobId,
        agent: actor.address,
        deliveryCID: deliverCID,
        deliveryHash: deliverHash,
        timestamp: ts,
        nonce: nonce,
        deadline: deadline
    };
    const signature = await actor.signTypedData(domain, types, receipt);
    const txDel = await escrow.submitDelivery(receipt, signature);
    await txDel.wait();
    console.log("   ✅ Delivery Submitted.");
    console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${txDel.hash}`);
    // 6. Accept & Pay
    console.log("\n6️⃣ Accepting & Releasing Funds...");
    const txAcc = await escrow.accept(escrowId);
    await txAcc.wait();
    console.log("   ✅ Job Complete! Funds Released.");
    console.log(`   🔗 Tx: https://sepolia.etherscan.io/tx/${txAcc.hash}`);
    console.log("\n🎉 GENESIS CYCLE COMPLETE!");
}
main().catch(console.error);
