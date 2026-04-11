// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFTEscrow.sol";
import "../src/LendingPool.sol";
import "../src/LoanManager.sol";
import "../src/LiquidationAuction.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT2 is ERC721 {
    uint256 public c;
    constructor() ERC721("T","T") {}
    function mint(address to) external returns (uint256 id) { id = c++; _mint(to, id); }
}

contract LoanManagerTest is Test {
    NFTEscrow escrow;
    LendingPool pool;
    LoanManager manager;
    LiquidationAuction auction;
    MockNFT2 nft;

    address alice = address(0xA1); // borrower
    address bob   = address(0xB2); // lender

    function setUp() public {
        escrow  = new NFTEscrow();
        pool    = new LendingPool();
        auction = new LiquidationAuction(address(escrow));
        manager = new LoanManager(address(escrow), address(pool), address(auction));

        escrow.setLoanManager(address(manager));
        pool.setLoanManager(address(manager));
        auction.setLoanManager(address(manager));

        nft = new MockNFT2();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _setupLoan() internal returns (uint256 loanId, bytes32 eid, uint256 offerId) {
        vm.startPrank(alice);
        uint256 tid = nft.mint(alice);
        nft.approve(address(escrow), tid);
        eid = escrow.depositNFT(address(nft), tid);
        vm.stopPrank();

        vm.prank(bob);
        offerId = pool.createOffer{value: 1 ether}(1000, 30);

        vm.prank(alice);
        loanId = manager.takeLoan(eid, offerId);
    }

    function test_TakeLoan() public {
        (uint256 loanId,,) = _setupLoan();
        LoanManager.Loan memory loan = manager.getLoan(loanId);
        assertEq(loan.borrower, alice);
        assertEq(loan.lender, bob);
        assertEq(uint(loan.status), uint(LoanManager.LoanStatus.Active));
    }

    function test_RepayLoan() public {
        (uint256 loanId,,) = _setupLoan();
        uint256 due = manager.getTotalDue(loanId);

        vm.prank(alice);
        manager.repayLoan{value: due + 0.01 ether}(loanId);

        LoanManager.Loan memory loan = manager.getLoan(loanId);
        assertEq(uint(loan.status), uint(LoanManager.LoanStatus.Repaid));
    }

    function test_TriggerDefault() public {
        (uint256 loanId,,) = _setupLoan();
        // Fast forward past loan duration
        vm.warp(block.timestamp + 31 days);
        manager.triggerDefault(loanId);
        LoanManager.Loan memory loan = manager.getLoan(loanId);
        assertEq(uint(loan.status), uint(LoanManager.LoanStatus.Defaulted));
    }

    function test_RevertRepayIfNotBorrower() public {
        (uint256 loanId,,) = _setupLoan();
        vm.deal(bob, 5 ether);
        vm.prank(bob);
        vm.expectRevert("Not borrower");
        manager.repayLoan{value: 1.1 ether}(loanId);
    }

    function test_RevertDefaultBeforeExpiry() public {
        (uint256 loanId,,) = _setupLoan();
        vm.expectRevert("Loan not expired");
        manager.triggerDefault(loanId);
    }
}