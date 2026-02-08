// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EIP-712 Signatures Interface
/// @notice Defines typed data structs and verification helpers for v0 signatures.
/// @dev Note: Solidity interfaces cannot declare constants; typehash constants should live in a library or implementation.
interface ISignatures {
    struct BidSignature {
        uint256 jobId;
        address agent;
        uint256 price;
        uint64 eta;
        string bidCID;
        uint256 nonce;
        uint64 deadline;
    }

    struct DeliveryReceiptSignature {
        uint256 escrowId;
        uint256 jobId;
        address agent;
        string deliveryCID;
        bytes32 deliveryHash;
        uint64 timestamp;
        uint256 nonce;
        uint64 deadline;
    }

    struct DisputeEvidenceSignature {
        uint256 disputeId;
        uint256 escrowId;
        address submitter;
        string evidenceCID;
        bytes32 evidenceHash;
        uint64 timestamp;
        uint256 nonce;
        uint64 deadline;
    }

    /// @notice Returns the EIP-712 domain separator used for hashing.
    function domainSeparator() external view returns (bytes32);

    /// @notice Returns the current nonce for a signer.
    function nonces(address signer) external view returns (uint256);

    /// @notice Hashes a BidSignature struct per EIP-712.
    function hashBid(BidSignature calldata bid) external view returns (bytes32);

    /// @notice Hashes a DeliveryReceiptSignature struct per EIP-712.
    function hashDeliveryReceipt(DeliveryReceiptSignature calldata receipt) external view returns (bytes32);

    /// @notice Hashes a DisputeEvidenceSignature struct per EIP-712.
    function hashDisputeEvidence(DisputeEvidenceSignature calldata evidence) external view returns (bytes32);

    /// @notice Verifies a BidSignature and returns the recovered signer.
    function verifyBidSignature(BidSignature calldata bid, bytes calldata signature)
        external
        view
        returns (address signer);

    /// @notice Verifies a DeliveryReceiptSignature and returns the recovered signer.
    function verifyDeliveryReceiptSignature(DeliveryReceiptSignature calldata receipt, bytes calldata signature)
        external
        view
        returns (address signer);

    /// @notice Verifies a DisputeEvidenceSignature and returns the recovered signer.
    function verifyDisputeEvidenceSignature(DisputeEvidenceSignature calldata evidence, bytes calldata signature)
        external
        view
        returns (address signer);
}
