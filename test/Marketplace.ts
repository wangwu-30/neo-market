import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Marketplace", function () {
  const SKU_ECOM_HERO = 0;
  const SKU_CUSTOM = 3;
  const STATUS_CANCELLED = 3n;
  const STATUS_CLOSED = 4n;
  const STATUS_EXPIRED = 5n;

  async function signDeliveryReceipt(params: {
    escrow: any;
    agent: any;
    receipt: {
      escrowId: bigint;
      jobId: bigint;
      agent: string;
      deliveryCID: string;
      deliveryHash: string;
      timestamp: number;
      nonce: bigint;
      deadline: number;
    };
  }) {
    const { escrow, agent, receipt } = params;
    const network = await ethers.provider.getNetwork();
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

  async function deployFixture() {
    const [deployer, buyer, agent, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(registry.target);

    const AGENT_REGISTRY = await registry.AGENT_REGISTRY();
    const TOKEN_ESCROW = await registry.TOKEN_ESCROW();
    await registry.setModule(AGENT_REGISTRY, agentRegistry.target);
    await registry.setModule(TOKEN_ESCROW, escrow.target);

    return { deployer, buyer, agent, other, usdc, registry, agentRegistry, escrow, marketplace };
  }

  it("postJob -> bid -> selectBid -> escrow funded", async function () {
    const { buyer, agent, usdc, agentRegistry, escrow, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("1000", 6);
    const price = ethers.parseUnits("900", 6);
    const deadline = (await time.latest()) + 3600;

    await agentRegistry.connect(agent).register("ipfs://agent/1");
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);

    await marketplace.connect(buyer).publishJob("ipfs://job/1", SKU_ECOM_HERO, budget, usdc.target, deadline);
    await marketplace.connect(agent).placeBid(1, "ipfs://bid/1", price, 1800);

    await marketplace.connect(buyer).selectBid(1, 1);

    const escrowId = await marketplace.escrowOf(1);
    const escrowInfo = await escrow.escrows(escrowId);
    expect(escrowInfo.funded).to.equal(true);
    expect(escrowInfo.amount).to.equal(price);
  });

  it("non-registered agent cannot bid", async function () {
    const { buyer, agent, usdc, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("500", 6);
    const deadline = (await time.latest()) + 3600;

    await marketplace.connect(buyer).publishJob("ipfs://job/2", SKU_ECOM_HERO, budget, usdc.target, deadline);

    await expect(marketplace.connect(agent).placeBid(1, "ipfs://bid/2", budget, 3600)).to.be.revertedWith(
      "AGENT_NOT_ACTIVE"
    );
  });

  it("only buyer can select", async function () {
    const { buyer, agent, other, usdc, agentRegistry, escrow, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("300", 6);
    const price = ethers.parseUnits("250", 6);
    const deadline = (await time.latest()) + 3600;

    await agentRegistry.connect(agent).register("ipfs://agent/2");
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);

    await marketplace.connect(buyer).publishJob("ipfs://job/3", SKU_ECOM_HERO, budget, usdc.target, deadline);
    await marketplace.connect(agent).placeBid(1, "ipfs://bid/3", price, 1200);

    await expect(marketplace.connect(other).selectBid(1, 1)).to.be.revertedWith("NOT_BUYER");
  });

  it("event fields correct", async function () {
    const { buyer, agent, usdc, agentRegistry, escrow, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("800", 6);
    const price = ethers.parseUnits("700", 6);
    const deadline = (await time.latest()) + 3600;
    const jobSpecCID = "ipfs://job/4";
    const bidCID = "ipfs://bid/4";
    const eta = 2400;

    await agentRegistry.connect(agent).register("ipfs://agent/4");
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);

    const publishTx = await marketplace.connect(buyer).publishJob(jobSpecCID, SKU_ECOM_HERO, budget, usdc.target, deadline);
    await expect(publishTx).to.emit(marketplace, "JobPublished").withArgs(1n, buyer.address, jobSpecCID, budget);
    await expect(publishTx)
      .to.emit(marketplace, "JobPublishedEvent")
      .withArgs(1n, buyer.address, jobSpecCID, budget, usdc.target, deadline);
    await expect(publishTx)
      .to.emit(marketplace, "JobPostedEvent")
      .withArgs(1n, buyer.address, jobSpecCID, SKU_ECOM_HERO, budget, deadline);

    const bidTx = await marketplace.connect(agent).placeBid(1, bidCID, price, eta);
    await expect(bidTx).to.emit(marketplace, "BidPlaced").withArgs(1n, 1n, agent.address, price);
    await expect(bidTx).to.emit(marketplace, "BidPlacedEvent").withArgs(1n, 1n, agent.address, bidCID, price, eta);

    const selectTx = await marketplace.connect(buyer).selectBid(1, 1);
    await expect(selectTx).to.emit(marketplace, "BidSelected").withArgs(1n, 1n, agent.address);
    await expect(selectTx)
      .to.emit(marketplace, "BidSelectedEvent")
      .withArgs(1n, 1n, agent.address, buyer.address, price, 1n);
  });

  it("CUSTOM budget below floor reverts", async function () {
    const { buyer, usdc, marketplace } = await deployFixture();

    const floor = await marketplace.CUSTOM_BUDGET_FLOOR();
    const deadline = (await time.latest()) + 3600;
    const lowBudget = floor - 1n;

    await expect(
      marketplace.connect(buyer).publishJob("ipfs://job/custom-low", SKU_CUSTOM, lowBudget, usdc.target, deadline)
    ).to.be.revertedWith("CUSTOM_BUDGET_TOO_LOW");
  });

  it("only buyer can cancel", async function () {
    const { buyer, other, usdc, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("200", 6);
    const deadline = (await time.latest()) + 3600;

    await marketplace.connect(buyer).publishJob("ipfs://job/cancel-1", SKU_ECOM_HERO, budget, usdc.target, deadline);

    await expect(marketplace.connect(other).cancelJob(1)).to.be.revertedWith("NOT_BUYER");
  });

  it("cancelled job blocks bidding and selecting", async function () {
    const { buyer, agent, usdc, agentRegistry, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("400", 6);
    const price = ethers.parseUnits("350", 6);
    const deadline = (await time.latest()) + 3600;

    await agentRegistry.connect(agent).register("ipfs://agent/cancel");
    await marketplace.connect(buyer).publishJob("ipfs://job/cancel-2", SKU_ECOM_HERO, budget, usdc.target, deadline);

    await marketplace.connect(buyer).cancelJob(1);

    const jobInfo = await marketplace.getJob(1);
    expect(jobInfo.status).to.equal(STATUS_CANCELLED);

    await expect(marketplace.connect(agent).placeBid(1, "ipfs://bid/cancel", price, 900)).to.be.revertedWith(
      "NOT_OPEN"
    );
    await expect(marketplace.connect(buyer).selectBid(1, 1)).to.be.revertedWith("NOT_OPEN");
  });

  it("expires jobs and prevents late bids", async function () {
    const { buyer, agent, usdc, agentRegistry, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("500", 6);
    const price = ethers.parseUnits("450", 6);
    const deadline = (await time.latest()) + 10;

    await agentRegistry.connect(agent).register("ipfs://agent/expire");
    await marketplace.connect(buyer).publishJob("ipfs://job/expire-1", SKU_ECOM_HERO, budget, usdc.target, deadline);

    await time.increase(12);

    const tx = await marketplace.connect(agent).placeBid(1, "ipfs://bid/expire", price, 600);
    await expect(tx).to.emit(marketplace, "JobExpired").withArgs(1n, buyer.address);

    expect(await marketplace.bidCount()).to.equal(0n);

    const jobInfo = await marketplace.getJob(1);
    expect(jobInfo.status).to.equal(STATUS_EXPIRED);
  });

  it("prevents selecting after expiry", async function () {
    const { buyer, agent, usdc, agentRegistry, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("600", 6);
    const price = ethers.parseUnits("500", 6);
    const deadline = (await time.latest()) + 10;

    await agentRegistry.connect(agent).register("ipfs://agent/expire-2");
    await marketplace.connect(buyer).publishJob("ipfs://job/expire-2", SKU_ECOM_HERO, budget, usdc.target, deadline);
    await marketplace.connect(agent).placeBid(1, "ipfs://bid/expire-2", price, 700);

    await time.increase(12);

    const tx = await marketplace.connect(buyer).selectBid(1, 1);
    await expect(tx).to.emit(marketplace, "JobExpired").withArgs(1n, buyer.address);

    expect(await marketplace.selectedBidOf(1)).to.equal(0n);
    expect(await marketplace.escrowOf(1)).to.equal(0n);

    const jobInfo = await marketplace.getJob(1);
    expect(jobInfo.status).to.equal(STATUS_EXPIRED);
  });

  it("closeJob closes after escrow accept", async function () {
    const { buyer, agent, usdc, registry, agentRegistry, escrow, marketplace } = await deployFixture();

    const budget = ethers.parseUnits("1000", 6);
    const price = ethers.parseUnits("900", 6);
    const deadline = (await time.latest()) + 3600;

    await agentRegistry.connect(agent).register("ipfs://agent/close");
    await usdc.mint(buyer.address, price);
    await usdc.connect(buyer).approve(escrow.target, price);

    await marketplace.connect(buyer).publishJob("ipfs://job/close-1", SKU_ECOM_HERO, budget, usdc.target, deadline);
    await marketplace.connect(agent).placeBid(1, "ipfs://bid/close-1", price, 1800);
    await marketplace.connect(buyer).selectBid(1, 1);

    const escrowId = await marketplace.escrowOf(1);
    const deliveryHash = ethers.id("delivery-close-1");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/close/1",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    // Configure FeeManager so accept can pay out.
    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, buyer.address);
    const FEE_MANAGER = ethers.id("FEE_MANAGER");

    // ModuleRegistry instance is already provided by the fixture.
    await registry.setModule(FEE_MANAGER, feeManager.target);

    await escrow.connect(buyer).accept(escrowId);

    const closeTx = await marketplace.connect(buyer).closeJob(1);
    await expect(closeTx).to.emit(marketplace, "JobClosed").withArgs(1n, buyer.address);
    await expect(closeTx).to.emit(marketplace, "JobClosedEvent").withArgs(1n, buyer.address, escrowId);

    const jobInfo = await marketplace.getJob(1);
    expect(jobInfo.status).to.equal(STATUS_CLOSED);
  });
});
