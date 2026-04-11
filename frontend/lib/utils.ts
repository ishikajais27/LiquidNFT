import { formatEther, parseEther } from 'viem'

export const CONTRACT_ADDRESSES = {
  NFT_ESCROW: (process.env.NEXT_PUBLIC_NFT_ESCROW ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  LENDING_POOL: (process.env.NEXT_PUBLIC_LENDING_POOL ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  LOAN_MANAGER: (process.env.NEXT_PUBLIC_LOAN_MANAGER ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  LIQUIDATION_AUCTION: (process.env.NEXT_PUBLIC_LIQUIDATION_AUCTION ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
}

export function formatEth(wei: bigint): string {
  return parseFloat(formatEther(wei)).toFixed(4) + ' ETH'
}

export function formatBps(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + '%'
}

export function formatDuration(days: bigint): string {
  return `${days.toString()} days`
}

export function calcInterest(
  principal: bigint,
  rateBps: bigint,
  elapsedSeconds: bigint,
): bigint {
  return (principal * rateBps * elapsedSeconds) / (10000n * 31536000n)
}

export function calcTotalDue(
  principal: bigint,
  rateBps: bigint,
  startTime: bigint,
): bigint {
  const elapsed = BigInt(Math.floor(Date.now() / 1000)) - startTime
  return principal + calcInterest(principal, rateBps, elapsed)
}

export function isLoanExpired(
  startTime: bigint,
  durationDays: bigint,
): boolean {
  const expiry = startTime + durationDays * 86400n
  return BigInt(Math.floor(Date.now() / 1000)) > expiry
}

export function timeLeft(startTime: bigint, durationDays: bigint): string {
  const expiry = Number(startTime + durationDays * 86400n)
  const now = Math.floor(Date.now() / 1000)
  const diff = expiry - now
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  return `${d}d ${h}h`
}
