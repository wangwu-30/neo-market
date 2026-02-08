// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEscrow {
    enum EscrowStatus {
        None,
        Funded,
        Delivered,
        Accepted,
        Rejected,
        Disputed,
        Resolved,
        Refunded
    }

    struct EscrowInfo {
        uint256 escrowId;
        uint256 jobId;
        address buyer;
        address agent;
        uint256 amount;
        address paymentToken;
        EscrowStatus status;
        uint64 fundedAt;
        uint64 deliveryDeadline;
    }

    event EscrowFunded(uint256 indexed escrowId, uint256 indexed jobId, address indexed buyer, uint256 amount);
    event DeliverySubmitted(uint256 indexed escrowId, string deliveryCID, bytes32 receiptHash);
    event DeliveryAccepted(uint256 indexed escrowId, address indexed buyer);
    event DeliveryRejected(uint256 indexed escrowId, address indexed buyer, string reasonCID);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed escrowId, address indexed opener);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed escrowId, uint256 ruling);
    event EscrowSettled(uint256 indexed escrowId, address indexed agent, uint256 payout, uint256 fee);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 refundAmount);

    function fund(uint256 jobId, uint256 amount, address paymentToken, uint64 deliveryDeadline)
        external
        returns (uint256 escrowId);

    function submitDelivery(
        uint256 escrowId,
        string calldata deliveryCID,
        bytes32 receiptHash,
        bytes calldata agentSignature
    ) external;

    function accept(uint256 escrowId) external;
    function reject(uint256 escrowId, string calldata reasonCID) external;

    function openDispute(uint256 escrowId, string calldata evidenceCID) external returns (uint256 disputeId);

    function executeRuling(uint256 disputeId, uint256 ruling) external;

    function refundOnTimeout(uint256 escrowId) external;

    function getEscrow(uint256 escrowId) external view returns (EscrowInfo memory);
}

