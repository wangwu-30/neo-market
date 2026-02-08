import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TokenEscrow", function () {
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

  it("createEscrow validates agent when AgentRegistry module present", async function () {
    const [deployer, buyer, agent] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();

    const AGENT_REGISTRY = await registry.AGENT_REGISTRY();
    await registry.setModule(AGENT_REGISTRY, agentRegistry.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("100", 6);
    const deadline = (await time.latest()) + 3600;

    await expect(escrow.createEscrow(buyer.address, agent.address, amount, deadline)).to.be.revertedWith(
      "AGENT_NOT_ACTIVE"
    );

    await agentRegistry.connect(agent).register("ipfs://agent/1");
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);

    expect(await escrow.escrowCount()).to.equal(1n);
  });

  it("createEscrow ignores missing AgentRegistry module", async function () {
    const [deployer, buyer, agent] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("100", 6);
    const deadline = (await time.latest()) + 3600;

    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    expect(await escrow.escrowCount()).to.equal(1n);
  });

  it("accept validates agent when AgentRegistry module present", async function () {
    const [deployer, buyer, agent, treasury] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, treasury.address);

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();

    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    const AGENT_REGISTRY = await registry.AGENT_REGISTRY();
    await registry.setModule(FEE_MANAGER, feeManager.target);
    await registry.setModule(AGENT_REGISTRY, agentRegistry.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("100", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await agentRegistry.connect(agent).register("ipfs://agent/active");
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();

    await escrow.connect(buyer).fund(escrowId);
    const deliveryHash = ethers.id("delivery-accept-check");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/accept-check",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    await agentRegistry.setStatus(agent.address, 2); // Suspended
    await expect(escrow.connect(buyer).accept(escrowId)).to.be.revertedWith("AGENT_NOT_ACTIVE");
  });

  it("fund + submitDelivery + accept: balances correct", async function () {
    const [deployer, buyer, agent, treasury] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, treasury.address); // 2.5%

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy();

    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    const TREASURY = ethers.id("TREASURY");
    const REPUTATION = await registry.REPUTATION();
    await registry.setModule(FEE_MANAGER, feeManager.target);
    await registry.setModule(TREASURY, treasury.address);
    await registry.setModule(REPUTATION, reputation.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);
    await reputation.setUpdater(escrow.target);

    const amount = ethers.parseUnits("1000", 6);

    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();

    await escrow.connect(buyer).fund(escrowId);

    const deliveryHash = ethers.id("delivery");
    const nonce = await escrow.nonces(agent.address);
    const deadlineSig = (await time.latest()) + 3600;
    const receipt = {
      escrowId: escrowId,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/1",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: deadlineSig,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    const acceptTx = await escrow.connect(buyer).accept(escrowId);

    const fee = (amount * 250n) / 10_000n;
    const net = amount - fee;

    expect(await usdc.balanceOf(treasury.address)).to.equal(fee);
    expect(await usdc.balanceOf(agent.address)).to.equal(net);
    expect(await usdc.balanceOf(buyer.address)).to.equal(0n);
    expect(await usdc.balanceOf(escrow.target)).to.equal(0n);

    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("accept"));
    await expect(acceptTx)
      .to.emit(reputation, "ReputationEvent")
      .withArgs(agent.address, 1, reasonHash, escrowId, 1n, escrow.target);
    await expect(acceptTx)
      .to.emit(escrow, "EscrowAcceptedEvent")
      .withArgs(escrowId, buyer.address, agent.address, fee, net);
  });

  it("fund + timeout refund: buyer refunded", async function () {
    const [deployer, buyer, agent, treasury, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, treasury.address);

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();
    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    await registry.setModule(FEE_MANAGER, feeManager.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("500", 6);

    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 60;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();

    await escrow.connect(buyer).fund(escrowId);

    await time.increaseTo(deadline + 1);
    await escrow.connect(other).refundOnTimeout(escrowId);

    expect(await usdc.balanceOf(buyer.address)).to.equal(amount);
    expect(await usdc.balanceOf(escrow.target)).to.equal(0n);
  });

  it("accept uses updated FeeManager + Treasury modules", async function () {
    const [deployer, buyer, agent, treasuryA, treasuryB] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManagerA = await FeeManager.deploy(250, treasuryA.address);
    const feeManagerB = await FeeManager.deploy(500, treasuryB.address);

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    const TREASURY = ethers.id("TREASURY");

    await registry.setModule(FEE_MANAGER, feeManagerA.target);
    await registry.setModule(TREASURY, treasuryA.address);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amountA = ethers.parseUnits("200", 6);
    await usdc.mint(buyer.address, amountA);
    await usdc.connect(buyer).approve(escrow.target, amountA);

    const deadlineA = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amountA, deadlineA);
    const escrowIdA = await escrow.escrowCount();

    await escrow.connect(buyer).fund(escrowIdA);
    const deliveryHashA = ethers.id("deliveryA");
    const nonceA = await escrow.nonces(agent.address);
    const sigDeadlineA = (await time.latest()) + 3600;
    const receiptA = {
      escrowId: escrowIdA,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/A",
      deliveryHash: deliveryHashA,
      timestamp: await time.latest(),
      nonce: nonceA,
      deadline: sigDeadlineA,
    };
    const signatureA = await signDeliveryReceipt({ escrow, agent, receipt: receiptA });
    await escrow.connect(buyer).submitDelivery(receiptA, signatureA);
    await escrow.connect(buyer).accept(escrowIdA);

    const feeA = (amountA * 250n) / 10_000n;
    const netA = amountA - feeA;
    expect(await usdc.balanceOf(treasuryA.address)).to.equal(feeA);
    expect(await usdc.balanceOf(agent.address)).to.equal(netA);

    await registry.setModule(FEE_MANAGER, feeManagerB.target);
    await registry.setModule(TREASURY, treasuryB.address);

    const amountB = ethers.parseUnits("300", 6);
    await usdc.mint(buyer.address, amountB);
    await usdc.connect(buyer).approve(escrow.target, amountB);

    const deadlineB = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amountB, deadlineB);
    const escrowIdB = await escrow.escrowCount();

    await escrow.connect(buyer).fund(escrowIdB);
    const deliveryHashB = ethers.id("deliveryB");
    const nonceB = await escrow.nonces(agent.address);
    const sigDeadlineB = (await time.latest()) + 3600;
    const receiptB = {
      escrowId: escrowIdB,
      jobId: 2n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/B",
      deliveryHash: deliveryHashB,
      timestamp: await time.latest(),
      nonce: nonceB,
      deadline: sigDeadlineB,
    };
    const signatureB = await signDeliveryReceipt({ escrow, agent, receipt: receiptB });
    await escrow.connect(buyer).submitDelivery(receiptB, signatureB);
    await escrow.connect(buyer).accept(escrowIdB);

    const feeB = (amountB * 500n) / 10_000n;
    const netB = amountB - feeB;

    expect(await usdc.balanceOf(treasuryB.address)).to.equal(feeB);
    expect(await usdc.balanceOf(agent.address)).to.equal(netA + netB);
  });

  it("non-owner cannot setModule", async function () {
    const [deployer, other] = await ethers.getSigners();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();
    const FEE_MANAGER = ethers.id("FEE_MANAGER");

    await expect(registry.connect(other).setModule(FEE_MANAGER, other.address)).to.be.revertedWith(
      "NOT_OWNER"
    );
  });

  it("submitDelivery rejects replayed nonce", async function () {
    const [deployer, buyer, agent] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("100", 6);
    await usdc.mint(buyer.address, amount * 2n);
    await usdc.connect(buyer).approve(escrow.target, amount * 2n);

    const deadlineA = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadlineA);
    const escrowIdA = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowIdA);

    const deliveryHashA = ethers.id("deliveryA");
    const nonceA = await escrow.nonces(agent.address);
    const sigDeadlineA = (await time.latest()) + 3600;
    const receiptA = {
      escrowId: escrowIdA,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/A",
      deliveryHash: deliveryHashA,
      timestamp: await time.latest(),
      nonce: nonceA,
      deadline: sigDeadlineA,
    };
    const signatureA = await signDeliveryReceipt({ escrow, agent, receipt: receiptA });
    await escrow.connect(buyer).submitDelivery(receiptA, signatureA);

    const deadlineB = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadlineB);
    const escrowIdB = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowIdB);

    const receiptB = {
      escrowId: escrowIdB,
      jobId: 2n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/B",
      deliveryHash: ethers.id("deliveryB"),
      timestamp: await time.latest(),
      nonce: nonceA,
      deadline: sigDeadlineA,
    };
    const signatureB = await signDeliveryReceipt({ escrow, agent, receipt: receiptB });
    await expect(escrow.connect(buyer).submitDelivery(receiptB, signatureB)).to.be.revertedWith(
      "BAD_NONCE"
    );
  });

  it("submitDelivery rejects signature by non-agent", async function () {
    const [deployer, buyer, agent, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("100", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    const deliveryHash = ethers.id("delivery");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 1n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/1",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent: other, receipt });
    await expect(escrow.connect(buyer).submitDelivery(receipt, signature)).to.be.revertedWith(
      "BAD_SIG"
    );
  });

  it("revision flow allows one request and blocks accept until redelivery", async function () {
    const [deployer, buyer, agent, treasury, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(250, treasury.address);

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();
    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    const TREASURY = ethers.id("TREASURY");
    await registry.setModule(FEE_MANAGER, feeManager.target);
    await registry.setModule(TREASURY, treasury.address);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("120", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    const deliveryHashA = ethers.id("delivery-rev-a");
    const nonceA = await escrow.nonces(agent.address);
    const sigDeadlineA = (await time.latest()) + 3600;
    const receiptA = {
      escrowId,
      jobId: 21n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/rev/a",
      deliveryHash: deliveryHashA,
      timestamp: await time.latest(),
      nonce: nonceA,
      deadline: sigDeadlineA,
    };
    const signatureA = await signDeliveryReceipt({ escrow, agent, receipt: receiptA });
    await escrow.connect(buyer).submitDelivery(receiptA, signatureA);

    await expect(escrow.connect(other).requestRevision(escrowId, "ipfs://note/1")).to.be.revertedWith(
      "NOT_BUYER"
    );

    await escrow.connect(buyer).requestRevision(escrowId, "ipfs://note/1");

    const escrowInfoAfterRequest = await escrow.escrows(escrowId);
    expect(escrowInfoAfterRequest.revisionRequested).to.equal(true);
    expect(escrowInfoAfterRequest.revisionCount).to.equal(1n);
    expect(escrowInfoAfterRequest.lastRevisionNoteCID).to.equal("ipfs://note/1");

    await expect(escrow.connect(buyer).accept(escrowId)).to.be.revertedWith("REVISION_PENDING");

    const deliveryHashB = ethers.id("delivery-rev-b");
    const nonceB = await escrow.nonces(agent.address);
    const sigDeadlineB = (await time.latest()) + 3600;
    const receiptB = {
      escrowId,
      jobId: 21n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/rev/b",
      deliveryHash: deliveryHashB,
      timestamp: await time.latest(),
      nonce: nonceB,
      deadline: sigDeadlineB,
    };
    const signatureB = await signDeliveryReceipt({ escrow, agent, receipt: receiptB });
    await escrow.connect(buyer).submitDelivery(receiptB, signatureB);

    const escrowInfoAfterRedelivery = await escrow.escrows(escrowId);
    expect(escrowInfoAfterRedelivery.revisionRequested).to.equal(false);
    expect(escrowInfoAfterRedelivery.deliveryHash).to.equal(deliveryHashB);

    await expect(escrow.connect(buyer).requestRevision(escrowId, "ipfs://note/2")).to.be.revertedWith(
      "REVISION_LIMIT"
    );

    await escrow.connect(buyer).accept(escrowId);
  });

  it("openDispute is a no-op when Arbitration module missing", async function () {
    const [deployer, buyer, agent, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("200", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 60;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    await time.increaseTo(deadline + 1);

    const disputeId = await escrow.connect(buyer).openDispute.staticCall(escrowId, "ipfs://evidence/missing");
    expect(disputeId).to.equal(0n);

    await escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/missing");
    expect(await escrow.escrowDisputes(escrowId)).to.equal(0n);
  });

  it("executeRuling is a no-op when Arbitration module missing", async function () {
    const [deployer, buyer, agent, arbitrator, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const ARBITRATION = await registry.ARBITRATION();
    await registry.setModule(ARBITRATION, arbitration.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("250", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 60;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    await time.increaseTo(deadline + 1);

    const disputeId = await escrow.connect(buyer).openDispute.staticCall(escrowId, "ipfs://evidence/noop");
    await escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/noop");

    await registry.setModule(ARBITRATION, ethers.ZeroAddress);

    await escrow.connect(other).executeRuling(disputeId);
    const dispute = await escrow.disputes(disputeId);
    expect(dispute.resolved).to.equal(false);
  });

  it("dispute ruling refunds buyer + reputation updated", async function () {
    const [deployer, buyer, agent, arbitrator] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy();

    const ARBITRATION = await registry.ARBITRATION();
    await registry.setModule(ARBITRATION, arbitration.target);
    const REPUTATION = await registry.REPUTATION();
    await registry.setModule(REPUTATION, reputation.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);
    await reputation.setUpdater(escrow.target);

    const amount = ethers.parseUnits("250", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    const deliveryHash = ethers.id("delivery-dispute-1");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 11n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/dispute/1",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    const disputeId = await escrow.connect(buyer).openDispute.staticCall(escrowId, "ipfs://evidence/1");
    await escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/1");

    const rulingBuyer = await escrow.RULING_BUYER_WINS();
    await arbitration.connect(arbitrator).rule(disputeId, rulingBuyer);

    const executeTx = await arbitration.connect(arbitrator).executeRuling(escrow.target, disputeId);

    expect(await usdc.balanceOf(buyer.address)).to.equal(amount);
    expect(await usdc.balanceOf(escrow.target)).to.equal(0n);
    expect(await reputation.scoreOf(agent.address)).to.equal(-1n);

    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("buyer_win"));
    await expect(executeTx)
      .to.emit(reputation, "ReputationEvent")
      .withArgs(agent.address, -1, reasonHash, escrowId, -1n, escrow.target);
  });

  it("dispute ruling pays agent + treasury fee + reputation updated", async function () {
    const [deployer, buyer, agent, arbitrator, treasury] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(500, treasury.address); // 5%

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy();

    const FEE_MANAGER = ethers.id("FEE_MANAGER");
    const TREASURY = ethers.id("TREASURY");
    const ARBITRATION = await registry.ARBITRATION();
    const REPUTATION = await registry.REPUTATION();
    await registry.setModule(FEE_MANAGER, feeManager.target);
    await registry.setModule(TREASURY, treasury.address);
    await registry.setModule(ARBITRATION, arbitration.target);
    await registry.setModule(REPUTATION, reputation.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);
    await reputation.setUpdater(escrow.target);

    const amount = ethers.parseUnits("400", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    const deliveryHash = ethers.id("delivery-dispute-2");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 12n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/dispute/2",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    const disputeId = await escrow.connect(agent).openDispute.staticCall(escrowId, "ipfs://evidence/2");
    await escrow.connect(agent).openDispute(escrowId, "ipfs://evidence/2");

    const rulingAgent = await escrow.RULING_AGENT_WINS();
    await arbitration.connect(arbitrator).rule(disputeId, rulingAgent);

    const executeTx = await arbitration.connect(arbitrator).executeRuling(escrow.target, disputeId);

    const fee = (amount * 500n) / 10_000n;
    const net = amount - fee;

    expect(await usdc.balanceOf(agent.address)).to.equal(net);
    expect(await usdc.balanceOf(treasury.address)).to.equal(fee);
    expect(await usdc.balanceOf(buyer.address)).to.equal(0n);
    expect(await usdc.balanceOf(escrow.target)).to.equal(0n);
    expect(await reputation.scoreOf(agent.address)).to.equal(1n);

    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("agent_win"));
    await expect(executeTx)
      .to.emit(reputation, "ReputationEvent")
      .withArgs(agent.address, 1, reasonHash, escrowId, 1n, escrow.target);
  });

  it("only arbitrator can execute ruling", async function () {
    const [deployer, buyer, agent, arbitrator, other] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const ARBITRATION = await registry.ARBITRATION();
    await registry.setModule(ARBITRATION, arbitration.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("150", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    const deliveryHash = ethers.id("delivery-dispute-3");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 13n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/dispute/3",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    const disputeId = await escrow.connect(buyer).openDispute.staticCall(escrowId, "ipfs://evidence/3");
    await escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/3");

    const rulingBuyer = await escrow.RULING_BUYER_WINS();
    await arbitration.connect(arbitrator).rule(disputeId, rulingBuyer);

    await expect(escrow.connect(other).executeRuling(disputeId)).to.be.revertedWith("NOT_ARBITRATION");
    await expect(arbitration.connect(other).executeRuling(escrow.target, disputeId)).to.be.revertedWith(
      "NOT_OWNER"
    );
  });

  it("openDispute requires delivery or timeout and blocks accept + repeat disputes", async function () {
    const [deployer, buyer, agent, arbitrator] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const ARBITRATION = await registry.ARBITRATION();
    await registry.setModule(ARBITRATION, arbitration.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("220", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 3600;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    await expect(escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/guardrails")).to.be.revertedWith(
      "DISPUTE_NOT_AVAILABLE"
    );

    const deliveryHash = ethers.id("delivery-guardrail");
    const nonce = await escrow.nonces(agent.address);
    const sigDeadline = (await time.latest()) + 3600;
    const receipt = {
      escrowId,
      jobId: 7n,
      agent: agent.address,
      deliveryCID: "ipfs://delivery/guardrail",
      deliveryHash,
      timestamp: await time.latest(),
      nonce,
      deadline: sigDeadline,
    };
    const signature = await signDeliveryReceipt({ escrow, agent, receipt });
    await escrow.connect(buyer).submitDelivery(receipt, signature);

    const disputeId = await escrow
      .connect(buyer)
      .openDispute.staticCall(escrowId, "ipfs://evidence/guardrails");
    await escrow.connect(buyer).openDispute(escrowId, "ipfs://evidence/guardrails");

    await expect(escrow.connect(buyer).accept(escrowId)).to.be.revertedWith("DISPUTED");
    await expect(escrow.connect(agent).openDispute(escrowId, "ipfs://evidence/second")).to.be.revertedWith(
      "DISPUTE_EXISTS"
    );

    expect(disputeId).to.equal(await escrow.escrowDisputes(escrowId));
  });

  it("openDispute allowed after timeout without delivery", async function () {
    const [deployer, buyer, agent, arbitrator] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDCMock");
    const usdc = await USDC.deploy();

    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    const registry = await ModuleRegistry.deploy();

    const ArbitrationMultisig = await ethers.getContractFactory("ArbitrationMultisig");
    const arbitration = await ArbitrationMultisig.deploy(arbitrator.address);

    const ARBITRATION = await registry.ARBITRATION();
    await registry.setModule(ARBITRATION, arbitration.target);

    const TokenEscrow = await ethers.getContractFactory("TokenEscrow");
    const escrow = await TokenEscrow.deploy(usdc.target, registry.target);

    const amount = ethers.parseUnits("180", 6);
    await usdc.mint(buyer.address, amount);
    await usdc.connect(buyer).approve(escrow.target, amount);

    const deadline = (await time.latest()) + 20;
    await escrow.createEscrow(buyer.address, agent.address, amount, deadline);
    const escrowId = await escrow.escrowCount();
    await escrow.connect(buyer).fund(escrowId);

    await time.increaseTo(deadline + 1);

    const disputeId = await escrow
      .connect(agent)
      .openDispute.staticCall(escrowId, "ipfs://evidence/timeout");
    await escrow.connect(agent).openDispute(escrowId, "ipfs://evidence/timeout");

    expect(disputeId).to.equal(await escrow.escrowDisputes(escrowId));
    await expect(escrow.refundOnTimeout(escrowId)).to.be.revertedWith("DISPUTED");
  });
});
