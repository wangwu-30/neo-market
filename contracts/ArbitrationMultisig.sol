// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IArbitration.sol";

interface ITokenEscrowExecute {
    function executeRuling(uint256 disputeId) external;
}

contract ArbitrationMultisig is IArbitration {
    address public owner;
    uint256 public disputeCount;

    struct Dispute {
        uint256 escrowId;
        address opener;
        string evidenceCID;
    }

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => uint256) public rulings;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "ZERO_OWNER");
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function createDispute(uint256 escrowId, address opener, string calldata evidenceCID)
        external
        returns (uint256 disputeId)
    {
        require(escrowId != 0, "BAD_ESCROW");
        require(opener != address(0), "ZERO_OPENER");
        disputeCount += 1;
        disputeId = disputeCount;
        disputes[disputeId] = Dispute({escrowId: escrowId, opener: opener, evidenceCID: evidenceCID});
        emit DisputeCreated(disputeId, escrowId, opener, evidenceCID);
    }

    function rule(uint256 disputeId, uint256 ruling) external onlyOwner {
        require(disputes[disputeId].escrowId != 0, "NO_DISPUTE");
        require(ruling != 0, "BAD_RULING");
        require(rulings[disputeId] == 0, "ALREADY_RULED");
        rulings[disputeId] = ruling;
        emit RulingGiven(disputeId, ruling);
    }

    function executeRuling(address escrow, uint256 disputeId) external onlyOwner {
        require(escrow != address(0), "ZERO_ESCROW");
        require(rulings[disputeId] != 0, "NO_RULING");
        ITokenEscrowExecute(escrow).executeRuling(disputeId);
    }
}
