// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFeeManager {
    event ProtocolFeeUpdated(uint256 feeBps);
    event TreasuryUpdated(address treasury);

    function protocolFeeBps() external view returns (uint256);
    function treasury() external view returns (address);

    function computeFee(uint256 amount) external view returns (uint256 fee, uint256 net);
}

