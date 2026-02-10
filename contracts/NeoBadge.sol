// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NeoBadge
 * @dev Soulbound Token (SBT) for Neo Market Honor system. 
 * Represents proof of successful collaboration. Non-transferable.
 */
contract NeoBadge {
    string public name = "Neo Market Honor Badge";
    string public symbol = "NEOB";
    
    enum BadgeCategory { Provider, Requester }

    struct BadgeInfo {
        address owner;
        BadgeCategory category;
        string uri;
    }

    mapping(uint256 => BadgeInfo) private _badges;
    mapping(address => uint256) private _balances;
    
    uint256 private _nextTokenId;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event BadgeMinted(uint256 indexed tokenId, address indexed to, BadgeCategory category, string uri);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @dev Mint a new badge. Only the contract owner (Escrow contract) can call this.
     */
    function mint(address to, BadgeCategory category, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _badges[tokenId] = BadgeInfo({
            owner: to,
            category: category,
            uri: uri
        });
        _balances[to]++;
        
        emit Transfer(address(0), to, tokenId);
        emit BadgeMinted(tokenId, to, category, uri);
        return tokenId;
    }

    function getBadge(uint256 tokenId) external view returns (address ownerAddr, BadgeCategory category, string memory uri) {
        BadgeInfo storage b = _badges[tokenId];
        require(b.owner != address(0), "Nonexistent token");
        return (b.owner, b.category, b.uri);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_badges[tokenId].owner != address(0), "Nonexistent token");
        return _badges[tokenId].uri;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _badges[tokenId].owner;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev Disable transfers to make it Soulbound.
     */
    function transferFrom(address, address, uint256) external pure {
        revert("Soulbound: Transfer disabled");
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert("Soulbound: Transfer disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert("Soulbound: Transfer disabled");
    }

    function approve(address, uint256) external pure {
        revert("Soulbound: Approval disabled");
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function setApprovalForAll(address, bool) external pure {
        revert("Soulbound: Approval disabled");
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
