export const ADDRESSES = {
  NFTEscrow: '0x641FEC5DCa9898376C5665c1EC76B9010B9680F6',
  LendingPool: '0x81d6040048787bF13C7F495cfD21e8EE4f9dD918',
  LiquidationAuction: '0x2d9C100575706Ba604AC5d5b36bc275a55F2AB66',
  LoanManager: '0x509249c87545B701e5CEf4B1B3e24E642B8f6364',
}

export const NFT_ESCROW_ABI = [
  'function depositNFT(address nftContract, uint256 tokenId) external returns (bytes32)',
  'function lockNFT(bytes32 escrowId) external',
  'function releaseNFT(bytes32 escrowId, address to) external',
  'function liquidateNFT(bytes32 escrowId, address to) external',
  'function getEscrow(bytes32 escrowId) external view returns (tuple(address owner, address nftContract, uint256 tokenId, bool isLocked))',
  'event NFTDeposited(bytes32 indexed escrowId, address indexed owner, address nftContract, uint256 tokenId)',
]

export const LENDING_POOL_ABI = [
  'function createOffer(uint256 interestRateBps, uint256 durationDays) external payable returns (uint256)',
  'function cancelOffer(uint256 offerId) external',
  'function matchOffer(uint256 offerId, address borrower) external returns (uint256)',
  'function repayToLender(address lender, uint256 amount) external payable',
  'function getOffer(uint256 offerId) external view returns (tuple(address lender, uint256 amount, uint256 interestRateBps, uint256 durationDays, bool active))',
  'function getActiveOffers() external view returns (uint256[])',
  'function offerCount() external view returns (uint256)',
]

export const LOAN_MANAGER_ABI = [
  'function takeLoan(bytes32 escrowId, uint256 offerId) external returns (uint256)',
  'function repayLoan(uint256 loanId) external payable',
  'function triggerDefault(uint256 loanId) external',
  'function completeLiquidation(uint256 loanId) external',
  'function getTotalDue(uint256 loanId) external view returns (uint256)',
  'function isExpired(uint256 loanId) external view returns (bool)',
  'function getLoan(uint256 loanId) external view returns (tuple(address borrower, address lender, bytes32 escrowId, uint256 offerId, uint256 principal, uint256 interestRateBps, uint256 startTime, uint256 durationDays, uint8 status))',
  'function getBorrowerLoans(address borrower) external view returns (uint256[])',
  'function getLenderLoans(address lender) external view returns (uint256[])',
  'function loanCount() external view returns (uint256)',
]

export const LIQUIDATION_AUCTION_ABI = [
  'function startAuction(uint256 loanId, bytes32 escrowId, address lender, uint256 minBid) external returns (uint256)',
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
