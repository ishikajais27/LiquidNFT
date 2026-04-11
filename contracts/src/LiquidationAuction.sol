// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./NFTEscrow.sol";

contract LiquidationAuction is Ownable, ReentrancyGuard {
    NFTEscrow public nftEscrow;
    address public loanManager;

    uint256 public constant AUCTION_DURATION = 24 hours;

    struct Auction {
        uint256 loanId;
        bytes32 escrowId;
        address lender;        // receives proceeds up to principal
        uint256 minBid;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool settled;
    }

    uint256 public auctionCount;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    event AuctionStarted(uint256 indexed auctionId, uint256 loanId, uint256 minBid, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount);
    event BidRefunded(uint256 indexed auctionId, address bidder, uint256 amount);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }

    constructor(address _nftEscrow) Ownable(msg.sender) {
        nftEscrow = NFTEscrow(_nftEscrow);
    }

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    function startAuction(uint256 loanId, bytes32 escrowId, address lender, uint256 minBid) external onlyLoanManager returns (uint256 auctionId) {
        auctionId = auctionCount++;
        auctions[auctionId] = Auction({
            loanId: loanId,
            escrowId: escrowId,
            lender: lender,
            minBid: minBid,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + AUCTION_DURATION,
            settled: false
        });
        emit AuctionStarted(auctionId, loanId, minBid, auctions[auctionId].endTime);
    }

    function placeBid(uint256 auctionId) external payable nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp < a.endTime, "Auction ended");
        require(!a.settled, "Already settled");
        require(msg.value >= a.minBid, "Below min bid");
        require(msg.value > a.highestBid, "Bid too low");

        if (a.highestBidder != address(0)) {
            pendingReturns[auctionId][a.highestBidder] += a.highestBid;
        }

        a.highestBid = msg.value;
        a.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    function settleAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.endTime, "Auction not ended");
        require(!a.settled, "Already settled");
        a.settled = true;

        if (a.highestBidder != address(0)) {
            // Transfer NFT to winner
            nftEscrow.liquidateNFT(a.escrowId, a.highestBidder);
            // Pay lender
            payable(a.lender).transfer(a.highestBid);
            emit AuctionSettled(auctionId, a.highestBidder, a.highestBid);
        } else {
            // No bids — NFT returns to lender
            nftEscrow.liquidateNFT(a.escrowId, a.lender);
            emit AuctionSettled(auctionId, a.lender, 0);
        }
    }

    function withdrawRefund(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "Nothing to refund");
        pendingReturns[auctionId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit BidRefunded(auctionId, msg.sender, amount);
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }
}