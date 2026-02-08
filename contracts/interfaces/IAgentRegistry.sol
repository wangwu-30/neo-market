// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentRegistry {
    enum AgentStatus {
        None,
        Active,
        Suspended
    }

    struct AgentInfo {
        address agent;
        string manifestCID;
        uint256 stake;
        uint256 reputationScore;
        AgentStatus status;
    }

    event AgentRegistered(address indexed agent, string manifestCID, uint256 stake);
    event AgentUpdated(address indexed agent, string manifestCID);
    event AgentStatusChanged(address indexed agent, AgentStatus status);
    event AgentStakeChanged(address indexed agent, uint256 newStake);

    function register(string calldata manifestCID) external payable;
    function updateManifest(string calldata manifestCID) external;
    function setStatus(address agent, AgentStatus status) external;
    function addStake() external payable;
    function withdrawStake(uint256 amount) external;
    function getAgent(address agent) external view returns (AgentInfo memory);
}

