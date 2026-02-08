"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
function assertEqual(label, actual, expected) {
    if (actual !== expected) {
        throw new Error(`${label} mismatch: expected ${expected} got ${actual}`);
    }
}
async function signDeliveryReceipt(params) {
    const { escrow, agent, receipt } = params;
    const network = await hardhat_1.ethers.provider.getNetwork();
    const domain = {
        name: "AgentMarket",
        version: "1",
        chainId: network.chainId,
        verifyingContract: escrow.target,
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
            { name: "deadline", type: "uint64" },
        ],
    };
    return agent.signTypedData(domain, types, receipt);
}
async function deployStack() {
    const [deployer, buyer, agent, treasury] = await hardhat_1.ethers.getSigners();
    const USDC = await hardhat_1.ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();
    const ModuleRegistry = await hardhat_1.ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();
    const AgentRegistry = await hardhat_1.ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();
    const FeeManager = await hardhat_1.ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, treasury.address); // 2.5%
    const TokenEscrow = await hardhat_1.ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);
    const Marketplace = await hardhat_1.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(registry.target);
    const Reputation = await hardhat_1.ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy();
    const AGENT_REGISTRY = await registry.AGENT_REGISTRY();
    const TOKEN_ESCROW = await registry.TOKEN_ESCROW();
    const REPUTATION = await registry.REPUTATION();
    const FEE_MANAGER = hardhat_1.ethers.id("FEE_MANAGER");
    const TREASURY = hardhat_1.ethers.id("TREASURY");
    await registry.setModule(AGENT_REGISTRY, agentRegistry.target);
    await registry.setModule(TOKEN_ESCROW, escrow.target);
    await registry.setModule(FEE_MANAGER, feeManager.target);
    await registry.setModule(TREASURY, treasury.address);
    await registry.setModule(REPUTATION, reputation.target);
    await reputation.setUpdater(escrow.target);
    return {
        deployer,
        buyer,
        agent,
        treasury,
        usdc,
        registry,
        agentRegistry,
        feeManager,
        escrow,
        marketplace,
        reputation,
    };
}
async function runFullDemo() {
    const { buyer, agent, treasury, usdc, agentRegistry, escrow, marketplace } = await deployStack();
    const manifestCID = "ipfs://agent/demo";
    await agentRegistry.connect(agent).register(manifestCID);
    const budget = hardhat_1.ethers.parseUnits("1000", 6);
    const price = hardhat_1.ethers.parseUnits("900", 6);
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);
    const latestBlock = await hardhat_1.ethers.provider.getBlock("latest");
    if (!latestBlock) {
        throw new Error("Missing latest block");
    }
    const deadline = Number(latestBlock.timestamp) + 3600;
    const jobSpecCID = "ipfs://job/demo";
    const bidCID = "ipfs://bid/demo";
    const sku = 0;
    await marketplace.connect(buyer).publishJob(jobSpecCID, sku, budget, usdc.target, deadline);
    const jobId = await marketplace.jobCount();
    const jobInfo = await marketplace.getJob(jobId);
    await marketplace.connect(agent).placeBid(jobId, bidCID, price, 1800);
    const bidId = await marketplace.bidCount();
    await marketplace.connect(buyer).selectBid(jobId, bidId);
    const escrowId = await marketplace.escrowOf(jobId);
    const deliveryHash = hardhat_1.ethers.id("demo-delivery");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = deadline + 1800;
    const receipt = {
        escrowId,
        jobId,
        agent: agent.address,
        deliveryCID: "ipfs://delivery/demo",
        deliveryHash,
        timestamp: Number(latestBlock.timestamp),
        nonce,
        deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);
    await escrow.connect(buyer).accept(escrowId);
    const fee = (price * 250n) / 10000n;
    const net = price - fee;
    const buyerBal = await usdc.balanceOf(buyer.address);
    const agentBal = await usdc.balanceOf(agent.address);
    const treasuryBal = await usdc.balanceOf(treasury.address);
    const escrowBal = await usdc.balanceOf(escrow.target);
    assertEqual("buyer balance", buyerBal, 0n);
    assertEqual("agent balance", agentBal, net);
    assertEqual("treasury balance", treasuryBal, fee);
    assertEqual("escrow balance", escrowBal, 0n);
    console.log("Demo complete");
    console.log("jobId:", jobId.toString());
    console.log("sku:", jobInfo.sku.toString());
    console.log("bidId:", bidId.toString());
    console.log("escrowId:", escrowId.toString());
    console.log("balances:");
    console.log("  buyer:", hardhat_1.ethers.formatUnits(buyerBal, 6));
    console.log("  agent:", hardhat_1.ethers.formatUnits(agentBal, 6));
    console.log("  treasury:", hardhat_1.ethers.formatUnits(treasuryBal, 6));
    console.log("  escrow:", hardhat_1.ethers.formatUnits(escrowBal, 6));
}
async function runRevisionDemo() {
    const { buyer, agent, treasury, usdc, agentRegistry, escrow, marketplace } = await deployStack();
    await agentRegistry.connect(agent).register("ipfs://agent/revision");
    const budget = hardhat_1.ethers.parseUnits("800", 6);
    const price = hardhat_1.ethers.parseUnits("700", 6);
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);
    const latestBlock = await hardhat_1.ethers.provider.getBlock("latest");
    if (!latestBlock) {
        throw new Error("Missing latest block");
    }
    const deadline = Number(latestBlock.timestamp) + 3600;
    await marketplace.connect(buyer).publishJob("ipfs://job/revision", 0, budget, usdc.target, deadline);
    const jobId = await marketplace.jobCount();
    await marketplace.connect(agent).placeBid(jobId, "ipfs://bid/revision", price, 1200);
    const bidId = await marketplace.bidCount();
    await marketplace.connect(buyer).selectBid(jobId, bidId);
    const escrowId = await marketplace.escrowOf(jobId);
    const deliveryHashA = hardhat_1.ethers.id("demo-revision-a");
    const nonceA = await escrow.nonces(agent.address);
    const sigDeadlineA = deadline + 1800;
    const receiptA = {
        escrowId,
        jobId,
        agent: agent.address,
        deliveryCID: "ipfs://delivery/revision/a",
        deliveryHash: deliveryHashA,
        timestamp: Number(latestBlock.timestamp),
        nonce: nonceA,
        deadline: sigDeadlineA,
    };
    const signatureA = await signDeliveryReceipt({ escrow, agent, receipt: receiptA });
    await escrow.connect(buyer).submitDelivery(receiptA, signatureA);
    await escrow.connect(buyer).requestRevision(escrowId, "ipfs://note/revision/1");
    const deliveryHashB = hardhat_1.ethers.id("demo-revision-b");
    const nonceB = await escrow.nonces(agent.address);
    const sigDeadlineB = deadline + 2400;
    const receiptB = {
        escrowId,
        jobId,
        agent: agent.address,
        deliveryCID: "ipfs://delivery/revision/b",
        deliveryHash: deliveryHashB,
        timestamp: Number(latestBlock.timestamp) + 60,
        nonce: nonceB,
        deadline: sigDeadlineB,
    };
    const signatureB = await signDeliveryReceipt({ escrow, agent, receipt: receiptB });
    await escrow.connect(buyer).submitDelivery(receiptB, signatureB);
    await escrow.connect(buyer).accept(escrowId);
    const fee = (price * 250n) / 10000n;
    const net = price - fee;
    const buyerBal = await usdc.balanceOf(buyer.address);
    const agentBal = await usdc.balanceOf(agent.address);
    const treasuryBal = await usdc.balanceOf(treasury.address);
    const escrowBal = await usdc.balanceOf(escrow.target);
    assertEqual("buyer balance", buyerBal, 0n);
    assertEqual("agent balance", agentBal, net);
    assertEqual("treasury balance", treasuryBal, fee);
    assertEqual("escrow balance", escrowBal, 0n);
    console.log("Revision demo complete");
    console.log("jobId:", jobId.toString());
    console.log("bidId:", bidId.toString());
    console.log("escrowId:", escrowId.toString());
    console.log("balances:");
    console.log("  buyer:", hardhat_1.ethers.formatUnits(buyerBal, 6));
    console.log("  agent:", hardhat_1.ethers.formatUnits(agentBal, 6));
    console.log("  treasury:", hardhat_1.ethers.formatUnits(treasuryBal, 6));
    console.log("  escrow:", hardhat_1.ethers.formatUnits(escrowBal, 6));
}
async function runCancelDemo() {
    const { buyer, agent, usdc, agentRegistry, marketplace } = await deployStack();
    await agentRegistry.connect(agent).register("ipfs://agent/cancel");
    const budget = hardhat_1.ethers.parseUnits("300", 6);
    const deadline = Number((await hardhat_1.ethers.provider.getBlock("latest"))?.timestamp ?? 0) + 3600;
    await marketplace.connect(buyer).publishJob("ipfs://job/cancel-demo", 0, budget, usdc.target, deadline);
    await marketplace.connect(buyer).cancelJob(1);
    const jobInfo = await marketplace.getJob(1);
    console.log("Cancel demo complete");
    console.log("jobId:", jobInfo.jobId.toString());
    console.log("status:", jobInfo.status.toString());
}
async function runExpiryDemo() {
    const { buyer, agent, usdc, agentRegistry, marketplace } = await deployStack();
    await agentRegistry.connect(agent).register("ipfs://agent/expiry");
    const budget = hardhat_1.ethers.parseUnits("300", 6);
    const price = hardhat_1.ethers.parseUnits("250", 6);
    const latestBlock = await hardhat_1.ethers.provider.getBlock("latest");
    if (!latestBlock) {
        throw new Error("Missing latest block");
    }
    const deadline = Number(latestBlock.timestamp) + 5;
    await marketplace.connect(buyer).publishJob("ipfs://job/expiry-demo", 0, budget, usdc.target, deadline);
    await hardhat_1.ethers.provider.send("evm_increaseTime", [10]);
    await hardhat_1.ethers.provider.send("evm_mine", []);
    const tx = await marketplace.connect(agent).placeBid(1, "ipfs://bid/expiry-demo", price, 600);
    await tx.wait();
    const jobInfo = await marketplace.getJob(1);
    console.log("Expiry demo complete");
    console.log("jobId:", jobInfo.jobId.toString());
    console.log("status:", jobInfo.status.toString());
}
async function main() {
    const scenarioFromEnv = process.env.SCENARIO;
    const scenarioArg = process.argv.find((arg) => arg.startsWith("--scenario="));
    const scenario = scenarioFromEnv ?? (scenarioArg ? scenarioArg.split("=")[1] : "full");
    if (scenario === "cancel") {
        await runCancelDemo();
        return;
    }
    if (scenario === "expiry") {
        await runExpiryDemo();
        return;
    }
    if (scenario === "revision") {
        await runRevisionDemo();
        return;
    }
    await runFullDemo();
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
