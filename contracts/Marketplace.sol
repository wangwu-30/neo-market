// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMarketplace.sol";
import "./interfaces/IAgentRegistry.sol";
import "./ModuleKeys.sol";

interface IModuleRegistry {
    function modules(bytes32 key) external view returns (address);
}

interface ITokenEscrowMinimal {
    function usdc() external view returns (address);
    function createEscrow(address buyer, address agent, uint256 amount, uint256 deadline, uint8 maxRevisions) external returns (uint256);
    function fund(uint256 escrowId) external;

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
    );
}

contract Marketplace is IMarketplace {
    bytes32 public constant AGENT_REGISTRY = ModuleKeys.AGENT_REGISTRY;
    bytes32 public constant TOKEN_ESCROW = ModuleKeys.TOKEN_ESCROW;

    IModuleRegistry public immutable moduleRegistry;

    uint256 public jobCount;
    uint256 public bidCount;

    uint256 public constant CUSTOM_BUDGET_FLOOR = 100 * 1_000_000;

    mapping(uint256 => JobInfo) private jobs;
    mapping(uint256 => BidInfo) private bids;
    mapping(uint256 => uint256) public selectedBidOf;
    mapping(uint256 => uint256) public escrowOf;

    // Indexer-friendly events (legacy events remain for backward compatibility).
    event JobPublishedEvent(
        uint256 indexed jobId,
        address indexed buyer,
        string jobSpecCID,
        uint256 budget,
        address paymentToken,
        uint64 deadline
    );
    event JobCancelledEvent(uint256 indexed jobId, address indexed buyer);
    event JobExpiredEvent(uint256 indexed jobId, address indexed buyer);
    event JobClosedEvent(uint256 indexed jobId, address indexed buyer, uint256 escrowId);
    event BidPlacedEvent(
        uint256 indexed bidId,
        uint256 indexed jobId,
        address indexed agent,
        string bidCID,
        uint256 price,
        uint64 eta
    );
    event BidSelectedEvent(
        uint256 indexed jobId,
        uint256 indexed bidId,
        address indexed agent,
        address buyer,
        uint256 price,
        uint256 escrowId
    );

    constructor(address _moduleRegistry) {
        require(_moduleRegistry != address(0), "ZERO_MODULE_REGISTRY");
        moduleRegistry = IModuleRegistry(_moduleRegistry);
    }

    function publishJob(
        string calldata jobSpecCID,
        JobSku sku,
        uint256 budget,
        address paymentToken,
        uint64 deadline
    ) external returns (uint256 jobId) {
        require(bytes(jobSpecCID).length > 0, "EMPTY_JOB_SPEC");
        require(budget > 0, "ZERO_BUDGET");
        require(deadline > block.timestamp, "BAD_DEADLINE");
        if (sku == JobSku.CUSTOM) {
            require(budget >= CUSTOM_BUDGET_FLOOR, "CUSTOM_BUDGET_TOO_LOW");
        }

        address escrowAddress = moduleRegistry.modules(TOKEN_ESCROW);
        require(escrowAddress != address(0), "ZERO_ESCROW");
        address usdc = ITokenEscrowMinimal(escrowAddress).usdc();
        require(paymentToken == usdc, "NOT_USDC");

        jobCount += 1;
        jobId = jobCount;
        jobs[jobId] = JobInfo({
            jobId: jobId,
            buyer: msg.sender,
            jobSpecCID: jobSpecCID,
            sku: sku,
            budget: budget,
            paymentToken: paymentToken,
            deadline: deadline,
            status: JobStatus.Open
        });

        emit JobPublished(jobId, msg.sender, jobSpecCID, budget);
        emit JobPublishedEvent(jobId, msg.sender, jobSpecCID, budget, paymentToken, deadline);
        emit JobPostedEvent(jobId, msg.sender, jobSpecCID, sku, budget, deadline);
    }

    function cancelJob(uint256 jobId) external {
        JobInfo storage job = jobs[jobId];
        require(job.buyer != address(0), "NO_JOB");
        require(msg.sender == job.buyer, "NOT_BUYER");
        if (_expireIfNeeded(jobId, job)) {
            return;
        }
        require(job.status == JobStatus.Open, "NOT_OPEN");

        job.status = JobStatus.Cancelled;
        emit JobCancelled(jobId, msg.sender);
        emit JobCancelledEvent(jobId, msg.sender);
    }

    function closeJob(uint256 jobId) external {
        JobInfo storage job = jobs[jobId];
        require(job.buyer != address(0), "NO_JOB");
        require(msg.sender == job.buyer, "NOT_BUYER");

        // Allow closing only when job is already in a terminal state
        // or when escrow has been released/refunded (or dispute resolved).
        if (job.status == JobStatus.Open) {
            // Closing an open job is not allowed; caller should cancel instead.
            if (_expireIfNeeded(jobId, job)) {
                return;
            }
            revert("NOT_FINALIZABLE");
        }

        if (job.status == JobStatus.Selected) {
            uint256 escrowId = escrowOf[jobId];
            require(escrowId != 0, "NO_ESCROW");

            address escrowAddress = moduleRegistry.modules(TOKEN_ESCROW);
            require(escrowAddress != address(0), "ZERO_ESCROW");

            (
                ,
                ,
                ,
                bool released,
                bool refunded,
                uint256 disputeId,
                bool disputeResolved
            ) = ITokenEscrowMinimal(escrowAddress).getEscrowStatus(escrowId);

            bool ok = released || refunded || (disputeId != 0 && disputeResolved);
            require(ok, "ESCROW_NOT_FINAL");

            job.status = JobStatus.Closed;
            emit JobClosed(jobId, job.buyer);
            emit JobClosedEvent(jobId, job.buyer, escrowId);
            return;
        }

        // Cancelled/Expired are already terminal; allow buyer to set Closed for consistency.
        if (job.status == JobStatus.Cancelled || job.status == JobStatus.Expired) {
            job.status = JobStatus.Closed;
            emit JobClosed(jobId, job.buyer);
            emit JobClosedEvent(jobId, job.buyer, escrowOf[jobId]);
            return;
        }

        // Already closed.
        if (job.status == JobStatus.Closed) {
            revert("ALREADY_CLOSED");
        }

        revert("NOT_FINALIZABLE");
    }

    function placeBid(
        uint256 jobId,
        string calldata bidCID,
        uint256 price,
        uint64 eta,
        uint8 maxRevisions
    ) external returns (uint256 bidId) {
        JobInfo storage job = jobs[jobId];
        require(job.buyer != address(0), "NO_JOB");
        if (_expireIfNeeded(jobId, job)) {
            return 0;
        }
        require(job.status == JobStatus.Open, "NOT_OPEN");
        require(bytes(bidCID).length > 0, "EMPTY_BID");
        require(price > 0, "ZERO_PRICE");
        require(price <= job.budget, "OVER_BUDGET");
        require(eta > 0, "BAD_ETA");
        _requireActiveAgent(msg.sender);

        bidCount += 1;
        bidId = bidCount;
        bids[bidId] = BidInfo({
            bidId: bidId,
            jobId: jobId,
            agent: msg.sender,
            bidCID: bidCID,
            price: price,
            eta: eta,
            maxRevisions: maxRevisions
        });

        emit BidPlaced(bidId, jobId, msg.sender, price);
        emit BidPlacedEvent(bidId, jobId, msg.sender, bidCID, price, eta);
    }

    function selectBid(uint256 jobId, uint256 bidId) external {
        JobInfo storage job = jobs[jobId];
        require(job.buyer != address(0), "NO_JOB");
        require(msg.sender == job.buyer, "NOT_BUYER");
        if (_expireIfNeeded(jobId, job)) {
            return;
        }
        require(job.status == JobStatus.Open, "NOT_OPEN");

        BidInfo storage bid = bids[bidId];
        require(bid.bidId != 0, "NO_BID");
        require(bid.jobId == jobId, "BID_MISMATCH");

        job.status = JobStatus.Selected;
        selectedBidOf[jobId] = bidId;

        address escrowAddress = moduleRegistry.modules(TOKEN_ESCROW);
        require(escrowAddress != address(0), "ZERO_ESCROW");
        uint256 escrowId = ITokenEscrowMinimal(escrowAddress).createEscrow(
            job.buyer,
            bid.agent,
            bid.price,
            job.deadline,
            bid.maxRevisions
        );
        escrowOf[jobId] = escrowId;
        ITokenEscrowMinimal(escrowAddress).fund(escrowId);

        emit BidSelected(jobId, bidId, bid.agent);
        emit BidSelectedEvent(jobId, bidId, bid.agent, job.buyer, bid.price, escrowId);
    }

    function getJob(uint256 jobId) external view returns (JobInfo memory) {
        JobInfo memory job = jobs[jobId];
        if (job.status == JobStatus.Open && block.timestamp > job.deadline) {
            job.status = JobStatus.Expired;
        }
        return job;
    }

    function getBid(uint256 bidId) external view returns (BidInfo memory) {
        return bids[bidId];
    }

    function _requireActiveAgent(address agent) internal view {
        address agentRegistry = moduleRegistry.modules(AGENT_REGISTRY);
        require(agentRegistry != address(0), "AGENT_REGISTRY_MISSING");
        IAgentRegistry.AgentInfo memory info = IAgentRegistry(agentRegistry).getAgent(agent);
        require(info.status == IAgentRegistry.AgentStatus.Active, "AGENT_NOT_ACTIVE");
    }

    function _expireIfNeeded(uint256 jobId, JobInfo storage job) internal returns (bool) {
        if (job.status == JobStatus.Open && block.timestamp > job.deadline) {
            job.status = JobStatus.Expired;
            emit JobExpired(jobId, job.buyer);
            emit JobExpiredEvent(jobId, job.buyer);
            return true;
        }
        if (job.status == JobStatus.Expired) {
            revert("JOB_EXPIRED");
        }
        return false;
    }
}
