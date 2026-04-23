// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Holds NFTs safely while a loan is active.
// Only the LoanManager can lock or release them.
contract NFTEscrow is ERC721Holder, Ownable, ReentrancyGuard {
    address public loanManager;

    struct EscrowedNFT {
        address owner;
        address nftContract;
        uint256 tokenId;
        bool isLocked;
    }

    mapping(bytes32 => EscrowedNFT) public escrows;

    event NFTDeposited(bytes32 indexed escrowId, address indexed owner, address nftContract, uint256 tokenId);
    event NFTReleased(bytes32 indexed escrowId, address indexed to);
    event NFTLiquidated(bytes32 indexed escrowId, address indexed to);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    // Borrower calls this to hand over their NFT before taking a loan
    function depositNFT(address nftContract, uint256 tokenId) external nonReentrant returns (bytes32 escrowId) {
        escrowId = keccak256(abi.encodePacked(msg.sender, nftContract, tokenId, block.timestamp));
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        escrows[escrowId] = EscrowedNFT({
            owner: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            isLocked: false
        });
        emit NFTDeposited(escrowId, msg.sender, nftContract, tokenId);
    }

    // Called when a loan starts — prevents borrower from withdrawing mid-loan
    function lockNFT(bytes32 escrowId) external onlyLoanManager {
        require(escrows[escrowId].owner != address(0), "Escrow not found");
        escrows[escrowId].isLocked = true;
    }

    // Called when borrower repays — sends NFT back
    function releaseNFT(bytes32 escrowId, address to) external onlyLoanManager nonReentrant {
        EscrowedNFT storage e = escrows[escrowId];
        require(e.owner != address(0), "Escrow not found");
        require(e.isLocked, "NFT not locked");
        e.isLocked = false;
        IERC721(e.nftContract).safeTransferFrom(address(this), to, e.tokenId);
        delete escrows[escrowId];
        emit NFTReleased(escrowId, to);
    }

    // Called when a loan defaults — sends NFT to auction winner or lender
    function liquidateNFT(bytes32 escrowId, address to) external onlyLoanManager nonReentrant {
        EscrowedNFT storage e = escrows[escrowId];
        require(e.owner != address(0), "Escrow not found");
        IERC721(e.nftContract).safeTransferFrom(address(this), to, e.tokenId);
        delete escrows[escrowId];
        emit NFTLiquidated(escrowId, to);
    }

    function getEscrow(bytes32 escrowId) external view returns (EscrowedNFT memory) {
        return escrows[escrowId];
    }
}