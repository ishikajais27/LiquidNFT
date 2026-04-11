// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFTEscrow.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {
    uint256 public tokenIdCounter;
    constructor() ERC721("Mock", "MCK") {}
    function mint(address to) external returns (uint256) {
        uint256 id = tokenIdCounter++;
        _mint(to, id);
        return id;
    }
}

contract NFTEscrowTest is Test {
    NFTEscrow escrow;
    MockNFT nft;
    address alice = address(0xA1);
    address loanMgr = address(0xBB);

    function setUp() public {
        escrow = new NFTEscrow();
        nft = new MockNFT();
        escrow.setLoanManager(loanMgr);

        vm.startPrank(alice);
        uint256 tid = nft.mint(alice);
        nft.approve(address(escrow), tid);
        vm.stopPrank();
    }

    function test_DepositNFT() public {
        vm.startPrank(alice);
        uint256 tokenId = nft.mint(alice);
        nft.approve(address(escrow), tokenId);
        bytes32 eid = escrow.depositNFT(address(nft), tokenId);
        NFTEscrow.EscrowedNFT memory e = escrow.getEscrow(eid);
        assertEq(e.owner, alice);
        assertEq(e.tokenId, tokenId);
        assertEq(e.isLocked, false);
        vm.stopPrank();
    }

    function test_LockNFT() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice);
        vm.prank(alice);
        nft.approve(address(escrow), tokenId);
        vm.prank(alice);
        bytes32 eid = escrow.depositNFT(address(nft), tokenId);

        vm.prank(loanMgr);
        escrow.lockNFT(eid);
        assertTrue(escrow.getEscrow(eid).isLocked);
    }

    function test_ReleaseNFT() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice);
        vm.prank(alice);
        nft.approve(address(escrow), tokenId);
        vm.prank(alice);
        bytes32 eid = escrow.depositNFT(address(nft), tokenId);

        vm.prank(loanMgr);
        escrow.lockNFT(eid);
        vm.prank(loanMgr);
        escrow.releaseNFT(eid, alice);

        assertEq(nft.ownerOf(tokenId), alice);
    }

    function test_RevertIfNotLoanManager() public {
        vm.prank(alice);
        uint256 tokenId = nft.mint(alice);
        vm.prank(alice);
        nft.approve(address(escrow), tokenId);
        vm.prank(alice);
        bytes32 eid = escrow.depositNFT(address(nft), tokenId);

        vm.expectRevert("Only LoanManager");
        escrow.lockNFT(eid);
    }
}