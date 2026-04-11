// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LendingPool.sol";

contract LendingPoolTest is Test {
    LendingPool pool;
    address lender = address(0x1111);
    address loanMgr = address(0xBB);
    address borrower = address(0xB1);

    function setUp() public {
        pool = new LendingPool();
        pool.setLoanManager(loanMgr);
        vm.deal(lender, 100 ether);
        vm.deal(borrower, 10 ether);
    }

    function test_CreateOffer() public {
        vm.prank(lender);
        uint256 id = pool.createOffer{value: 1 ether}(1000, 30);
        LendingPool.Offer memory o = pool.getOffer(id);
        assertEq(o.lender, lender);
        assertEq(o.amount, 1 ether);
        assertEq(o.interestRateBps, 1000);
        assertEq(o.durationDays, 30);
        assertTrue(o.active);
    }

    function test_CancelOffer() public {
        vm.prank(lender);
        uint256 id = pool.createOffer{value: 1 ether}(500, 7);
        uint256 balBefore = lender.balance;
        vm.prank(lender);
        pool.cancelOffer(id);
        assertFalse(pool.getOffer(id).active);
        assertEq(lender.balance, balBefore + 1 ether);
    }

    function test_MatchOffer() public {
        vm.prank(lender);
        uint256 id = pool.createOffer{value: 2 ether}(500, 14);
        uint256 balBefore = borrower.balance;
        vm.prank(loanMgr);
        pool.matchOffer(id, borrower);
        assertEq(borrower.balance, balBefore + 2 ether);
        assertFalse(pool.getOffer(id).active);
    }

    function test_GetActiveOffers() public {
        vm.prank(lender);
        pool.createOffer{value: 1 ether}(500, 7);
        vm.prank(lender);
        pool.createOffer{value: 1 ether}(1000, 30);
        uint256[] memory active = pool.getActiveOffers();
        assertEq(active.length, 2);
    }

    function test_RevertHighRate() public {
        vm.prank(lender);
        vm.expectRevert("Rate too high");
        pool.createOffer{value: 1 ether}(6000, 30);
    }
}