'use client'
import { useState } from 'react'
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

type Tab = 'offers' | 'borrow' | 'myloans' | 'auctions'

export default function Home() {
  const { signer, address, connect, provider } = useWallet()
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

  // Create Offer form
  const [offerEth, setOfferEth] = useState('')
  const [offerRate, setOfferRate] = useState('')
  const [offerDays, setOfferDays] = useState('')

  // Borrow form
  const [nftAddr, setNftAddr] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState('')

  // Bid form
  const [bidAuctionId, setBidAuctionId] = useState('')
  const [bidAmt, setBidAmt] = useState('')

  const toast = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 5000)
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
      await tx.wait()
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

      toast('Approving NFT...')
      const approveTx = await nft.approve(ADDRESSES.NFTEscrow, tokenId)
      await approveTx.wait()

      toast('Depositing NFT to escrow...')
      const depositTx = await escrowC.depositNFT(nftAddr, tokenId)
      const depositReceipt = await depositTx.wait()

      // Get escrowId from logs
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

      if (!escrowId) throw new Error('Could not get escrow ID from receipt')

      toast('Taking loan...')
      const loanTx = await loanMgr.takeLoan(escrowId, selectedOfferId)
      await loanTx.wait()
      toast('✅ Loan taken! Check My Loans.')
      refetchLoans()
      refetchOffers()
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  async function repayLoan(loanId: string, totalDue: string) {
    if (!signer) return
    setBusy(true)
    try {
      const loanMgr = new ethers.Contract(
        ADDRESSES.LoanManager,
        LOAN_MANAGER_ABI,
        signer,
      )
      // Add tiny buffer for interest accrual
      const due = ethers.parseEther(totalDue)
      const buffer = due / 1000n // 0.1% buffer
      const tx = await loanMgr.repayLoan(loanId, { value: due + buffer })
      await tx.wait()
      toast('✅ Loan repaid!')
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
      toast('✅ Default triggered, auction started')
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
      toast('✅ Bid placed!')
      refetchAuctions()
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
      const tx = await auc.withdrawRefund(auctionId)
      await tx.wait()
      toast('✅ Refund withdrawn!')
    } catch (e: any) {
      toast('❌ ' + (e.reason || e.message))
    }
    setBusy(false)
  }

  const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

  const statusColor = (s: string) => {
    if (s === 'Active') return '#34d399'
    if (s === 'Repaid') return '#a78bfa'
    if (s === 'Defaulted') return '#f87171'
    return '#6b7280'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
        </div>
        {address ? (
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
            {shortAddr(address)}
          </div>
        ) : (
          <button onClick={connect} style={btnStyle('#a78bfa')}>
            Connect Wallet
          </button>
        )}
      </header>

      {/* Status toast */}
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
            maxWidth: 340,
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
          {(['offers', 'borrow', 'myloans', 'auctions'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
                    : 'Auctions'}
            </button>
          ))}
        </div>

        {/* ===== LEND / OFFERS TAB ===== */}
        {tab === 'offers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Create Offer */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Create Lending Offer</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Amount (ETH)</label>
                  <input
                    value={offerEth}
                    onChange={(e) => setOfferEth(e.target.value)}
                    placeholder="1.0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Interest (basis pts)</label>
                  <input
                    value={offerRate}
                    onChange={(e) => setOfferRate(e.target.value)}
                    placeholder="1000 = 10%"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Duration (days)</label>
                  <input
                    value={offerDays}
                    onChange={(e) => setOfferDays(e.target.value)}
                    placeholder="30"
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={createOffer}
                disabled={busy || !signer}
                style={btnStyle('var(--accent)')}
              >
                {busy ? 'Processing…' : 'Create Offer'}
              </button>
            </div>

            {/* Active Offers List */}
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h2 style={headingStyle}>Active Offers</h2>
                <button
                  onClick={refetchOffers}
                  style={{
                    ...btnStyle('var(--border)'),
                    fontSize: 12,
                    padding: '6px 12px',
                    color: 'var(--muted)',
                  }}
                >
                  Refresh
                </button>
              </div>
              {offersLoading && (
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
              )}
              {!offersLoading && offers.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                  No active offers.
                </p>
              )}
              {offers.map((o) => (
                <div key={o.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        className="mono"
                        style={{ color: 'var(--accent)', fontSize: 13 }}
                      >
                        #{o.id}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>
                        {o.amount} ETH
                      </span>
                      <span style={pill('var(--green)')}>
                        {Number(o.rateBps) / 100}% APR
                      </span>
                      <span style={pill('var(--accent)')}>
                        {o.durationDays} days
                      </span>
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--muted)' }}
                    >
                      {o.lender}
                    </span>
                  </div>
                  {o.lender.toLowerCase() === address.toLowerCase() && (
                    <button
                      onClick={() => cancelOffer(o.id)}
                      disabled={busy}
                      style={{
                        ...btnStyle('var(--red)'),
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

        {/* ===== BORROW TAB ===== */}
        {tab === 'borrow' && (
          <div style={cardStyle}>
            <h2 style={headingStyle}>Borrow Against NFT</h2>
            <p
              style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}
            >
              Your NFT will be held in escrow. Repay before expiry to get it
              back.
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
                <label style={labelStyle}>NFT Contract Address</label>
                <input
                  value={nftAddr}
                  onChange={(e) => setNftAddr(e.target.value)}
                  placeholder="0x..."
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Token ID</label>
                <input
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Offer ID to Accept</label>
                <input
                  value={selectedOfferId}
                  onChange={(e) => setSelectedOfferId(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
                {offers.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Available offers:
                    </span>
                    {offers.map((o) => (
                      <div
                        key={o.id}
                        onClick={() => setSelectedOfferId(o.id)}
                        style={{
                          ...rowStyle,
                          cursor: 'pointer',
                          border:
                            selectedOfferId === o.id
                              ? '1px solid var(--accent)'
                              : '1px solid var(--border)',
                        }}
                      >
                        <span
                          className="mono"
                          style={{ color: 'var(--accent)', fontSize: 13 }}
                        >
                          #{o.id}
                        </span>
                        <span style={{ fontWeight: 700 }}>{o.amount} ETH</span>
                        <span style={pill('var(--green)')}>
                          {Number(o.rateBps) / 100}% APR
                        </span>
                        <span style={pill('var(--accent)')}>
                          {o.durationDays}d
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
              style={btnStyle('var(--accent)')}
            >
              {busy ? 'Processing…' : 'Deposit NFT & Take Loan'}
            </button>
          </div>
        )}

        {/* ===== MY LOANS TAB ===== */}
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
                  ...btnStyle('var(--border)'),
                  fontSize: 12,
                  padding: '6px 12px',
                  color: 'var(--muted)',
                }}
              >
                Refresh
              </button>
            </div>
            {loans.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>
                No loans found.
              </p>
            )}
            {loans.map((l) => (
              <div key={l.id} style={cardStyle}>
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
                        marginBottom: 6,
                      }}
                    >
                      <span
                        className="mono"
                        style={{ color: 'var(--accent)', fontSize: 13 }}
                      >
                        Loan #{l.id}
                      </span>
                      <span
                        style={{ ...pill(statusColor(l.status)), fontSize: 12 }}
                      >
                        {l.status}
                      </span>
                      {l.expired && l.status === 'Active' && (
                        <span style={pill('var(--red)')}>EXPIRED</span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px 24px',
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Principal:{' '}
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                          {l.principal} ETH
                        </span>
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Rate:{' '}
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                          {Number(l.rateBps) / 100}%
                        </span>
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Duration:{' '}
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
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
                      onClick={() => repayLoan(l.id, l.totalDue)}
                      disabled={busy}
                      style={btnStyle('var(--green)')}
                    >
                      Repay Loan
                    </button>
                    {l.expired && (
                      <button
                        onClick={() => triggerDefault(l.id)}
                        disabled={busy}
                        style={btnStyle('var(--red)')}
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

        {/* ===== AUCTIONS TAB ===== */}
        {tab === 'auctions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Place Bid Form */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Place a Bid</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Auction ID</label>
                  <input
                    value={bidAuctionId}
                    onChange={(e) => setBidAuctionId(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bid Amount (ETH)</label>
                  <input
                    value={bidAmt}
                    onChange={(e) => setBidAmt(e.target.value)}
                    placeholder="1.5"
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={placeBid}
                disabled={busy || !signer || !bidAuctionId || !bidAmt}
                style={btnStyle('var(--accent2)')}
              >
                Place Bid
              </button>
            </div>

            {/* Active Auctions */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Live Auctions</h2>
                <button
                  onClick={refetchAuctions}
                  style={{
                    ...btnStyle('var(--border)'),
                    fontSize: 12,
                    padding: '6px 12px',
                    color: 'var(--muted)',
                  }}
                >
                  Refresh
                </button>
              </div>
              {auctions.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>
                  No active auctions.
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
                  <div key={a.id} style={{ ...cardStyle, marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <span
                            className="mono"
                            style={{ color: 'var(--accent2)', fontSize: 13 }}
                          >
                            Auction #{a.id}
                          </span>
                          <span
                            style={pill(ended ? 'var(--red)' : 'var(--green)')}
                          >
                            {ended ? 'ENDED' : 'LIVE'}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '4px 24px',
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
                              style={{
                                color: 'var(--yellow)',
                                fontWeight: 700,
                              }}
                            >
                              {a.highestBid} ETH
                            </span>
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                            {ended ? 'Ended' : `${hours}h ${mins}m left`}
                          </span>
                        </div>
                        {a.highestBidder !==
                          '0x0000000000000000000000000000000000000000' && (
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: 'var(--muted)',
                              marginTop: 4,
                              display: 'block',
                            }}
                          >
                            Top bidder: {shortAddr(a.highestBidder)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {ended && (
                        <button
                          onClick={() => settleAuction(a.id)}
                          disabled={busy}
                          style={btnStyle('var(--green)')}
                        >
                          Settle Auction
                        </button>
                      )}
                      <button
                        onClick={() => withdrawRefund(a.id)}
                        disabled={busy}
                        style={{
                          ...btnStyle('var(--border)'),
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
      </main>
    </div>
  )
}

// Style helpers
const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '12px 16px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 8,
}

const headingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 16,
  letterSpacing: '-0.3px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted)',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: color,
    color:
      color === 'var(--accent)' ||
      color === 'var(--green)' ||
      color === 'var(--accent2)'
        ? '#0a0a0f'
        : 'var(--text)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Syne', sans-serif",
    opacity: 1,
    transition: 'opacity 0.15s',
  }
}

function pill(color: string): React.CSSProperties {
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
  