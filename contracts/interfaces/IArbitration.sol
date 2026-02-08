// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitration {
    event DisputeCreated(uint256 indexed disputeId, uint256 indexed escrowId, address indexed opener, string evidenceCID);
    event RulingGiven(uint256 indexed disputeId, uint256 ruling);

    function createDispute(uint256 escrowId, address opener, string calldata evidenceCID)
        external
        returns (uint256 disputeId);

    function rule(uint256 disputeId, uint256 ruling) external;

    function rulings(uint256 disputeId) external view returns (uint256);
}
