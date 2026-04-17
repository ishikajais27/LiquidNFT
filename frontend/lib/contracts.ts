// No viem — ethers only
export const ADDRESSES = {
  NFTEscrow: process.env.NEXT_PUBLIC_NFT_ESCROW!,
  LendingPool: process.env.NEXT_PUBLIC_LENDING_POOL!,
  LiquidationAuction: process.env.NEXT_PUBLIC_LIQUIDATION_AUCTION!,
  LoanManager: process.env.NEXT_PUBLIC_LOAN_MANAGER!,
}

export const LENDING_POOL_ABI = [
  'function createOffer(uint256 interestRateBps, uint256 durationDays) external payable returns (uint256)',
  'function cancelOffer(uint256 offerId) external',
  'function getOffer(uint256 offerId) external view returns (tuple(address lender, uint256 amount, uint256 interestRateBps, uint256 durationDays, bool active))',
  'function getActiveOffers() external view returns (uint256[])',
  'function offerCount() external view returns (uint256)',
]

export const NFT_ESCROW_ABI = [
  'function depositNFT(address nftContract, uint256 tokenId) external returns (bytes32)',
  'function getEscrow(bytes32 escrowId) external view returns (tuple(address owner, address nftContract, uint256 tokenId, bool isLocked))',
  'function escrows(bytes32) external view returns (address owner, address nftContract, uint256 tokenId, bool isLocked)',
]

export const LOAN_MANAGER_ABI = [
  'function takeLoan(bytes32 escrowId, uint256 offerId) external returns (uint256)',
  'function repayLoan(uint256 loanId) external payable',
  'function triggerDefault(uint256 loanId) external',
  'function getTotalDue(uint256 loanId) external view returns (uint256)',
  'function isExpired(uint256 loanId) external view returns (bool)',
  'function getLoan(uint256 loanId) external view returns (tuple(address borrower, address lender, bytes32 escrowId, uint256 offerId, uint256 principal, uint256 interestRateBps, uint256 startTime, uint256 durationDays, uint8 status))',
  'function getBorrowerLoans(address borrower) external view returns (uint256[])',
  'function loanCount() external view returns (uint256)',
]

export const LIQUIDATION_AUCTION_ABI = [
  'function placeBid(uint256 auctionId) external payable',
  'function settleAuction(uint256 auctionId) external',
  'function withdrawRefund(uint256 auctionId) external',
  'function getAuction(uint256 auctionId) external view returns (tuple(uint256 loanId, bytes32 escrowId, address lender, uint256 minBid, uint256 highestBid, address highestBidder, uint256 endTime, bool settled))',
  'function auctionCount() external view returns (uint256)',
  'function pendingReturns(uint256 auctionId, address bidder) external view returns (uint256)',
]

export const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function name() external view returns (string)',
]
