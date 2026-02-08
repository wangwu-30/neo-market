// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IAgentRegistry } from "./interfaces/IAgentRegistry.sol";

contract AgentRegistry is IAgentRegistry {
    address public owner;

    mapping(address => string) public manifestOf;
    mapping(address => uint256) public stakeOf;
    mapping(address => AgentStatus) public statusOf;
    mapping(address => uint256) public reputationOf;

    bool public stakeEnabled;
    uint256 public minStake;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StakeGateUpdated(bool enabled, uint256 minStake);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyAgent() {
        require(statusOf[msg.sender] != AgentStatus.None, "NOT_AGENT");
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

    function setMinStake(uint256 newMinStake) external onlyOwner {
        minStake = newMinStake;
        emit StakeGateUpdated(stakeEnabled, newMinStake);
    }

    function setStakeEnabled(bool enabled) external onlyOwner {
        stakeEnabled = enabled;
        emit StakeGateUpdated(enabled, minStake);
    }

    function register(string calldata manifestCID) external payable override {
        if (stakeEnabled) {
            require(msg.value >= minStake, "INSUFFICIENT_STAKE");
        }

        manifestOf[msg.sender] = manifestCID;
        stakeOf[msg.sender] += msg.value;

        if (statusOf[msg.sender] == AgentStatus.None) {
            statusOf[msg.sender] = AgentStatus.Active;
            emit AgentStatusChanged(msg.sender, AgentStatus.Active);
        }

        emit AgentRegistered(msg.sender, manifestCID, stakeOf[msg.sender]);
    }

    function updateManifest(string calldata manifestCID) external override onlyAgent {
        manifestOf[msg.sender] = manifestCID;
        emit AgentUpdated(msg.sender, manifestCID);
    }

    function setStatus(address agent, AgentStatus status) external override onlyOwner {
        statusOf[agent] = status;
        emit AgentStatusChanged(agent, status);
    }

    function addStake() external payable override onlyAgent {
        require(msg.value > 0, "ZERO_STAKE");
        stakeOf[msg.sender] += msg.value;
        emit AgentStakeChanged(msg.sender, stakeOf[msg.sender]);
    }

    function withdrawStake(uint256 amount) external override onlyAgent {
        require(amount > 0, "ZERO_AMOUNT");
        require(stakeOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        stakeOf[msg.sender] -= amount;

        (bool sent, ) = msg.sender.call{ value: amount }("");
        require(sent, "TRANSFER_FAILED");

        emit AgentStakeChanged(msg.sender, stakeOf[msg.sender]);
    }

    function getAgent(address agent) external view override returns (AgentInfo memory) {
        return AgentInfo({
            agent: agent,
            manifestCID: manifestOf[agent],
            stake: stakeOf[agent],
            reputationScore: reputationOf[agent],
            status: statusOf[agent]
        });
    }
}
