    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    import "forge-std/Test.sol";
    import "../src/NFTEscrow.sol";
    import "../src/LiquidationAuction.sol";
    import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

    contract MockNFT3 is ERC721 {
        uint256 public c;
        constructor() ERC721("A","A") {}
        function mint(address to) external returns (uint256 id) { id = c++; _mint(to, id); }
    }

    contract LiquidationAuctionTest is Test {
        NFTEscrow escrow;
        LiquidationAuction auction;
        MockNFT3 nft;
        address loanMgr = address(0xBB);
        address lender  = address(0x1111);
        address bidder1 = address(0xD1);
        address bidder2 = address(0xD2);

        bytes32 escrowId;

        function setUp() public {
            escrow  = new NFTEscrow();
            auction = new LiquidationAuction(address(escrow));
            escrow.setLoanManager(address(auction)); // auction can release NFTs
            auction.setLoanManager(loanMgr);

            nft = new MockNFT3();

            vm.startPrank(lender);
            uint256 tid = nft.mint(lender);
            nft.approve(address(escrow), tid);
            escrowId = escrow.depositNFT(address(nft), tid);
            vm.stopPrank();

            vm.deal(bidder1, 10 ether);
            vm.deal(bidder2, 10 ether);
        }

        function test_StartAuction() public {
            vm.prank(loanMgr);
            uint256 aid = auction.startAuction(0, escrowId, lender, 1 ether);
            LiquidationAuction.Auction memory a = auction.getAuction(aid);
            assertEq(a.minBid, 1 ether);
            assertFalse(a.settled);
        }

        function test_PlaceBid() public {
            vm.prank(loanMgr);
            uint256 aid = auction.startAuction(0, escrowId, lender, 1 ether);

            vm.prank(bidder1);
            auction.placeBid{value: 1.5 ether}(aid);
            assertEq(auction.getAuction(aid).highestBidder, bidder1);
        }

        function test_OutbidRefund() public {
            vm.prank(loanMgr);
            uint256 aid = auction.startAuction(0, escrowId, lender, 1 ether);

            vm.prank(bidder1);
            auction.placeBid{value: 1.5 ether}(aid);
            vm.prank(bidder2);
            auction.placeBid{value: 2 ether}(aid);

            assertEq(auction.pendingReturns(aid, bidder1), 1.5 ether);

            uint256 before = bidder1.balance;
            vm.prank(bidder1);
            auction.withdrawRefund(aid);
            assertEq(bidder1.balance, before + 1.5 ether);
        }

        function test_SettleAuction() public {
            vm.prank(loanMgr);
            uint256 aid = auction.startAuction(0, escrowId, lender, 1 ether);

            vm.prank(bidder1);
            auction.placeBid{value: 1.5 ether}(aid);

            vm.warp(block.timestamp + 25 hours);
            auction.settleAuction(aid);

            assertTrue(auction.getAuction(aid).settled);
        }
    }