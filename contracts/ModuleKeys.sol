// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ModuleKeys {
    bytes32 internal constant FEE_MANAGER = keccak256("FEE_MANAGER");
    bytes32 internal constant TREASURY = keccak256("TREASURY");
    bytes32 internal constant ARBITRATION = keccak256("ARBITRATION");
    bytes32 internal constant REPUTATION = keccak256("REPUTATION");
    bytes32 internal constant AGENT_REGISTRY = keccak256("AGENT_REGISTRY");
    bytes32 internal constant TOKEN_ESCROW = keccak256("TOKEN_ESCROW");
}
