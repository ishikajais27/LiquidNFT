// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LendingPool is Ownable, ReentrancyGuard {
    address public loanManager;

    struct Offer {
        address lender;
        uint256 amount;
        uint256 interestRateBps; // basis points e.g. 1000 = 10%
        uint256 durationDays;
        bool active;
    }

    uint256 public offerCount;
    mapping(uint256 => Offer) public offers;
    mapping(address => uint256) public lenderBalance; // deposited but unmatched

    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 rateBps, uint256 durationDays);
    event OfferCancelled(uint256 indexed offerId);
    event OfferMatched(uint256 indexed offerId, address indexed borrower);
    event FundsDeposited(address indexed lender, uint256 amount);
    event FundsWithdrawn(address indexed lender, uint256 amount);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    function createOffer(uint256 interestRateBps, uint256 durationDays) external payable nonReentrant returns (uint256 offerId) {
        require(msg.value > 0, "Must send ETH");
        require(durationDays > 0 && durationDays <= 365, "Invalid duration");
        require(interestRateBps <= 5000, "Rate too high"); // max 50%

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

    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        require(o.lender == msg.sender, "Not your offer");
        require(o.active, "Offer not active");
        o.active = false;
        payable(msg.sender).transfer(o.amount);
        emit OfferCancelled(offerId);
    }

    function matchOffer(uint256 offerId, address borrower) external onlyLoanManager nonReentrant returns (uint256 amount) {
        Offer storage o = offers[offerId];
        require(o.active, "Offer not active");
        o.active = false;
        amount = o.amount;
        payable(borrower).transfer(amount);
        emit OfferMatched(offerId, borrower);
    }

    function repayToLender(address lender, uint256 amount) external payable onlyLoanManager {
        require(msg.value == amount, "Wrong repay amount");
        payable(lender).transfer(amount);
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

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