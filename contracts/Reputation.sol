// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IReputation.sol";

contract Reputation is IReputation {
    mapping(address => int256) public scoreOf;
    mapping(bytes32 => bool) public knownReason;
    address public owner;
    address public updater;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event UpdaterUpdated(address indexed previousUpdater, address indexed newUpdater);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyUpdater() {
        require(msg.sender == updater, "NOT_UPDATER");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setUpdater(address newUpdater) external onlyOwner {
        emit UpdaterUpdated(updater, newUpdater);
        updater = newUpdater;
    }

    function update(
        address subject,
        int256 delta,
        string calldata reason,
        uint256 relatedId
    ) external onlyUpdater {
        int256 newScore = scoreOf[subject] + delta;
        scoreOf[subject] = newScore;

        bytes32 reasonHash = keccak256(bytes(reason));
        if (!knownReason[reasonHash]) {
            knownReason[reasonHash] = true;
            emit ReputationReason(reasonHash, reason);
        }

        emit ReputationUpdated(subject, delta, reason, relatedId);
        emit ReputationEvent(
            subject,
            delta,
            reasonHash,
            relatedId,
            newScore,
            msg.sender
        );
    }
}
