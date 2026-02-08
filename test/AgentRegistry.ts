import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentRegistry", function () {
  it("can register and update", async function () {
    const [owner, agent] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.connect(owner).deploy();

    await registry.connect(agent).register("cid:one");

    expect(await registry.manifestOf(agent.address)).to.equal("cid:one");
    expect(await registry.stakeOf(agent.address)).to.equal(0n);

    await registry.connect(agent).updateManifest("cid:two");
    expect(await registry.manifestOf(agent.address)).to.equal("cid:two");
  });

  it("non-agent cannot update", async function () {
    const [owner, other] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.connect(owner).deploy();

    await expect(registry.connect(other).updateManifest("cid:bad")).to.be.revertedWith(
      "NOT_AGENT"
    );
  });

  it("stake gate", async function () {
    const [owner, agent] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.connect(owner).deploy();

    await registry.connect(owner).setMinStake(ethers.parseEther("1"));
    await registry.connect(owner).setStakeEnabled(true);

    await expect(registry.connect(agent).register("cid:one")).to.be.revertedWith(
      "INSUFFICIENT_STAKE"
    );

    await registry.connect(owner).setStakeEnabled(false);

    await registry.connect(agent).register("cid:two");
    expect(await registry.manifestOf(agent.address)).to.equal("cid:two");
  });
});
