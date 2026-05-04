'use client'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  ADDRESSES,
  LENDING_POOL_ABI,
  LOAN_MANAGER_ABI,
  LIQUIDATION_AUCTION_ABI,
} from './contracts'

const SEPOLIA_CHAIN_ID = 11155111

export function useWallet(savedWalletAddress?: string) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string>('')
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const checkAndSwitchNetwork = async (p: ethers.BrowserProvider) => {
    const network = await p.getNetwork()
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      setWrongNetwork(true)
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        })
        setWrongNetwork(false)
      } catch {}
    } else {
      setWrongNetwork(false)
    }
  }

  const tryAutoConnect = useCallback(async (expectedAddress?: string) => {
    // No saved wallet in DB → never auto-connect
    if (!expectedAddress) return

    const eth = (window as any).ethereum
    if (!eth) return

    try {
      const p = new ethers.BrowserProvider(eth)

      // First try silent check — already approved accounts
      const accounts: string[] = await eth.request({ method: 'eth_accounts' })

      if (
        accounts.length > 0 &&
        accounts[0].toLowerCase() === expectedAddress.toLowerCase()
      ) {
        // Already approved in this browser — connect silently
        await checkAndSwitchNetwork(p)
        const s = await p.getSigner()
        setProvider(p)
        setSigner(s)
        setAddress(await s.getAddress())
        return
      }

      // Not in approved accounts — request permission (will show MetaMask popup)
      // This is intentional: user has a saved wallet in DB, so we prompt them
      // to reconnect it on new browser/device
      const requested: string[] = await eth.request({
        method: 'eth_requestAccounts',
      })

      if (
        requested.length === 0 ||
        requested[0].toLowerCase() !== expectedAddress.toLowerCase()
      ) {
        // Wrong account selected or user rejected — don't connect
        return
      }

      await checkAndSwitchNetwork(p)
      const s = await p.getSigner()
      setProvider(p)
      setSigner(s)
      setAddress(await s.getAddress())
    } catch (e: any) {
      // User rejected the popup — silently fail, they can connect manually
      console.log('Auto-connect rejected or failed:', e?.message)
    }
  }, [])

  useEffect(() => {
    // Wait for authUser to be loaded before trying auto-connect
    // savedWalletAddress is '' until authUser loads, so this is safe
    if (savedWalletAddress === undefined) return

    tryAutoConnect(savedWalletAddress)

    const eth = (window as any).ethereum
    if (!eth) return
    eth.on('accountsChanged', () => window.location.reload())
    eth.on('chainChanged', () => window.location.reload())

    return () => {
      eth.removeAllListeners?.('accountsChanged')
      eth.removeAllListeners?.('chainChanged')
    }
  }, [savedWalletAddress, tryAutoConnect])

  const connect = useCallback(async () => {
    if (connecting) return
    const eth = (window as any).ethereum
    if (!eth) return alert('Please install MetaMask.')
    setConnecting(true)
    try {
      const p = new ethers.BrowserProvider(eth)
      await p.send('eth_requestAccounts', [])
      await checkAndSwitchNetwork(p)
      const s = await p.getSigner()
      const connectedAddress = await s.getAddress()
      setProvider(p)
      setSigner(s)
      setAddress(connectedAddress)

      // Save to DB
      await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: connectedAddress }),
      })
    } catch (e: any) {
      if (e?.code === -32002) {
        alert(
          'MetaMask is already asking for permission. Please open MetaMask and approve the connection.',
        )
      }
    }
    setConnecting(false)
  }, [connecting])

  const disconnect = useCallback(async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await fetch('/api/auth/wallet/disconnect', { method: 'POST' })
      setProvider(null)
      setSigner(null)
      setAddress('')
      setWrongNetwork(false)
    } catch (err) {
      console.error('Disconnect error:', err)
    }
    setDisconnecting(false)
  }, [disconnecting])

  return {
    provider,
    signer,
    address,
    connect,
    disconnect,
    disconnecting,
    wrongNetwork,
  }
}

export function useOffers(provider: ethers.BrowserProvider | null) {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    try {
      const pool = new ethers.Contract(
        ADDRESSES.LendingPool,
        LENDING_POOL_ABI,
        provider,
      )
      const ids: bigint[] = await pool.getActiveOffers()
      const results = await Promise.all(
        ids.map(async (id) => {
          const o = await pool.getOffer(id)
          return {
            id: id.toString(),
            lender: o.lender,
            amount: ethers.formatEther(o.amount),
            rateBps: o.interestRateBps.toString(),
            durationDays: o.durationDays.toString(),
          }
        }),
      )
      setOffers(results)
    } catch (err) {
      console.error('Failed to load offers:', err)
    }
    setLoading(false)
  }, [provider])

  useEffect(() => {
    load()
  }, [load])

  return { offers, loading, refetch: load }
}

export function useLoans(
  provider: ethers.BrowserProvider | null,
  address: string,
) {
  const [loans, setLoans] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!provider || !address) return
    try {
      const mgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        provider,
      )
      const ids: bigint[] = await mgr.getBorrowerLoans(address)
      const results = await Promise.all(
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
      setLoans(results)
    } catch (err) {
      console.error('Failed to load loans:', err)
    }
  }, [provider, address])

  useEffect(() => {
    load()
  }, [load])

  return { loans, refetch: load }
}

export function useAuctions(provider: ethers.BrowserProvider | null) {
  const [auctions, setAuctions] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!provider) return
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        provider,
      )
      const count = Number(await auc.auctionCount())
      const all = []
      for (let i = 0; i < count; i++) {
        const a = await auc.getAuction(i)
        all.push({
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
      setAuctions(all.filter((a) => !a.settled))
    } catch (err) {
      console.error('Failed to load auctions:', err)
    }
  }, [provider])

  useEffect(() => {
    load()
  }, [load])

  return { auctions, refetch: load }
}
