// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTEscrow is ERC721Holder, Ownable, ReentrancyGuard {
    address public loanManager;

    struct EscrowedNFT {
        address owner;
        address nftContract;
        uint256 tokenId;
        bool isLocked;
    }

    // escrowId => EscrowedNFT
    mapping(bytes32 => EscrowedNFT) public escrows;

    event NFTDeposited(bytes32 indexed escrowId, address indexed owner, address nftContract, uint256 tokenId);
    event NFTReleased(bytes32 indexed escrowId, address indexed to);
    event NFTLiquidated(bytes32 indexed escrowId, address indexed liquidator);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

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

    function lockNFT(bytes32 escrowId) external onlyLoanManager {
        require(escrows[escrowId].owner != address(0), "Escrow not found");
        escrows[escrowId].isLocked = true;
    }

    function releaseNFT(bytes32 escrowId, address to) external onlyLoanManager nonReentrant {
        EscrowedNFT storage e = escrows[escrowId];
        require(e.owner != address(0), "Escrow not found");
        require(e.isLocked, "NFT not locked");
        e.isLocked = false;
        IERC721(e.nftContract).safeTransferFrom(address(this), to, e.tokenId);
        delete escrows[escrowId];
        emit NFTReleased(escrowId, to);
    }

    function liquidateNFT(bytes32 escrowId, address liquidator) external onlyLoanManager nonReentrant {
        EscrowedNFT storage e = escrows[escrowId];
        require(e.owner != address(0), "Escrow not found");
        IERC721(e.nftContract).safeTransferFrom(address(this), liquidator, e.tokenId);
        delete escrows[escrowId];
        emit NFTLiquidated(escrowId, liquidator);
    }

    function getEscrow(bytes32 escrowId) external view returns (EscrowedNFT memory) {
        return escrows[escrowId];
    }
}