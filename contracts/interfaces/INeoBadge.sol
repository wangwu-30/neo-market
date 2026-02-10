// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INeoBadge {
    enum BadgeCategory { Provider, Requester }
    function mint(address to, BadgeCategory category, string calldata uri) external returns (uint256);
}
