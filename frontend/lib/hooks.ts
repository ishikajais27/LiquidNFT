'use client'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  ADDRESSES,
  LENDING_POOL_ABI,
  LOAN_MANAGER_ABI,
  LIQUIDATION_AUCTION_ABI,
} from './contracts'

export function useWallet() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string>('')

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) return alert('Install MetaMask')
    const p = new ethers.BrowserProvider((window as any).ethereum)
    await p.send('eth_requestAccounts', [])
    const s = await p.getSigner()
    setProvider(p)
    setSigner(s)
    setAddress(await s.getAddress())
  }, [])

  useEffect(() => {
    if ((window as any).ethereum) {
      const p = new ethers.BrowserProvider((window as any).ethereum)
      p.getSigner()
        .then(async (s) => {
          setSigner(s)
          setProvider(p)
          setAddress(await s.getAddress())
        })
        .catch(() => {})
    }
  }, [])

  return { provider, signer, address, connect }
}

export function useOffers(provider: ethers.BrowserProvider | null) {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    try {
      const pool = new ethers.Contract(
        ADDRESSES.LendingPool,
        LENDING_POOL_ABI,
        provider,
      )
      const ids: bigint[] = await pool.getActiveOffers()
      const data = await Promise.all(
        ids.map(async (id) => {
          const o = await pool.getOffer(id)
          return {
            id: id.toString(),
            lender: o.lender,
            amount: ethers.formatEther(o.amount),
            rateBps: o.interestRateBps.toString(),
            durationDays: o.durationDays.toString(),
            active: o.active,
          }
        }),
      )
      setOffers(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [provider])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { offers, loading, refetch: fetch }
}

export function useLoans(
  provider: ethers.BrowserProvider | null,
  address: string,
) {
  const [loans, setLoans] = useState<any[]>([])

  const fetch = useCallback(async () => {
    if (!provider || !address) return
    try {
      const mgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        provider,
      )
      const ids: bigint[] = await mgr.getBorrowerLoans(address)
      const data = await Promise.all(
        ids.map(async (id) => {
          const l = await mgr.getLoan(id)
          const due = await mgr.getTotalDue(id).catch(() => 0n)
          const expired = await mgr.isExpired(id).catch(() => false)
          return {
            id: id.toString(),
            borrower: l.borrower,
            lender: l.lender,
            principal: ethers.formatEther(l.principal),
            rateBps: l.interestRateBps.toString(),
            durationDays: l.durationDays.toString(),
            status: ['Active', 'Repaid', 'Liquidated', 'Defaulted'][
              Number(l.status)
            ],
            totalDue: ethers.formatEther(due),
            expired,
          }
        }),
      )
      setLoans(data)
    } catch (e) {
      console.error(e)
    }
  }, [provider, address])

  useEffect(() => {
    fetch()
  }, [fetch])
  return { loans, refetch: fetch }
}

export function useAuctions(provider: ethers.BrowserProvider | null) {
  const [auctions, setAuctions] = useState<any[]>([])

  const fetch = useCallback(async () => {
    if (!provider) return
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        provider,
      )
      const count = Number(await auc.auctionCount())
      const data = []
      for (let i = 0; i < count; i++) {
        const a = await auc.getAuction(i)
        data.push({
          id: i.toString(),
          loanId: a.loanId.toString(),
          lender: a.lender,
          minBid: ethers.formatEther(a.minBid),
          highestBid: ethers.formatEther(a.highestBid),
          highestBidder: a.highestBidder,
          endTime: Number(a.endTime),
          settled: a.settled,
        })
      }
      setAuctions(data.filter((a) => !a.settled))
    } catch (e) {
      console.error(e)
    }
  }, [provider])

  useEffect(() => {
    fetch()
  }, [fetch])
  return { auctions, refetch: fetch }
}
