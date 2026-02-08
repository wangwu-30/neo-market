// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title USDC Token Escrow Interface
/// @notice ERC20 USDC-specific escrow operations and events.
interface ITokenEscrow {
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

    struct TokenEscrowInfo {
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
    event EscrowReleased(uint256 indexed escrowId, address indexed agent, uint256 payout, uint256 fee);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 refundAmount);

    /// @notice Returns the USDC token address used for escrow.
    function paymentToken() external view returns (address);

    /// @notice Returns the current protocol fee in basis points.
    function protocolFeeBps() external view returns (uint256);

    /// @notice Funds a new escrow in USDC using safeTransferFrom.
    function fundUSDC(uint256 jobId, uint256 amount, uint64 deliveryDeadline)
        external
        returns (uint256 escrowId);

    /// @notice Releases escrowed funds to the agent and protocol fee to treasury.
    function releaseToAgent(uint256 escrowId) external;

    /// @notice Refunds escrowed funds to the buyer.
    function refundToBuyer(uint256 escrowId) external;

    /// @notice Returns escrow info.
    function getEscrow(uint256 escrowId) external view returns (TokenEscrowInfo memory);
}

