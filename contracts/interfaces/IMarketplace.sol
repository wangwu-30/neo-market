// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarketplace {
    enum JobSku {
        ECOM_HERO,
        POSTER,
        SOCIAL_PACK,
        CUSTOM
    }

    enum JobStatus {
        None,
        Open,
        Selected,
        Cancelled,
        Closed,
        Expired
    }

    struct JobInfo {
        uint256 jobId;
        address buyer;
        string jobSpecCID;
        JobSku sku;
        uint256 budget;
        address paymentToken;
        uint64 deadline;
        JobStatus status;
    }

    struct BidInfo {
        uint256 bidId;
        uint256 jobId;
        address agent;
        string bidCID;
        uint256 price;
        uint64 eta;
        uint8 maxRevisions;
    }

    event JobPublished(uint256 indexed jobId, address indexed buyer, string jobSpecCID, uint256 budget);
    event JobPostedEvent(
        uint256 indexed jobId,
        address indexed buyer,
        string jobSpecCID,
        JobSku sku,
        uint256 budget,
        uint64 deadline
    );
    event JobCancelled(uint256 indexed jobId, address indexed buyer);
    event JobExpired(uint256 indexed jobId, address indexed buyer);
    event JobClosed(uint256 indexed jobId, address indexed buyer);
    event BidPlaced(uint256 indexed bidId, uint256 indexed jobId, address indexed agent, uint256 price);
    event BidSelected(uint256 indexed jobId, uint256 indexed bidId, address indexed agent);

    function publishJob(
        string calldata jobSpecCID,
        JobSku sku,
        uint256 budget,
        address paymentToken,
        uint64 deadline
    ) external returns (uint256 jobId);

    function cancelJob(uint256 jobId) external;

    function closeJob(uint256 jobId) external;

    function placeBid(
        uint256 jobId,
        string calldata bidCID,
        uint256 price,
        uint64 eta,
        uint8 maxRevisions
    ) external returns (uint256 bidId);

    function selectBid(uint256 jobId, uint256 bidId) external;

    function getJob(uint256 jobId) external view returns (JobInfo memory);
    function getBid(uint256 bidId) external view returns (BidInfo memory);
}
