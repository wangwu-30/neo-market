// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAgentRegistry.sol";
import "./interfaces/IReputation.sol";
import "./interfaces/INeoBadge.sol";
import "./ModuleKeys.sol";

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IFeeManager {
    function getFee(uint256 amount) external view returns (uint256);
    function treasury() external view returns (address);
}

interface IArbitration {
    function createDispute(uint256 escrowId, address opener, string calldata evidenceCID) external returns (uint256 disputeId);
    function rulings(uint256 disputeId) external view returns (uint256);
}

interface IModuleRegistry {
    function modules(bytes32 key) external view returns (address);
}

contract TokenEscrow {
    bytes32 public constant FEE_MANAGER = ModuleKeys.FEE_MANAGER;
    bytes32 public constant TREASURY = ModuleKeys.TREASURY;
    bytes32 public constant ARBITRATION = ModuleKeys.ARBITRATION;
    bytes32 public constant REPUTATION = ModuleKeys.REPUTATION;
    bytes32 public constant AGENT_REGISTRY = ModuleKeys.AGENT_REGISTRY;
    bytes32 public constant NEO_BADGE = ModuleKeys.NEO_BADGE;

    struct Escrow {
        address buyer;
        address agent;
        uint256 amount;
        uint256 deadline;
        bool funded;
        bool delivered;
        bool revisionRequested;
        bool released;
        bool refunded;
        uint8 revisionCount;
        bytes32 deliveryHash;
        bytes32 sowHash; 
        uint256 intentAmount;
        uint8 maxRevisions;
        bool intentFunded;
        string lastRevisionNoteCID;
    }

    IERC20Minimal public immutable usdc;
    IModuleRegistry public immutable moduleRegistry;

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant DELIVERY_RECEIPT_TYPEHASH =
        keccak256(
            "DeliveryReceiptSignature(uint256 escrowId,uint256 jobId,address agent,string deliveryCID,bytes32 deliveryHash,uint64 timestamp,uint256 nonce,uint64 deadline)"
        );

    string public constant EIP712_NAME = "AgentMarket";
    string public constant EIP712_VERSION = "1";

    mapping(address => uint256) public nonces;

    uint256 public constant RULING_BUYER_WINS = 1;
    uint256 public constant RULING_AGENT_WINS = 2;

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    struct Dispute {
        uint256 escrowId;
        address opener;
        bool resolved;
    }

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => uint256) public escrowDisputes;

    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed agent, uint256 amount, uint256 deadline);
    event EscrowFunded(uint256 indexed escrowId);
    event DeliverySubmitted(uint256 indexed escrowId, bytes32 deliveryHash);
    event RevisionRequested(uint256 indexed escrowId, address indexed buyer, string noteCID, uint8 revisionCount);
    event EscrowSettled(uint256 indexed escrowId, uint256 fee, uint256 payoutAmount);
    event EscrowRefunded(uint256 indexed escrowId);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed escrowId, address indexed opener);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed escrowId, uint256 ruling);
    event ModuleMissing(bytes32 indexed key, string action, uint256 indexed relatedId);

    // Indexer-friendly events (legacy events above remain for backward compatibility).
    event EscrowCreatedEvent(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed agent,
        uint256 amount,
        uint256 deadline
    );
    event EscrowFundedEvent(uint256 indexed escrowId, address indexed buyer, address indexed agent, uint256 amount);
    event DeliverySubmittedEvent(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed agent,
        bytes32 deliveryHash
    );
    event RevisionRequestedEvent(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed agent,
        string noteCID,
        uint8 revisionCount
    );
    event EscrowSettledEvent(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed agent,
        uint256 fee,
        uint256 payoutAmount
    );
    event EscrowRefundedEvent(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed agent,
        uint256 amount
    );
    event IntentDepositPaid(uint256 indexed escrowId, uint256 amount);
    event IntentDepositClaimed(uint256 indexed escrowId, address indexed receiver);
    event DisputeOpenedEvent(
        uint256 indexed disputeId,
        uint256 indexed escrowId,
        address indexed opener,
        address buyer,
        address agent
    );
    event DisputeResolvedEvent(
        uint256 indexed disputeId,
        uint256 indexed escrowId,
        uint256 ruling,
        address buyer,
        address agent
    );

    function getEscrowStatus(
        uint256 escrowId
    ) external view returns (
        bool funded,
        bool delivered,
        bool revisionRequested,
        bool released,
        bool refunded,
        uint256 disputeId,
        bool disputeResolved
    ) {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        funded = e.funded;
        delivered = e.delivered;
        revisionRequested = e.revisionRequested;
        released = e.released;
        refunded = e.refunded;
        disputeId = escrowDisputes[escrowId];
        if (disputeId != 0) {
            disputeResolved = disputes[disputeId].resolved;
        }
    }

    constructor(address _usdc, address _moduleRegistry) {
        require(_usdc != address(0), "ZERO_USDC");
        require(_moduleRegistry != address(0), "ZERO_MODULE_REGISTRY");
        usdc = IERC20Minimal(_usdc);
        moduleRegistry = IModuleRegistry(_moduleRegistry);
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

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes(EIP712_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    function createEscrow(address buyer, address agent, uint256 amount, uint256 deadline, uint8 maxRevisions) public returns (uint256) {
        require(buyer != address(0), "ZERO_BUYER");
        require(agent != address(0), "ZERO_AGENT");
        require(amount > 0, "ZERO_AMOUNT");
        require(deadline > block.timestamp, "BAD_DEADLINE");
        _requireActiveAgent(agent);

        escrowCount += 1;
        uint256 escrowId = escrowCount;
        escrows[escrowId] = Escrow({
            buyer: buyer,
            agent: agent,
            amount: amount,
            deadline: deadline,
            funded: false,
            delivered: false,
            revisionRequested: false,
            released: false,
            refunded: false,
            revisionCount: 0,
            deliveryHash: bytes32(0),
            sowHash: bytes32(0),
            intentAmount: 0,
            maxRevisions: maxRevisions,
            intentFunded: false,
            lastRevisionNoteCID: ""
        });

        emit EscrowCreated(escrowId, buyer, agent, amount, deadline);
        emit EscrowCreatedEvent(escrowId, buyer, agent, amount, deadline);
        return escrowId;
    }

    /**
     * @dev Set the Statement of Work hash. This locks the negotiated terms before work begins.
     * Can only be called by the buyer before the escrow is funded.
     */
    function setSowHash(uint256 escrowId, bytes32 sowHash) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(msg.sender == e.buyer, "NOT_BUYER");
        require(!e.funded, "ALREADY_FUNDED");
        require(e.sowHash == bytes32(0), "SOW_ALREADY_SET");
        e.sowHash = sowHash;
    }

    /**
     * @dev Pay an intent deposit (consultation fee) to protect the Agent from "Solution Mining".
     * This amount is locked and will be part of the total payment if the job proceeds.
     */
    function payIntentDeposit(uint256 escrowId, uint256 amount) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(msg.sender == e.buyer, "NOT_BUYER");
        require(!e.intentFunded, "INTENT_ALREADY_PAID");
        require(amount <= e.amount, "EXCEEDS_TOTAL");

        usdc.transferFrom(e.buyer, address(this), amount);
        e.intentAmount = amount;
        e.intentFunded = true;
        emit IntentDepositPaid(escrowId, amount);
    }

    /**
     * @dev Allows the Agent to claim the intent deposit if the negotiation fails or buyer cancels.
     * This serves as the "Consultation Fee" for the Agent's effort in providing a proposal.
     * Requires the buyer to explicitly cancel or a timeout.
     */
    function claimIntentDeposit(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.agent == msg.sender, "NOT_AGENT");
        require(e.intentFunded, "NO_INTENT_DEPOSIT");
        require(!e.funded, "ALREADY_FULLY_FUNDED");
        
        // In a real scenario, we might want a cooldown or buyer consent.
        // For Alpha, we allow Agent to claim if negotiation doesn't move to full funding.
        e.intentFunded = false;
        e.refunded = true; // Mark as resolved
        usdc.transfer(e.agent, e.intentAmount);
        emit IntentDepositClaimed(escrowId, e.agent);
    }

    function fund(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(!e.funded, "ALREADY_FUNDED");
        require(!e.refunded, "REFUNDED");
        
        uint256 remainingAmount = e.amount - e.intentAmount;
        if (remainingAmount > 0) {
            usdc.transferFrom(e.buyer, address(this), remainingAmount);
        }
        e.funded = true;
        emit EscrowFunded(escrowId);
        emit EscrowFundedEvent(escrowId, e.buyer, e.agent, e.amount);
    }

    function submitDelivery(DeliveryReceiptSignature calldata receipt, bytes calldata signature) external {
        Escrow storage e = escrows[receipt.escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(e.funded, "NOT_FUNDED");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "REFUNDED");
        require(!e.delivered || e.revisionRequested, "ALREADY_DELIVERED");
        require(receipt.deadline >= block.timestamp, "SIG_EXPIRED");
        require(receipt.nonce == nonces[receipt.agent], "BAD_NONCE");
        require(receipt.agent == e.agent, "NOT_AGENT");

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), _hashDeliveryReceipt(receipt)));
        address signer = _recoverSigner(digest, signature);
        require(signer == receipt.agent, "BAD_SIG");

        nonces[receipt.agent] += 1;
        e.delivered = true;
        if (e.revisionRequested) {
            e.revisionRequested = false;
        }
        e.deliveryHash = receipt.deliveryHash;
        emit DeliverySubmitted(receipt.escrowId, receipt.deliveryHash);
        emit DeliverySubmittedEvent(receipt.escrowId, e.buyer, e.agent, receipt.deliveryHash);
    }

    function requestRevision(uint256 escrowId, string calldata noteCID) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(e.funded, "NOT_FUNDED");
        require(e.delivered, "NOT_DELIVERED");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "REFUNDED");
        require(escrowDisputes[escrowId] == 0, "DISPUTED");
        require(msg.sender == e.buyer, "NOT_BUYER");
        require(bytes(noteCID).length > 0, "EMPTY_NOTE");
        require(!e.revisionRequested, "REVISION_PENDING");
        require(e.revisionCount < e.maxRevisions, "REVISION_LIMIT");

        e.revisionRequested = true;
        e.revisionCount += 1;
        e.lastRevisionNoteCID = noteCID;

        emit RevisionRequested(escrowId, e.buyer, noteCID, e.revisionCount);
        emit RevisionRequestedEvent(escrowId, e.buyer, e.agent, noteCID, e.revisionCount);
    }

    function accept(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(e.funded, "NOT_FUNDED");
        require(e.delivered, "NOT_DELIVERED");
        require(!e.revisionRequested, "REVISION_PENDING");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "REFUNDED");
        require(escrowDisputes[escrowId] == 0, "DISPUTED");
        require(msg.sender == e.buyer, "NOT_BUYER");
        // If AgentRegistry is configured, ensure the agent is still active before payout.
        _requireActiveAgent(e.agent);

        e.released = true;

        address feeManagerAddress = moduleRegistry.modules(FEE_MANAGER);
        require(feeManagerAddress != address(0), "ZERO_FEE_MANAGER");
        IFeeManager feeManager = IFeeManager(feeManagerAddress);

        uint256 fee = feeManager.getFee(e.amount);
        uint256 payoutAmount = e.amount - fee;

        address treasury = moduleRegistry.modules(TREASURY);
        if (treasury == address(0)) {
            treasury = feeManager.treasury();
        }
        if (fee > 0) {
            usdc.transfer(treasury, fee);
        }
        usdc.transfer(e.agent, payoutAmount);

        emit EscrowSettled(escrowId, fee, payoutAmount);
        emit EscrowSettledEvent(escrowId, e.buyer, e.agent, fee, payoutAmount);
        _updateReputation(e.agent, 1, "accept", escrowId);
        _mintDualBadges(e.buyer, e.agent, escrowId);
    }

    function refundOnTimeout(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(e.funded, "NOT_FUNDED");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "ALREADY_REFUNDED");
        require(escrowDisputes[escrowId] == 0, "DISPUTED");
        require(block.timestamp > e.deadline, "NOT_TIMEOUT");

        e.refunded = true;
        usdc.transfer(e.buyer, e.amount);

        emit EscrowRefunded(escrowId);
        emit EscrowRefundedEvent(escrowId, e.buyer, e.agent, e.amount);
    }

    function openDispute(uint256 escrowId, string calldata evidenceCID) external returns (uint256 disputeId) {
        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "NO_ESCROW");
        require(e.funded, "NOT_FUNDED");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "ALREADY_REFUNDED");
        require(e.delivered || block.timestamp > e.deadline, "DISPUTE_NOT_AVAILABLE");
        require(escrowDisputes[escrowId] == 0, "DISPUTE_EXISTS");
        require(msg.sender == e.buyer || msg.sender == e.agent, "NOT_PARTY");

        address arbitration = moduleRegistry.modules(ARBITRATION);
        if (arbitration == address(0)) {
            emit ModuleMissing(ARBITRATION, "openDispute", escrowId);
            return 0;
        }

        disputeId = IArbitration(arbitration).createDispute(escrowId, msg.sender, evidenceCID);
        require(disputeId != 0, "BAD_DISPUTE_ID");

        disputes[disputeId] = Dispute({escrowId: escrowId, opener: msg.sender, resolved: false});
        escrowDisputes[escrowId] = disputeId;

        emit DisputeOpened(disputeId, escrowId, msg.sender);
        emit DisputeOpenedEvent(disputeId, escrowId, msg.sender, e.buyer, e.agent);
    }

    function executeRuling(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.escrowId != 0, "NO_DISPUTE");
        require(!dispute.resolved, "ALREADY_RESOLVED");

        address arbitration = moduleRegistry.modules(ARBITRATION);
        if (arbitration == address(0)) {
            emit ModuleMissing(ARBITRATION, "executeRuling", disputeId);
            return;
        }
        require(msg.sender == arbitration, "NOT_ARBITRATION");

        uint256 ruling = IArbitration(arbitration).rulings(disputeId);
        require(ruling != 0, "NO_RULING");

        Escrow storage e = escrows[dispute.escrowId];
        require(e.funded, "NOT_FUNDED");
        require(!e.released, "ALREADY_RELEASED");
        require(!e.refunded, "ALREADY_REFUNDED");

        dispute.resolved = true;

        if (ruling == RULING_AGENT_WINS) {
            e.released = true;

            address feeManagerAddress = moduleRegistry.modules(FEE_MANAGER);
            require(feeManagerAddress != address(0), "ZERO_FEE_MANAGER");
            IFeeManager feeManager = IFeeManager(feeManagerAddress);

            uint256 fee = feeManager.getFee(e.amount);
            uint256 payoutAmount = e.amount - fee;

            address treasury = moduleRegistry.modules(TREASURY);
            if (treasury == address(0)) {
                treasury = feeManager.treasury();
            }
            if (fee > 0) {
                usdc.transfer(treasury, fee);
            }
            usdc.transfer(e.agent, payoutAmount);

            emit EscrowSettled(dispute.escrowId, fee, payoutAmount);
            emit EscrowSettledEvent(dispute.escrowId, e.buyer, e.agent, fee, payoutAmount);
            _updateReputation(e.agent, 1, "agent_win", dispute.escrowId);
            _mintDualBadges(e.buyer, e.agent, dispute.escrowId);
        } else if (ruling == RULING_BUYER_WINS) {
            e.refunded = true;
            usdc.transfer(e.buyer, e.amount);
            emit EscrowRefunded(dispute.escrowId);
            emit EscrowRefundedEvent(dispute.escrowId, e.buyer, e.agent, e.amount);
            _updateReputation(e.agent, -1, "buyer_win", dispute.escrowId);
        } else {
            revert("BAD_RULING");
        }

        emit DisputeResolved(disputeId, dispute.escrowId, ruling);
        emit DisputeResolvedEvent(disputeId, dispute.escrowId, ruling, e.buyer, e.agent);
    }

    function _hashDeliveryReceipt(DeliveryReceiptSignature calldata receipt) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DELIVERY_RECEIPT_TYPEHASH,
                receipt.escrowId,
                receipt.jobId,
                receipt.agent,
                keccak256(bytes(receipt.deliveryCID)),
                receipt.deliveryHash,
                receipt.timestamp,
                receipt.nonce,
                receipt.deadline
            )
        );
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "BAD_SIG_LEN");
        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "BAD_SIG_V");
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0, "BAD_SIG_S");
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "BAD_SIG");
        return signer;
    }

    function _updateReputation(address subject, int256 delta, string memory reason, uint256 relatedId) internal {
        address reputation = moduleRegistry.modules(REPUTATION);
        if (reputation == address(0)) {
            emit ModuleMissing(REPUTATION, "updateReputation", relatedId);
            return;
        }
        IReputation(reputation).update(subject, delta, reason, relatedId);
    }

    function _mintDualBadges(address buyer, address agent, uint256 escrowId) internal {
        address badgeAddress = moduleRegistry.modules(NEO_BADGE);
        if (badgeAddress == address(0)) {
            emit ModuleMissing(NEO_BADGE, "mintBadge", escrowId);
            return;
        }

        string memory baseUri = "https://neo-market.com/badges/";
        string memory idStr = _toString(escrowId);

        // Mint Provider Badge
        try INeoBadge(badgeAddress).mint(
            agent, 
            INeoBadge.BadgeCategory.Provider, 
            string(abi.encodePacked(baseUri, "provider/", idStr))
        ) {} catch {
            emit ModuleMissing(NEO_BADGE, "mintProviderBadge_failed", escrowId);
        }

        // Mint Requester Badge
        try INeoBadge(badgeAddress).mint(
            buyer, 
            INeoBadge.BadgeCategory.Requester, 
            string(abi.encodePacked(baseUri, "requester/", idStr))
        ) {} catch {
            emit ModuleMissing(NEO_BADGE, "mintRequesterBadge_failed", escrowId);
        }
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _requireActiveAgent(address agent) internal view {
        // If no agent registry is configured, skip validation for compatibility.
        address agentRegistry = moduleRegistry.modules(AGENT_REGISTRY);
        if (agentRegistry == address(0)) {
            return;
        }
        IAgentRegistry.AgentInfo memory info = IAgentRegistry(agentRegistry).getAgent(agent);
        require(info.status == IAgentRegistry.AgentStatus.Active, "AGENT_NOT_ACTIVE");
    }
}
