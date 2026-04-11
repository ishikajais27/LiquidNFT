import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseAbi } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/utils'

const ABI = parseAbi([
  'function takeLoan(bytes32 escrowId, uint256 offerId) returns (uint256)',
  'function repayLoan(uint256 loanId) payable',
  'function triggerDefault(uint256 loanId)',
  'function getLoan(uint256 loanId) view returns (tuple(address borrower, address lender, bytes32 escrowId, uint256 offerId, uint256 principal, uint256 interestRateBps, uint256 startTime, uint256 durationDays, uint8 status))',
  'function getTotalDue(uint256 loanId) view returns (uint256)',
  'function isExpired(uint256 loanId) view returns (bool)',
  'function getBorrowerLoans(address borrower) view returns (uint256[])',
  'function getLenderLoans(address lender) view returns (uint256[])',
])

export function useTakeLoan() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const takeLoan = (escrowId: `0x${string}`, offerId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LOAN_MANAGER,
      abi: ABI,
      functionName: 'takeLoan',
      args: [escrowId, offerId],
    })
  }

  return { takeLoan, isPending, isSuccess }
}

export function useRepayLoan() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const repayLoan = (loanId: bigint, totalDue: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LOAN_MANAGER,
      abi: ABI,
      functionName: 'repayLoan',
      args: [loanId],
      value: totalDue,
    })
  }

  return { repayLoan, isPending, isSuccess }
}

export function useTriggerDefault() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const triggerDefault = (loanId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.LOAN_MANAGER,
      abi: ABI,
      functionName: 'triggerDefault',
      args: [loanId],
    })
  }

  return { triggerDefault, isPending, isSuccess }
}

export function useGetLoan(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LOAN_MANAGER,
    abi: ABI,
    functionName: 'getLoan',
    args: loanId !== undefined ? [loanId] : undefined,
    query: { enabled: loanId !== undefined },
  })
}

export function useGetTotalDue(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LOAN_MANAGER,
    abi: ABI,
    functionName: 'getTotalDue',
    args: loanId !== undefined ? [loanId] : undefined,
    query: { enabled: loanId !== undefined },
  })
}

export function useBorrowerLoans(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LOAN_MANAGER,
    abi: ABI,
    functionName: 'getBorrowerLoans',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}

export function useLenderLoans(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.LOAN_MANAGER,
    abi: ABI,
    functionName: 'getLenderLoans',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}
