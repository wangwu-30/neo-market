// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FeeManager
 * @dev Manages protocol fees. Pivoted to flat fees to comply with 
 * regulations regarding transaction-volume-based commission.
 */
contract FeeManager {
    uint256 public flatFee; // Flat fee in USDC (e.g., 2,000,000 for 2 USDC)
    address public treasury;
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FlatFeeUpdated(uint256 newFee);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(uint256 _flatFee, address _treasury) {
        require(_treasury != address(0), "ZERO_TREASURY");
        flatFee = _flatFee;
        treasury = _treasury;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @dev Returns the fee for a given amount. Now ignores amount and returns flatFee.
     */
    function getFee(uint256 /* amount */) external view returns (uint256) {
        return flatFee;
    }
    
    /**
     * @dev Backwards compatibility for TokenEscrow v1.
     */
    function feeBps() external pure returns (uint16) {
        return 0; 
    }

    function setFlatFee(uint256 _flatFee) external onlyOwner {
        flatFee = _flatFee;
        emit FlatFeeUpdated(_flatFee);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ZERO_TREASURY");
        treasury = _treasury;
    }
}
