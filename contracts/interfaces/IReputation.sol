// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputation {
    // Legacy event with raw reason string. Prefer ReputationEvent for indexing.
    event ReputationUpdated(address indexed subject, int256 delta, string reason, uint256 relatedId);
    // Emitted when a reason hash is first seen, allowing indexers to map hash -> reason.
    // reasonHash equals keccak256(bytes(reason)).
    event ReputationReason(bytes32 indexed reasonHash, string reason);
    // Standardized event for indexers (reason hashed for stable filtering).
    // relatedId is module-defined (e.g. TokenEscrow uses escrowId).
    event ReputationEvent(
        address indexed subject,
        int256 delta,
        bytes32 indexed reasonHash,
        uint256 indexed relatedId,
        int256 newScore,
        address updater
    );

    function update(address subject, int256 delta, string calldata reason, uint256 relatedId) external;

    function scoreOf(address subject) external view returns (int256);
}
