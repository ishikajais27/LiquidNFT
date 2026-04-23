// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Lenders post offers here with their ETH.
// When a borrower accepts, funds move to them via LoanManager.
contract LendingPool is Ownable, ReentrancyGuard {
    address public loanManager;

    struct Offer {
        address lender;
        uint256 amount;
        uint256 interestRateBps; // 1000 = 10% annual
        uint256 durationDays;
        bool active;
    }

    uint256 public offerCount;
    mapping(uint256 => Offer) public offers;

    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 rateBps, uint256 durationDays);
    event OfferCancelled(uint256 indexed offerId);
    event OfferMatched(uint256 indexed offerId, address indexed borrower);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    // Lender posts an offer by sending ETH along with their terms
    function createOffer(uint256 interestRateBps, uint256 durationDays) external payable nonReentrant returns (uint256 offerId) {
        require(msg.value > 0, "Must send ETH");
        require(durationDays > 0 && durationDays <= 365, "Duration must be 1-365 days");
        require(interestRateBps <= 5000, "Max interest is 50%");

        offerId = offerCount++;
        offers[offerId] = Offer({
            lender: msg.sender,
            amount: msg.value,
            interestRateBps: interestRateBps,
            durationDays: durationDays,
            active: true
        });

        emit OfferCreated(offerId, msg.sender, msg.value, interestRateBps, durationDays);
    }

    // Lender can pull back their offer if it hasn't been matched yet
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        require(o.lender == msg.sender, "Not your offer");
        require(o.active, "Already inactive");
        o.active = false;
        payable(msg.sender).transfer(o.amount);
        emit OfferCancelled(offerId);
    }

    // LoanManager calls this to send funds to borrower when a loan starts
    function matchOffer(uint256 offerId, address borrower) external onlyLoanManager nonReentrant returns (uint256 amount) {
        Offer storage o = offers[offerId];
        require(o.active, "Offer not active");
        o.active = false;
        amount = o.amount;
        payable(borrower).transfer(amount);
        emit OfferMatched(offerId, borrower);
    }

    // LoanManager sends repayment through here to the lender
    function repayToLender(address lender, uint256 amount) external payable onlyLoanManager {
        require(msg.value == amount, "Amount mismatch");
        payable(lender).transfer(amount);
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    // Returns IDs of all offers that are still open
    function getActiveOffers() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < offerCount; i++) {
            if (offers[i].active) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < offerCount; i++) {
            if (offers[i].active) result[idx++] = i;
        }
        return result;
    }
}