import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseAbi } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/utils'

const ABI = parseAbi([
  'function placeBid(uint256 auctionId) payable',
  'function settleAuction(uint256 auctionId)',
  'function withdrawRefund(uint256 auctionId)',
  'function getAuction(uint256 auctionId) view returns (tuple(uint256 loanId, bytes32 escrowId, address lender, uint256 minBid, uint256 highestBid, address highestBidder, uint256 endTime, bool settled))',
  'function auctionCount() view returns (uint256)',
  'function pendingReturns(uint256 auctionId, address bidder) view returns (uint256)',
])

export function usePlaceBid() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const placeBid = (auctionId: bigint, value: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LIQUIDATION_AUCTION,
      abi: ABI,
      functionName: 'placeBid',
      args: [auctionId],
      value,
    })
  }

  return { placeBid, isPending, isSuccess }
}

export function useSettleAuction() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const settleAuction = (auctionId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LIQUIDATION_AUCTION,
      abi: ABI,
      functionName: 'settleAuction',
      args: [auctionId],
    })
  }

  return { settleAuction, isPending, isSuccess }
}

export function useWithdrawRefund() {
  const { writeContract, isPending } = useWriteContract()

  const withdrawRefund = (auctionId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LIQUIDATION_AUCTION,
      abi: ABI,
      functionName: 'withdrawRefund',
      args: [auctionId],
    })
  }

  return { withdrawRefund, isPending }
}

export function useGetAuction(auctionId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LIQUIDATION_AUCTION,
    abi: ABI,
    functionName: 'getAuction',
    args: auctionId !== undefined ? [auctionId] : undefined,
    query: { enabled: auctionId !== undefined },
  })
}

export function useAuctionCount() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LIQUIDATION_AUCTION,
    abi: ABI,
    functionName: 'auctionCount',
  })
}
