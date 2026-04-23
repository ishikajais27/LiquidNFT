// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./NFTEscrow.sol";
import "./LendingPool.sol";
import "./LiquidationAuction.sol";

// The main coordinator. Borrowers interact here to take loans,
// repay them, or get defaulted. It talks to the other contracts.
contract LoanManager is Ownable, ReentrancyGuard {
    NFTEscrow public nftEscrow;
    LendingPool public lendingPool;
    LiquidationAuction public liquidationAuction;

    enum LoanStatus { Active, Repaid, Liquidated, Defaulted }

    struct Loan {
        address borrower;
        address lender;
        bytes32 escrowId;
        uint256 offerId;
        uint256 principal;
        uint256 interestRateBps;
        uint256 startTime;
        uint256 durationDays;
        LoanStatus status;
    }

    uint256 public loanCount;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public lenderLoans;

    event LoanCreated(uint256 indexed loanId, address borrower, address lender, uint256 principal);
    event LoanRepaid(uint256 indexed loanId, uint256 totalRepaid);
    event LoanDefaulted(uint256 indexed loanId);
    event LoanLiquidated(uint256 indexed loanId);

    constructor(address _escrow, address _pool, address _auction) Ownable(msg.sender) {
        nftEscrow = NFTEscrow(_escrow);
        lendingPool = LendingPool(_pool);
        liquidationAuction = LiquidationAuction(_auction);
    }

    // Borrower picks an offer, locks their NFT, and receives the ETH
    function takeLoan(bytes32 escrowId, uint256 offerId) external nonReentrant returns (uint256 loanId) {
        NFTEscrow.EscrowedNFT memory escrowed = nftEscrow.getEscrow(escrowId);
        require(escrowed.owner == msg.sender, "Not your NFT");
        require(!escrowed.isLocked, "NFT already in use");

        LendingPool.Offer memory offer = lendingPool.getOffer(offerId);
        require(offer.active, "Offer no longer available");

        nftEscrow.lockNFT(escrowId);
        lendingPool.matchOffer(offerId, msg.sender);

        loanId = loanCount++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: offer.lender,
            escrowId: escrowId,
            offerId: offerId,
            principal: offer.amount,
            interestRateBps: offer.interestRateBps,
            startTime: block.timestamp,
            durationDays: offer.durationDays,
            status: LoanStatus.Active
        });

        borrowerLoans[msg.sender].push(loanId);
        lenderLoans[offer.lender].push(loanId);

        emit LoanCreated(loanId, msg.sender, offer.lender, offer.amount);
    }

    // Borrower pays back principal + accrued interest to get their NFT back
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not borrower");
        require(loan.status == LoanStatus.Active, "Loan not active");

        uint256 totalDue = getTotalDue(loanId);
        require(msg.value >= totalDue, "Not enough to cover repayment");

        loan.status = LoanStatus.Repaid;

        nftEscrow.releaseNFT(loan.escrowId, loan.borrower);
        lendingPool.repayToLender{value: totalDue}(loan.lender, totalDue);

        // Send back any overpayment
        if (msg.value > totalDue) {
            payable(msg.sender).transfer(msg.value - totalDue);
        }

        emit LoanRepaid(loanId, totalDue);
    }

    // Anyone can call this on an expired loan to kick off the auction
    function triggerDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(isExpired(loanId), "Loan hasn't expired yet");

        loan.status = LoanStatus.Defaulted;
        liquidationAuction.startAuction(loanId, loan.escrowId, loan.lender, loan.principal);

        emit LoanDefaulted(loanId);
    }

    function completeLiquidation(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Defaulted, "Not in default");
        loan.status = LoanStatus.Liquidated;
        emit LoanLiquidated(loanId);
    }

    // Simple pro-rated interest: principal * rate * elapsed / (year in seconds)
    function getTotalDue(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 elapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.principal * loan.interestRateBps * elapsed) / (10000 * 365 days);
        return loan.principal + interest;
    }

    function isExpired(uint256 loanId) public view returns (bool) {
        Loan memory loan = loans[loanId];
        return block.timestamp > loan.startTime + (loan.durationDays * 1 days);
    }

    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    function getLenderLoans(address lender) external view returns (uint256[] memory) {
        return lenderLoans[lender];
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }
}