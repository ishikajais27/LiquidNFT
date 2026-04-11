import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseAbi, parseEther } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/utils'

const ABI = parseAbi([
  'function createOffer(uint256 interestRateBps, uint256 durationDays) payable returns (uint256)',
  'function cancelOffer(uint256 offerId)',
  'function getOffer(uint256 offerId) view returns (tuple(address lender, uint256 amount, uint256 interestRateBps, uint256 durationDays, bool active))',
  'function getActiveOffers() view returns (uint256[])',
])

export function useCreateOffer() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const createOffer = (
    amount: string,
    rateBps: number,
    durationDays: number,
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LENDING_POOL,
      abi: ABI,
      functionName: 'createOffer',
      args: [BigInt(rateBps), BigInt(durationDays)],
      value: parseEther(amount),
    })
  }

  return { createOffer, isPending: isPending || isConfirming, isSuccess }
}

export function useCancelOffer() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancelOffer = (offerId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LENDING_POOL,
      abi: ABI,
      functionName: 'cancelOffer',
      args: [offerId],
    })
  }

  return { cancelOffer, isPending, isSuccess }
}

export function useGetActiveOffers() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LENDING_POOL,
    abi: ABI,
    functionName: 'getActiveOffers',
  })
}

export function useGetOffer(offerId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LENDING_POOL,
    abi: ABI,
    functionName: 'getOffer',
    args: offerId !== undefined ? [offerId] : undefined,
    query: { enabled: offerId !== undefined },
  })
}
