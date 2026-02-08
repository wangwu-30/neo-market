// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ModuleKeys.sol";

contract ModuleRegistry {
    address public owner;
    mapping(bytes32 => address) public modules;

    bytes32 public constant ARBITRATION = ModuleKeys.ARBITRATION;
    bytes32 public constant REPUTATION = ModuleKeys.REPUTATION;
    bytes32 public constant AGENT_REGISTRY = ModuleKeys.AGENT_REGISTRY;
    bytes32 public constant TOKEN_ESCROW = ModuleKeys.TOKEN_ESCROW;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ModuleSet(bytes32 indexed key, address indexed module);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
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

    function setModule(bytes32 key, address module) external onlyOwner {
        modules[key] = module;
        emit ModuleSet(key, module);
    }
}
