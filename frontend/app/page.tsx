'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ethers } from 'ethers'
import { useWallet, useOffers, useLoans, useAuctions } from '../lib/hooks'
import {
  ADDRESSES,
  LENDING_POOL_ABI,
  NFT_ESCROW_ABI,
  LOAN_MANAGER_ABI,
  LIQUIDATION_AUCTION_ABI,
  ERC721_ABI,
} from '../lib/contracts'
import dynamic from 'next/dynamic'

const LiquidEther = dynamic(() => import('../components/LiquidEther'), {
  ssr: false,
})

type Tab = 'offers' | 'borrow' | 'myloans' | 'auctions' | 'portfolio'

export default function Home() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [pendingRefunds, setPendingRefunds] = useState<Record<string, string>>(
    {},
  )

  // Check if user is logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setAuthUser(d.user)
        else router.replace('/login')
      })
      .catch(() => router.replace('/login'))
      .finally(() => setAuthLoading(false))
  }, [router])
  const {
    signer,
    address,
    connect,
    disconnect,
    disconnecting,
    wrongNetwork,
    provider,
  } = useWallet(authLoading ? undefined : authUser?.walletAddress || '')
  const {
    offers,
    loading: offersLoading,
    refetch: refetchOffers,
  } = useOffers(provider)
  const { loans, refetch: refetchLoans } = useLoans(provider, address)
  const { auctions, refetch: refetchAuctions } = useAuctions(provider)

  const [tab, setTab] = useState<Tab>('offers')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const [offerEth, setOfferEth] = useState('')
  const [offerRate, setOfferRate] = useState('')
  const [offerDays, setOfferDays] = useState('')

  const [nftAddr, setNftAddr] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState('')

  const [bidAuctionId, setBidAuctionId] = useState('')
  const [bidAmt, setBidAmt] = useState('')

  // Once wallet connects, save wallet address to DB
  useEffect(() => {
    if (!address || !authUser) return
    if (address.toLowerCase() === (authUser.walletAddress || '').toLowerCase())
      return

    fetch('/api/user/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setAuthUser({ ...d.user, walletAddress: address })
      })
  }, [address, authUser])

  // Restore last active tab from DB
  useEffect(() => {
    if (authUser?.lastActiveTab) setTab(authUser.lastActiveTab as Tab)
  }, [authUser])

  // Save active tab to DB whenever it changes
  function switchTab(t: Tab) {
    setTab(t)
    fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastActiveTab: t }),
    })
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Save an offerId to user account
  async function saveOfferId(id: string) {
    if (!authUser) return
    const updated = [...new Set([...(authUser.offerIds || []), id])]
    const res = await fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerIds: updated }),
    })
    const d = await res.json()
    if (d.user) setAuthUser(d.user)
  }

  async function saveLoanId(id: string) {
    if (!authUser) return
    const updated = [...new Set([...(authUser.loanIds || []), id])]
    const res = await fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanIds: updated }),
    })
    const d = await res.json()
    if (d.user) setAuthUser(d.user)
  }

  async function saveEscrowId(id: string) {
    if (!authUser) return
    const updated = [...new Set([...(authUser.escrowIds || []), id])]
    const res = await fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrowIds: updated }),
    })
    const d = await res.json()
    if (d.user) setAuthUser(d.user)
  }

  async function saveAuctionId(id: string) {
    if (!authUser) return
    const updated = [...new Set([...(authUser.auctionIds || []), id])]
    const res = await fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auctionIds: updated }),
    })
    const d = await res.json()
    if (d.user) setAuthUser(d.user)
  }

  const toast = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 6000)
  }

  async function createOffer() {
    if (!signer) return
    setBusy(true)
    try {
      const pool = new ethers.Contract(
        ADDRESSES.LendingPool,
        LENDING_POOL_ABI,
        signer,
      )
      const tx = await pool.createOffer(Number(offerRate), Number(offerDays), {
        value: ethers.parseEther(offerEth),
      })
      const receipt = await tx.wait()
      // Get offerId from logs (offerCount - 1 approach as fallback)
      const poolRead = new ethers.Contract(
        ADDRESSES.LendingPool,
        LENDING_POOL_ABI,
        provider!,
      )
      const count = await poolRead.offerCount()
      const newOfferId = (Number(count) - 1).toString()
      await saveOfferId(newOfferId)
      toast('✅ Offer created!')
      refetchOffers()
      setOfferEth('')
      setOfferRate('')
      setOfferDays('')
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function cancelOffer(offerId: string) {
    if (!signer) return
    setBusy(true)
    try {
      const pool = new ethers.Contract(
        ADDRESSES.LendingPool,
        LENDING_POOL_ABI,
        signer,
      )
      const tx = await pool.cancelOffer(offerId)
      await tx.wait()
      toast('✅ Offer cancelled')
      refetchOffers()
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function depositAndBorrow() {
    if (!signer) return
    setBusy(true)
    try {
      const nft = new ethers.Contract(nftAddr, ERC721_ABI, signer)
      const escrowC = new ethers.Contract(
        ADDRESSES.NFTEscrow,
        NFT_ESCROW_ABI,
        signer,
      )
      const loanMgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        signer,
      )

      toast('Step 1/3 — Approving NFT transfer...')
      const approveTx = await nft.approve(ADDRESSES.NFTEscrow, tokenId)
      await approveTx.wait()

      toast('Step 2/3 — Depositing NFT to escrow...')
      const depositTx = await escrowC.depositNFT(nftAddr, tokenId)
      const depositReceipt = await depositTx.wait()

      const iface = new ethers.Interface([
        'event NFTDeposited(bytes32 indexed escrowId, address indexed owner, address nftContract, uint256 tokenId)',
      ])
      let escrowId = ''
      for (const log of depositReceipt.logs) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed) {
            escrowId = parsed.args[0]
            break
          }
        } catch {}
      }
      if (!escrowId)
        throw new Error('Could not find escrow ID in transaction logs')

      // Save escrow
      await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushEscrow: {
            escrowId,
            nftContract: nftAddr,
            tokenId,
            status: 'locked',
          },
        }),
      })

      // Push NFT to portfolio as in_escrow
      await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushNFTPortfolio: {
            nftContract: nftAddr,
            tokenId,
            escrowId,
            loanId: null,
            status: 'in_escrow',
            depositedAt: new Date().toISOString(),
          },
        }),
      })

      toast('Step 3/3 — Taking loan...')
      const loanTx = await loanMgr.takeLoan(escrowId, selectedOfferId)
      await loanTx.wait()

      const loanMgrRead = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        provider!,
      )
      const loanCount = await loanMgrRead.loanCount()
      const newLoanId = (Number(loanCount) - 1).toString()

      // Save loan
      await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushLoan: {
            loanId: newLoanId,
            escrowId,
            offerId: selectedOfferId,
            status: 'Active',
          },
        }),
      })

      // Update NFT portfolio to locked_in_loan
      const res = await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateNFTPortfolioStatus: {
            escrowId,
            status: 'locked_in_loan',
            loanId: newLoanId,
          },
        }),
      })
      const d = await res.json()
      if (d.user) setAuthUser(d.user)

      toast('✅ Loan taken! Check My Loans tab.')
      refetchLoans()
      refetchOffers()
      setNftAddr('')
      setTokenId('')
      setSelectedOfferId('')
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function repayLoan(
    loanId: string,
    totalDue: string,
    escrowId?: string,
  ) {
    if (!signer) return
    setBusy(true)
    try {
      const loanMgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        signer,
      )
      const due = ethers.parseEther(totalDue)
      const buffer = due / 1000n
      const tx = await loanMgr.repayLoan(loanId, { value: due + buffer })
      const receipt = await tx.wait()

      // Get actual repaid amount from tx value
      const repaidAmount = ethers.formatEther(due + buffer)
      const now = new Date().toISOString()

      // Update loan status in DB
      await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateLoanStatus: {
            loanId,
            status: 'Repaid',
            repaidAt: now,
            repaidAmount,
          },
        }),
      })

      // Update NFT portfolio to returned
      if (escrowId) {
        const res = await fetch('/api/user/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateNFTPortfolioStatus: {
              escrowId,
              status: 'returned',
              resolvedAt: now,
            },
          }),
        })
        const d = await res.json()
        if (d.user) setAuthUser(d.user)
      }

      toast('✅ Loan repaid! Your NFT is back.')
      refetchLoans()
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function triggerDefault(loanId: string) {
    if (!signer) return
    setBusy(true)
    try {
      const loanMgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        signer,
      )
      const tx = await loanMgr.triggerDefault(loanId)
      await tx.wait()

      // Get auctionId from auctionCount
      const aucRead = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        provider!,
      )
      const aucCount = await aucRead.auctionCount()
      const newAucId = (Number(aucCount) - 1).toString()
      await saveAuctionId(newAucId)

      toast('✅ Default triggered — auction started')
      refetchLoans()
      refetchAuctions()
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function placeBid() {
    if (!signer) return
    setBusy(true)
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        signer,
      )
      const tx = await auc.placeBid(bidAuctionId, {
        value: ethers.parseEther(bidAmt),
      })
      await tx.wait()
      await saveAuctionId(bidAuctionId)
      toast('✅ Bid placed!')
      refetchAuctions()
      setBidAmt('')
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function settleAuction(auctionId: string) {
    if (!signer) return
    setBusy(true)
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        signer,
      )
      const tx = await auc.settleAuction(auctionId)
      await tx.wait()
      toast('✅ Auction settled!')
      refetchAuctions()
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function withdrawRefund(auctionId: string) {
    if (!signer) return
    setBusy(true)
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        signer,
      )

      // Get refund amount BEFORE withdrawing
      const pending = await auc.pendingReturns(auctionId, address)
      const refundWithdrawnAmount = ethers.formatEther(pending)

      const tx = await auc.withdrawRefund(auctionId)
      await tx.wait()

      const res = await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateBidRefundWithdrawn: {
            auctionId,
            refundWithdrawnAmount,
            refundWithdrawnAt: new Date().toISOString(),
          },
        }),
      })
      const d = await res.json()
      if (d.user) setAuthUser(d.user)

      toast(`✅ Refund of ${refundWithdrawnAmount} ETH withdrawn!`)
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function syncPendingRefunds() {
    if (!provider || !address || !authUser?.bids?.length) return
    try {
      const auc = new ethers.Contract(
        ADDRESSES.LiquidationAuction,
        LIQUIDATION_AUCTION_ABI,
        provider,
      )
      const pendingBids = authUser.bids.filter(
        (b: any) => b.outcome === 'pending' || b.outcome === 'outbid',
      )
      if (!pendingBids.length) return

      const syncData: any[] = []
      const refundMap: Record<string, string> = {}

      for (const bid of pendingBids) {
        try {
          const auction = await auc.getAuction(bid.auctionId)
          const pending = await auc.pendingReturns(bid.auctionId, address)
          const pendingEth = ethers.formatEther(pending)

          // Determine outcome
          let outcome = bid.outcome
          if (auction.settled) {
            outcome =
              auction.highestBidder.toLowerCase() === address.toLowerCase()
                ? 'won'
                : 'outbid'
          } else if (
            auction.highestBidder.toLowerCase() !== address.toLowerCase() &&
            Number(pending) > 0
          ) {
            outcome = 'outbid'
          }

          if (Number(pendingEth) > 0) refundMap[bid.auctionId] = pendingEth

          syncData.push({
            auctionId: bid.auctionId,
            refundAmount: pendingEth,
            outcome,
          })
        } catch {}
      }

      if (syncData.length) {
        const res = await fetch('/api/user/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncBidRefunds: syncData }),
        })
        const d = await res.json()
        if (d.user) setAuthUser(d.user)
      }

      setPendingRefunds(refundMap)
    } catch (err) {
      console.error('syncPendingRefunds error:', err)
    }
  }

  // ADD this useEffect to sync refunds when provider/address/authUser loads:
  useEffect(() => {
    if (provider && address && authUser) {
      syncPendingRefunds()
    }
  }, [provider, address, authUser?.bids?.length])
  const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

  const statusColor = (s: string) => {
    if (s === 'Active') return 'var(--green)'
    if (s === 'Repaid') return 'var(--accent)'
    if (s === 'Defaulted') return 'var(--red)'
    return 'var(--muted)'
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>Loading...</p>
      </div>
    )
  }

  if (!authUser) return null

  return (
    <>
      <div className="liquid-bg-wrapper">
        <LiquidEther
          colors={['#5227FF', '#FF9FFC', '#B497CF']}
          mouseForce={20}
          cursorSize={100}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          resolution={0.5}
        />
      </div>
      <div
        className="liquid-page-content"
        style={{ minHeight: '100vh', background: 'transparent' }}
      >
        {/* Header */}
        <header
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '0 24px',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'rgba(10,10,15,0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background:
                  'linear-gradient(135deg, var(--accent), var(--accent2))',
              }}
            />
            <span
              style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}
            >
              LiquidNFT
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              Sepolia Testnet
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {wrongNetwork && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--red)',
                  background: '#f8717122',
                  border: '1px solid #f8717144',
                  borderRadius: 6,
                  padding: '4px 10px',
                }}
              >
                Wrong network — switch to Sepolia
              </span>
            )}

            {/* Logged-in email */}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {authUser.email}
            </span>

            {address ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontFamily: "'Space Mono', monospace",
                    color: 'var(--accent)',
                  }}
                >
                  {short(address)}
                </div>
                <button
                  onClick={async () => {
                    await disconnect()
                    setAuthUser((u: any) => ({ ...u, walletAddress: '' }))
                  }}
                  disabled={disconnecting}
                  style={{
                    fontSize: 12,
                    color: 'var(--red)',
                    background: 'transparent',
                    border: '1px solid var(--red)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    cursor: disconnecting ? 'not-allowed' : 'pointer',
                    opacity: disconnecting ? 0.6 : 1,
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <button onClick={connect} style={btn('var(--accent)')}>
                Connect Wallet
              </button>
            )}

            <button
              onClick={logout}
              style={{
                ...btn('var(--border)'),
                fontSize: 12,
                padding: '6px 14px',
                color: 'var(--muted)',
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Toast */}
        {status && (
          <div
            style={{
              position: 'fixed',
              top: 70,
              right: 20,
              zIndex: 999,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              maxWidth: 360,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {status}
          </div>
        )}

        <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: 32,
              background: 'var(--surface)',
              borderRadius: 10,
              padding: 4,
              border: '1px solid var(--border)',
            }}
          >
            {(
              ['offers', 'borrow', 'myloans', 'auctions', 'portfolio'] as Tab[]
            ).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 7,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#0a0a0f' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'offers'
                  ? 'Lend'
                  : t === 'borrow'
                    ? 'Borrow'
                    : t === 'myloans'
                      ? 'My Loans'
                      : t === 'auctions'
                        ? 'Auctions'
                        : 'Portfolio'}
              </button>
            ))}
          </div>

          {/* ── LEND TAB ── */}
          {tab === 'offers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={card}>
                <h2 style={heading}>Create Lending Offer</h2>
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: 13,
                    marginBottom: 18,
                  }}
                >
                  Send ETH and set your terms. Funds lock here until a borrower
                  accepts or you cancel.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={label}>Amount (ETH)</label>
                    <input
                      value={offerEth}
                      onChange={(e) => setOfferEth(e.target.value)}
                      placeholder="0.5"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={label}>Interest (basis pts)</label>
                    <input
                      value={offerRate}
                      onChange={(e) => setOfferRate(e.target.value)}
                      placeholder="1000 = 10%"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={label}>Duration (days)</label>
                    <input
                      value={offerDays}
                      onChange={(e) => setOfferDays(e.target.value)}
                      placeholder="30"
                      style={input}
                    />
                  </div>
                </div>
                <button
                  onClick={createOffer}
                  disabled={
                    busy || !signer || !offerEth || !offerRate || !offerDays
                  }
                  style={btn('var(--accent)')}
                >
                  {busy ? 'Waiting...' : 'Create Offer'}
                </button>
              </div>

              <div style={card}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <h2 style={heading}>Active Offers</h2>
                  <button
                    onClick={refetchOffers}
                    style={{
                      ...btn('var(--border)'),
                      fontSize: 12,
                      padding: '6px 12px',
                      color: 'var(--muted)',
                    }}
                  >
                    Refresh
                  </button>
                </div>
                {offersLoading && (
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    Loading...
                  </p>
                )}
                {!offersLoading && offers.length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    No active offers yet.
                  </p>
                )}
                {offers.map((o) => (
                  <div key={o.id} style={row}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <span
                          className="mono"
                          style={{ color: 'var(--accent)', fontSize: 12 }}
                        >
                          #{o.id}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>
                          {o.amount} ETH
                        </span>
                        <span style={badge('var(--green)')}>
                          {Number(o.rateBps) / 100}% APR
                        </span>
                        <span style={badge('var(--accent)')}>
                          {o.durationDays}d
                        </span>
                      </div>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--muted)' }}
                      >
                        {o.lender}
                      </span>
                    </div>
                    {address &&
                      o.lender.toLowerCase() === address.toLowerCase() && (
                        <button
                          onClick={() => cancelOffer(o.id)}
                          disabled={busy}
                          style={{
                            ...btn('var(--red)'),
                            fontSize: 12,
                            padding: '6px 12px',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BORROW TAB ── */}
          {tab === 'borrow' && (
            <div style={card}>
              <h2 style={heading}>Borrow Against Your NFT</h2>
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                Your NFT is held in escrow for the loan duration. Repay on time
                to get it back. If you miss the deadline, it goes to auction.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label style={label}>NFT Contract Address</label>
                  <input
                    value={nftAddr}
                    onChange={(e) => setNftAddr(e.target.value)}
                    placeholder="0x..."
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Token ID</label>
                  <input
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="0"
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Select Offer</label>
                  {offers.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                      No offers available. Check the Lend tab.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {offers.map((o) => (
                        <div
                          key={o.id}
                          onClick={() => setSelectedOfferId(o.id)}
                          style={{
                            ...row,
                            cursor: 'pointer',
                            border:
                              selectedOfferId === o.id
                                ? '1px solid var(--accent)'
                                : '1px solid var(--border)',
                            background:
                              selectedOfferId === o.id
                                ? '#a78bfa11'
                                : 'var(--bg)',
                          }}
                        >
                          <span
                            className="mono"
                            style={{ color: 'var(--accent)', fontSize: 12 }}
                          >
                            #{o.id}
                          </span>
                          <span style={{ fontWeight: 700 }}>
                            {o.amount} ETH
                          </span>
                          <span style={badge('var(--green)')}>
                            {Number(o.rateBps) / 100}% APR
                          </span>
                          <span style={badge('var(--accent)')}>
                            {o.durationDays} days
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={depositAndBorrow}
                disabled={
                  busy || !signer || !nftAddr || !tokenId || !selectedOfferId
                }
                style={btn('var(--accent)')}
              >
                {busy ? 'Processing...' : 'Deposit NFT & Take Loan'}
              </button>
            </div>
          )}

          {/* ── MY LOANS TAB ── */}
          {tab === 'myloans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>My Loans</h2>
                <button
                  onClick={refetchLoans}
                  style={{
                    ...btn('var(--border)'),
                    fontSize: 12,
                    padding: '6px 12px',
                    color: 'var(--muted)',
                  }}
                >
                  Refresh
                </button>
              </div>
              {!address && (
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                  Connect your wallet to see loans.
                </p>
              )}
              {address && loans.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>
                  No loans found.
                </p>
              )}
              {loans.map((l) => (
                <div key={l.id} style={card}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          marginBottom: 10,
                        }}
                      >
                        <span
                          className="mono"
                          style={{ color: 'var(--accent)', fontSize: 13 }}
                        >
                          Loan #{l.id}
                        </span>
                        <span style={badge(statusColor(l.status))}>
                          {l.status}
                        </span>
                        {l.expired && l.status === 'Active' && (
                          <span style={badge('var(--red)')}>EXPIRED</span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '6px 32px',
                        }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Principal:{' '}
                          <span
                            style={{ color: 'var(--text)', fontWeight: 600 }}
                          >
                            {l.principal} ETH
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Rate:{' '}
                          <span
                            style={{ color: 'var(--text)', fontWeight: 600 }}
                          >
                            {Number(l.rateBps) / 100}% APR
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Duration:{' '}
                          <span
                            style={{ color: 'var(--text)', fontWeight: 600 }}
                          >
                            {l.durationDays} days
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Total Due:{' '}
                          <span
                            style={{ color: 'var(--yellow)', fontWeight: 700 }}
                          >
                            {parseFloat(l.totalDue).toFixed(6)} ETH
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {l.status === 'Active' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => {
                          const dbLoan = authUser?.loans?.find(
                            (dl: any) => dl.loanId === l.id,
                          )
                          repayLoan(l.id, l.totalDue, dbLoan?.escrowId)
                        }}
                        disabled={busy}
                        style={btn('var(--green)')}
                      >
                        Repay Loan
                      </button>
                      {l.expired && (
                        <button
                          onClick={() => {
                            const dbLoan = authUser?.loans?.find(
                              (dl: any) => dl.loanId === l.id,
                            )
                            triggerDefault(l.id, dbLoan?.escrowId)
                          }}
                          disabled={busy}
                          style={btn('var(--red)')}
                        >
                          Trigger Default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── AUCTIONS TAB ── */}
          {tab === 'auctions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={card}>
                <h2 style={heading}>Place a Bid</h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label style={label}>Auction ID</label>
                    <input
                      value={bidAuctionId}
                      onChange={(e) => setBidAuctionId(e.target.value)}
                      placeholder="0"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={label}>Bid Amount (ETH)</label>
                    <input
                      value={bidAmt}
                      onChange={(e) => setBidAmt(e.target.value)}
                      placeholder="1.5"
                      style={input}
                    />
                  </div>
                </div>
                <button
                  onClick={placeBid}
                  disabled={busy || !signer || !bidAuctionId || !bidAmt}
                  style={btn('var(--accent2)')}
                >
                  {busy ? 'Waiting...' : 'Place Bid'}
                </button>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    Live Auctions
                  </h2>
                  <button
                    onClick={refetchAuctions}
                    style={{
                      ...btn('var(--border)'),
                      fontSize: 12,
                      padding: '6px 12px',
                      color: 'var(--muted)',
                    }}
                  >
                    Refresh
                  </button>
                </div>
                {auctions.length === 0 && (
                  <p
                    style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}
                  >
                    No auctions running.
                  </p>
                )}
                {auctions.map((a) => {
                  const ended = Date.now() / 1000 > a.endTime
                  const timeLeft = Math.max(
                    0,
                    a.endTime - Math.floor(Date.now() / 1000),
                  )
                  const hours = Math.floor(timeLeft / 3600)
                  const mins = Math.floor((timeLeft % 3600) / 60)
                  return (
                    <div key={a.id} style={{ ...card, marginBottom: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          marginBottom: 10,
                        }}
                      >
                        <span
                          className="mono"
                          style={{ color: 'var(--accent2)', fontSize: 13 }}
                        >
                          Auction #{a.id}
                        </span>
                        <span
                          style={badge(ended ? 'var(--red)' : 'var(--green)')}
                        >
                          {ended ? 'ENDED' : 'LIVE'}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '6px 32px',
                          marginBottom: 14,
                        }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Loan:{' '}
                          <span style={{ color: 'var(--text)' }}>
                            #{a.loanId}
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Min Bid:{' '}
                          <span
                            style={{ color: 'var(--text)', fontWeight: 600 }}
                          >
                            {a.minBid} ETH
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Top Bid:{' '}
                          <span
                            style={{ color: 'var(--yellow)', fontWeight: 700 }}
                          >
                            {a.highestBid} ETH
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {ended ? 'Auction ended' : `${hours}h ${mins}m left`}
                        </span>
                      </div>
                      {a.highestBidder !==
                        '0x0000000000000000000000000000000000000000' && (
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--muted)',
                            display: 'block',
                            marginBottom: 12,
                          }}
                        >
                          Top bidder: {short(a.highestBidder)}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: 10 }}>
                        {ended && (
                          <button
                            onClick={() => settleAuction(a.id)}
                            disabled={busy}
                            style={btn('var(--green)')}
                          >
                            Settle Auction
                          </button>
                        )}
                        <button
                          onClick={() => withdrawRefund(a.id)}
                          disabled={busy}
                          style={{
                            ...btn('var(--border)'),
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          Withdraw Refund
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PORTFOLIO TAB ── */}
          {tab === 'portfolio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* NFT Portfolio */}
              <div style={card}>
                <h2 style={heading}>NFT Portfolio</h2>
                {(!authUser.nftPortfolio ||
                  authUser.nftPortfolio.length === 0) && (
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    No NFTs deposited yet.
                  </p>
                )}
                {(authUser.nftPortfolio || []).map((item: any, i: number) => {
                  const statusColors: Record<string, string> = {
                    in_escrow: 'var(--accent)',
                    locked_in_loan: 'var(--yellow)',
                    returned: 'var(--green)',
                    liquidated: 'var(--red)',
                  }
                  const statusLabels: Record<string, string> = {
                    in_escrow: 'In Escrow',
                    locked_in_loan: 'Locked (Active Loan)',
                    returned: 'Returned',
                    liquidated: 'Liquidated',
                  }
                  return (
                    <div key={i} style={row}>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={badge(
                              statusColors[item.status] || 'var(--muted)',
                            )}
                          >
                            {statusLabels[item.status] || item.status}
                          </span>
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: 'var(--muted)' }}
                          >
                            Token #{item.tokenId}
                          </span>
                        </div>
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: 'var(--muted)' }}
                        >
                          {item.nftContract}
                        </span>
                        {item.loanId && (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--muted)',
                              display: 'block',
                              marginTop: 2,
                            }}
                          >
                            Loan #{item.loanId}
                          </span>
                        )}
                        {item.resolvedAt && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--muted)',
                              display: 'block',
                              marginTop: 2,
                            }}
                          >
                            Resolved:{' '}
                            {new Date(item.resolvedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bid History + Pending Refunds */}
              <div style={card}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <h2 style={heading}>Bid History & Refunds</h2>
                  <button
                    onClick={syncPendingRefunds}
                    style={{
                      ...btn('var(--border)'),
                      fontSize: 12,
                      padding: '6px 12px',
                      color: 'var(--muted)',
                    }}
                  >
                    Sync Refunds
                  </button>
                </div>
                {(!authUser.bids || authUser.bids.length === 0) && (
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    No bids placed yet.
                  </p>
                )}
                {(authUser.bids || []).map((bid: any, i: number) => {
                  const outcomeColors: Record<string, string> = {
                    pending: 'var(--muted)',
                    won: 'var(--green)',
                    outbid: 'var(--red)',
                    refunded: 'var(--accent)',
                  }
                  const pendingRefundAmount = pendingRefunds[bid.auctionId]
                  return (
                    <div key={i} style={row}>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <span
                            className="mono"
                            style={{ color: 'var(--accent2)', fontSize: 12 }}
                          >
                            Auction #{bid.auctionId}
                          </span>
                          <span
                            style={badge(
                              outcomeColors[bid.outcome] || 'var(--muted)',
                            )}
                          >
                            {bid.outcome}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            {bid.amount} ETH
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Placed: {new Date(bid.placedAt).toLocaleDateString()}
                        </span>
                        {pendingRefundAmount &&
                          Number(pendingRefundAmount) > 0 && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--yellow)',
                                display: 'block',
                                marginTop: 2,
                              }}
                            >
                              Pending refund: {pendingRefundAmount} ETH
                            </span>
                          )}
                        {bid.refundWithdrawnAmount && (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--green)',
                              display: 'block',
                              marginTop: 2,
                            }}
                          >
                            Withdrawn: {bid.refundWithdrawnAmount} ETH
                            {bid.refundWithdrawnAt &&
                              ` on ${new Date(bid.refundWithdrawnAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                      {(bid.outcome === 'outbid' ||
                        (bid.outcome === 'pending' &&
                          pendingRefundAmount &&
                          Number(pendingRefundAmount) > 0)) && (
                        <button
                          onClick={() => withdrawRefund(bid.auctionId)}
                          disabled={busy}
                          style={{
                            ...btn('var(--accent)'),
                            fontSize: 12,
                            padding: '6px 12px',
                          }}
                        >
                          Withdraw{' '}
                          {pendingRefundAmount || bid.refundAmount || ''} ETH
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Auctions Won */}
              <div style={card}>
                <h2 style={heading}>Auctions Won</h2>
                {(!authUser.auctionsWon ||
                  authUser.auctionsWon.length === 0) && (
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    No auctions won yet.
                  </p>
                )}
                {(authUser.auctionsWon || []).map((aw: any, i: number) => (
                  <div key={i} style={row}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <span style={badge('var(--green)')}>WON</span>
                        <span
                          className="mono"
                          style={{ fontSize: 12, color: 'var(--muted)' }}
                        >
                          Token #{aw.tokenId}
                        </span>
                        <span style={{ fontWeight: 700 }}>
                          {aw.paidAmount} ETH
                        </span>
                      </div>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--muted)' }}
                      >
                        {aw.nftContract}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--muted)',
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                        Won: {new Date(aw.wonAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

// ── Style constants ──

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
}

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '12px 16px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 8,
}

const heading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 16,
  letterSpacing: '-0.3px',
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--muted)',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const input: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}

function btn(color: string): React.CSSProperties {
  const darkText = ['var(--accent)', 'var(--green)', 'var(--accent2)'].includes(
    color,
  )
  return {
    background: color,
    color: darkText ? '#0a0a0f' : 'var(--text)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Syne', sans-serif",
    transition: 'opacity 0.15s',
  }
}

function badge(color: string): React.CSSProperties {
  return {
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  }
}
