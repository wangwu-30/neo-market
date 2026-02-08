import { expect } from "chai";
import { ethers } from "hardhat";

describe("Reputation", function () {
  it("only updater can update score", async function () {
    const [owner, updater, other, subject] = await ethers.getSigners();

    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.connect(owner).deploy();

    await reputation.connect(owner).setUpdater(updater.address);

    await expect(
      reputation.connect(other).update(subject.address, 1, "test", 1)
    ).to.be.revertedWith("NOT_UPDATER");

    const reason = "ok";
    const relatedId = 2n;
    const tx = await reputation.connect(updater).update(subject.address, 2, reason, relatedId);

    expect(await reputation.scoreOf(subject.address)).to.equal(2n);

    await expect(tx)
      .to.emit(reputation, "ReputationUpdated")
      .withArgs(subject.address, 2, reason, relatedId);

    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes(reason));
    await expect(tx)
      .to.emit(reputation, "ReputationReason")
      .withArgs(reasonHash, reason);
    await expect(tx)
      .to.emit(reputation, "ReputationEvent")
      .withArgs(subject.address, 2, reasonHash, relatedId, 2, updater.address);
  });
});
