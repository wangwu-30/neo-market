// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FeeManager {
    uint16 public feeBps;
    address public treasury;
    uint256 public minFee;
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(uint16 _feeBps, address _treasury) {
        require(_treasury != address(0), "ZERO_TREASURY");
        feeBps = _feeBps;
        treasury = _treasury;
        minFee = 1e6; // Default min fee (1 USDC)
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function getFee(uint256 amount) external view returns (uint256) {
        uint256 calculated = (amount * feeBps) / 10000;
        if (calculated < minFee) {
            return minFee;
        }
        return calculated;
    }

    function setMinFee(uint256 _minFee) external onlyOwner {
        minFee = _minFee;
    }
}
