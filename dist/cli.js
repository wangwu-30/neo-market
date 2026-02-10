#!/usr/bin/env node
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
const commander_1 = require("commander");
const ethers_1 = require("ethers");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Load addresses
// Search for deployed_addresses.json in current dir or parent (to support ts-node and dist)
let ADDR_PATH = path.join(process.cwd(), "deployed_addresses.json");
if (!fs.existsSync(ADDR_PATH)) {
    ADDR_PATH = path.join(__dirname, "deployed_addresses.json");
}
if (!fs.existsSync(ADDR_PATH)) {
    ADDR_PATH = path.join(__dirname, "..", "deployed_addresses.json");
}
if (!fs.existsSync(ADDR_PATH)) {
    console.error("❌ Error: deployed_addresses.json not found.");
    process.exit(1);
}
const ADDRS = JSON.parse(fs.readFileSync(ADDR_PATH, "utf-8"));
// Contracts are on Sepolia L1
const DEFAULT_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CURRENT_CHAIN_ID = 11155111;
const program = new commander_1.Command();
program
    .name("agent-market")
    .description("CLI for Autonomous Agents")
    .version("0.1.0")
    .option("--rpc <url>", "Override RPC URL", DEFAULT_RPC)
    .option("--key <private_key>", "Override Private Key");
function getProvider(options) {
    const rpc = options.rpc || process.env.BASE_RPC_URL || DEFAULT_RPC;
    return new ethers_1.ethers.JsonRpcProvider(rpc);
}
function getWallet(options, provider) {
    const key = options.key || process.env.PRIVATE_KEY;
    if (key)
        return new ethers_1.ethers.Wallet(key, provider);
    return null;
}
function getContract(name, address, runner) {
    try {
        // Try to find artifact in artifacts/contracts
        // Support both ts-node (src) and dist (build) paths
        let artifactPath = path.join(__dirname, `artifacts/contracts/${name}.sol/${name}.json`);
        if (!fs.existsSync(artifactPath)) {
            // Fallback for dist structure
            artifactPath = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
        }
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        return new ethers_1.ethers.Contract(address, artifact.abi, runner);
    }
    catch (e) {
        console.error(`❌ ABI for ${name} not found at ${path.join(__dirname, `artifacts/contracts/${name}.sol/${name}.json`)}`);
        process.exit(1);
    }
}
// --- Command: Register ---
program
    .command("register")
    .description("Register as a Supplier Agent")
    .requiredOption("-m, --manifest <ipfs_cid>", "IPFS CID")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Private Key required");
        process.exit(1);
    }
    console.log(`🔌 RPC: ${provider._getConnection().url}`);
    console.log(`👤 Address: ${wallet.address}`);
    const bal = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers_1.ethers.formatEther(bal)} ETH`);
    if (bal === 0n) {
        console.error("❌ Balance is 0. Cannot send tx.");
        process.exit(1);
    }
    console.log(`\n🦞 Registering agent...`);
    const registry = getContract("AgentRegistry", ADDRS.AgentRegistry, wallet);
    try {
        const tx = await registry.register(options.manifest);
        console.log(`✅ Tx sent: ${tx.hash}`);
        await tx.wait();
        console.log(`🎉 Registered!`);
    }
    catch (e) {
        console.error("❌ Tx Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Publish Job ---
program
    .command("publish")
    .description("Publish a new Job request")
    .requiredOption("-t, --title <string>", "Job Title")
    .requiredOption("-d, --description <string>", "Job Description")
    .requiredOption("-b, --budget <amount>", "Budget in USDC")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    console.log(`📝 Publishing Job: ${options.title}...`);
    // 1. Upload Spec (Mock)
    // In real CLI, we would use IPFS. For demo, we assume a CID or generate a mock one.
    // Since we removed local IPFS mocking code to slim down, we'll just use a placeholder CID for now
    // or restore the mock function if needed. Let's use a placeholder.
    const cid = "Qm" + ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(options.title + Date.now())).substring(2, 44);
    console.log(`📦 Spec CID: ${cid}`);
    const market = getContract("Marketplace", ADDRS.Marketplace, wallet);
    const token = getContract("USDCMock", ADDRS.usdc, wallet);
    const budgetWei = ethers_1.ethers.parseUnits(options.budget, 6);
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 1 week
    // 2. Approve
    console.log("💰 Approving USDC...");
    try {
        const txApprove = await token.approve(ADDRS.Marketplace, budgetWei);
        await txApprove.wait();
        console.log("✅ Approved.");
    }
    catch (e) {
        console.error("❌ Approve Failed:", e.shortMessage || e.message);
        return;
    }
    // 3. Post
    console.log("🚀 Posting Job...");
    try {
        const tx = await market.publishJob(cid, 0, budgetWei, ADDRS.usdc, deadline);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Job Published!");
    }
    catch (e) {
        console.error("❌ Post Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Select Bid ---
program
    .command("select-bid")
    .description("Select a bid for your job")
    .requiredOption("-j, --job <id>", "Job ID")
    .requiredOption("-b, --bid <id>", "Bid ID")
    .option("-s, --sow <hash>", "SoW Hash (bytes32)")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    console.log(`__ Selecting Bid #${options.bid} for Job #${options.job}...`);
    const market = getContract("Marketplace", ADDRS.Marketplace, wallet);
    try {
        const sow = options.sow || ethers_1.ethers.ZeroHash;
        const tx = await market.selectBid(options.job, options.bid, sow);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Bid Selected!");
    }
    catch (e) {
        console.error("❌ Select Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Jobs ---
program
    .command("jobs")
    .description("List jobs")
    .option("-l, --limit <number>", "Limit results", "10")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const market = getContract("Marketplace", ADDRS.Marketplace, provider);
    try {
        const count = await market.jobCount();
        console.log(`📊 Total Jobs: ${count}`);
        const limit = Math.min(Number(count), parseInt(options.limit));
        for (let i = Number(count); i > Number(count) - limit; i--) {
            if (i <= 0)
                break;
            const job = await market.getJob(i);
            console.log(`\n🆔 Job #${job.jobId}`);
            console.log(`   Buyer: ${job.buyer}`);
            console.log(`   Spec: ${job.jobSpecCID}`);
            console.log(`   Budget: ${ethers_1.ethers.formatUnits(job.budget, 6)} USDC`);
            const status = ["Init", "Open", "Selected", "Cancelled", "Closed", "Expired"][Number(job.status)];
            console.log(`   Status: ${status}`);
            if (Number(job.status) === 2) { // Selected
                const bidId = await market.selectedBidOf(i);
                const bid = await market.getBid(bidId);
                const escrowId = await market.escrowOf(i);
                console.log(`   Selected Bid: #${bidId} by ${bid.agent} ($${ethers_1.ethers.formatUnits(bid.price, 6)})`);
                console.log(`   Escrow ID: ${escrowId}`);
            }
        }
    }
    catch (e) {
        console.error("Error fetching jobs:", e);
    }
});
// --- Command: Bids ---
program
    .command("bids")
    .description("List bids for a job")
    .requiredOption("-j, --job <id>", "Job ID")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const market = getContract("Marketplace", ADDRS.Marketplace, provider);
    try {
        const count = await market.bidCount();
        console.log(`🔍 Bids for Job #${options.job}:\n`);
        let found = 0;
        for (let i = 1; i <= Number(count); i++) {
            const bid = await market.getBid(i);
            if (bid.jobId.toString() === options.job.toString()) {
                console.log(`🆔 Bid #${i}`);
                console.log(`   Agent: ${bid.agent}`);
                console.log(`   Price: ${ethers_1.ethers.formatUnits(bid.price, 6)} USDC`);
                console.log(`   ETA: ${bid.eta}s`);
                console.log(`   CID: ${bid.bidCID}`);
                console.log("");
                found++;
            }
        }
        if (found === 0)
            console.log("No bids found.");
    }
    catch (e) {
        console.error("Error fetching bids:", e);
    }
});
// --- Command: Bid ---
program
    .command("bid")
    .requiredOption("-j, --job <id>", "Job ID")
    .requiredOption("-p, --price <amount>", "Price USDC")
    .requiredOption("-e, --eta <seconds>", "ETA")
    .requiredOption("-c, --cid <ipfs_cid>", "CID")
    .option("-r, --revisions <number>", "Max Revisions", "1")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const market = getContract("Marketplace", ADDRS.Marketplace, wallet);
    const price = ethers_1.ethers.parseUnits(options.price, 6);
    console.log(`🦞 Bidding on Job #${options.job}...`);
    // Debug: list fragment types
    const fragment = market.interface.getFunction("placeBid");
    if (fragment) {
        console.log(`   Found fragment: placeBid(${fragment.inputs.map(i => i.type).join(",")})`);
    }
    try {
        const tx = await market.placeBid(BigInt(options.job), options.cid, price, BigInt(options.eta), Number(options.revisions));
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Bid Placed!");
    }
    catch (e) {
        console.error("❌ Bid Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Set SoW ---
program
    .command("set-sow")
    .description("Lock the negotiated Statement of Work (SoW) hash")
    .requiredOption("-e, --escrow <id>", "Escrow ID")
    .requiredOption("-s, --sow <hash>", "SoW Hash (bytes32)")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const escrow = getContract("TokenEscrow", ADDRS.TokenEscrow, wallet);
    console.log(`✍️ Locking SoW for Escrow #${options.escrow}...`);
    try {
        const tx = await escrow.setSowHash(options.escrow, options.sow);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 SoW Locked!");
    }
    catch (e) {
        console.error("❌ Set SoW Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Pay Intent ---
program
    .command("pay-intent")
    .description("Pay intent deposit (consultation fee)")
    .requiredOption("-e, --escrow <id>", "Escrow ID")
    .requiredOption("-a, --amount <amount>", "Amount in USDC")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const escrow = getContract("TokenEscrow", ADDRS.TokenEscrow, wallet);
    const token = getContract("USDCMock", ADDRS.usdc, wallet);
    const amount = ethers_1.ethers.parseUnits(options.amount, 6);
    console.log("💰 Approving USDC...");
    const txApprove = await token.approve(ADDRS.TokenEscrow, amount);
    await txApprove.wait();
    console.log(`🚀 Paying Intent Deposit for Escrow #${options.escrow}...`);
    try {
        const tx = await escrow.payIntentDeposit(options.escrow, amount);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Intent Deposit Paid!");
    }
    catch (e) {
        console.error("❌ Pay Intent Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Claim Intent ---
program
    .command("claim-intent")
    .description("Claim intent deposit (Agent only)")
    .requiredOption("-e, --escrow <id>", "Escrow ID")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const escrow = getContract("TokenEscrow", ADDRS.TokenEscrow, wallet);
    console.log(`💸 Claiming Intent Deposit for Escrow #${options.escrow}...`);
    try {
        const tx = await escrow.claimIntentDeposit(options.escrow);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Intent Deposit Claimed!");
    }
    catch (e) {
        console.error("❌ Claim Intent Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Badges ---
program
    .command("badges")
    .description("View badges for an address")
    .argument("[address]", "Address to query")
    .action(async (address) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    const target = address || (wallet ? wallet.address : null);
    if (!target) {
        console.error("❌ Address required");
        process.exit(1);
    }
    const badge = getContract("NeoBadge", ADDRS.NeoBadge, provider);
    try {
        const balance = await badge.balanceOf(target);
        console.log(`🏅 Badges for ${target}: ${balance}`);
        // In a real CLI we would iterate and fetch URIs
    }
    catch (e) {
        console.error("❌ Failed to fetch badges:", e);
    }
});
// --- Command: Deliver ---
program
    .command("deliver")
    .requiredOption("-e, --escrow <id>", "Escrow ID")
    .requiredOption("-j, --job <id>", "Job ID")
    .requiredOption("-c, --cid <ipfs_cid>", "CID")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const escrow = getContract("TokenEscrow", ADDRS.TokenEscrow, wallet);
    // Receipt Signature
    const deliveryHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(options.cid));
    const nonce = await escrow.nonces(wallet.address);
    const ts = Math.floor(Date.now() / 1000);
    const deadline = ts + 3600;
    const receipt = {
        escrowId: options.escrow,
        jobId: options.job,
        agent: wallet.address,
        deliveryCID: options.cid,
        deliveryHash: deliveryHash,
        timestamp: ts,
        nonce: nonce,
        deadline: deadline
    };
    const domain = {
        name: "AgentMarket",
        version: "1",
        chainId: CURRENT_CHAIN_ID,
        verifyingContract: ADDRS.TokenEscrow
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
    console.log("✍️ Signing receipt...");
    const signature = await wallet.signTypedData(domain, types, receipt);
    console.log("🚀 Submitting...");
    try {
        const tx = await escrow.submitDelivery(receipt, signature);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Delivered!");
    }
    catch (e) {
        console.error("❌ Deliver Failed:", e.shortMessage || e.message);
    }
});
// --- Command: Accept ---
program
    .command("accept")
    .description("Accept delivery and release payment")
    .requiredOption("-e, --escrow <id>", "Escrow ID")
    .action(async (options) => {
    const provider = getProvider(program.opts());
    const wallet = getWallet(program.opts(), provider);
    if (!wallet) {
        console.error("❌ Key required");
        process.exit(1);
    }
    const escrow = getContract("TokenEscrow", ADDRS.TokenEscrow, wallet);
    console.log(`✅ Accepting Escrow #${options.escrow}...`);
    try {
        const tx = await escrow.accept(options.escrow);
        console.log(`✅ Tx: ${tx.hash}`);
        await tx.wait();
        console.log("🎉 Payment Released & Badges Minted!");
    }
    catch (e) {
        console.error("❌ Accept Failed:", e.shortMessage || e.message);
    }
});
program.parse(process.argv);
