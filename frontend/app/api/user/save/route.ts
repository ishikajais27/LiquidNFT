import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models/User'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value
    if (!token)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await req.json()

    const allowed = [
      'lastActiveTab',
      'preferredNetwork',
      'repaymentBufferAcknowledged',
      'notificationPrefs',
      'totalEthLent',
      'offersCreated',
      'offersMatched',
      'offersCancelled',
    ]

    const update: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    await connectDB()

    let mongoUpdate: Record<string, any> = {}
    if (Object.keys(update).length) mongoUpdate['$set'] = update

    if (body.pushOffer)
      mongoUpdate['$push'] = { ...mongoUpdate['$push'], offers: body.pushOffer }
    if (body.pushEscrow)
      mongoUpdate['$push'] = {
        ...mongoUpdate['$push'],
        escrows: body.pushEscrow,
      }
    if (body.pushLoan)
      mongoUpdate['$push'] = { ...mongoUpdate['$push'], loans: body.pushLoan }
    if (body.pushBid)
      mongoUpdate['$push'] = { ...mongoUpdate['$push'], bids: body.pushBid }
    if (body.pushAuctionWon)
      mongoUpdate['$push'] = {
        ...mongoUpdate['$push'],
        auctionsWon: body.pushAuctionWon,
      }
    if (body.pushNFTPortfolio)
      mongoUpdate['$push'] = {
        ...mongoUpdate['$push'],
        nftPortfolio: body.pushNFTPortfolio,
      }

    // Subdoc updates
    if (body.updateOfferStatus) {
      const { offerId, status } = body.updateOfferStatus
      await User.updateOne(
        { _id: payload.userId, 'offers.offerId': offerId },
        { $set: { 'offers.$.status': status } },
      )
    }

    if (body.updateLoanStatus) {
      const { loanId, status, repaidAt, repaidAmount, overpaymentRefund } =
        body.updateLoanStatus
      const loanFields: Record<string, any> = { 'loans.$.status': status }
      if (repaidAt) loanFields['loans.$.repaidAt'] = repaidAt
      if (repaidAmount) loanFields['loans.$.repaidAmount'] = repaidAmount
      if (overpaymentRefund)
        loanFields['loans.$.overpaymentRefund'] = overpaymentRefund
      await User.updateOne(
        { _id: payload.userId, 'loans.loanId': loanId },
        { $set: loanFields },
      )
    }

    if (body.updateEscrowStatus) {
      const { escrowId, status } = body.updateEscrowStatus
      await User.updateOne(
        { _id: payload.userId, 'escrows.escrowId': escrowId },
        { $set: { 'escrows.$.status': status } },
      )
    }

    if (body.updateBidOutcome) {
      const { auctionId, outcome, refundAmount, refundWithdrawnAt } =
        body.updateBidOutcome
      const bidFields: Record<string, any> = { 'bids.$.outcome': outcome }
      if (refundAmount) bidFields['bids.$.refundAmount'] = refundAmount
      if (refundWithdrawnAt)
        bidFields['bids.$.refundWithdrawnAt'] = refundWithdrawnAt
      await User.updateOne(
        { _id: payload.userId, 'bids.auctionId': auctionId },
        { $set: bidFields },
      )
    }

    // NEW: update bid refund withdrawn (amount + timestamp + mark refunded)
    if (body.updateBidRefundWithdrawn) {
      const { auctionId, refundWithdrawnAmount, refundWithdrawnAt } =
        body.updateBidRefundWithdrawn
      await User.updateOne(
        { _id: payload.userId, 'bids.auctionId': auctionId },
        {
          $set: {
            'bids.$.outcome': 'refunded',
            'bids.$.refundWithdrawnAmount': refundWithdrawnAmount,
            'bids.$.refundWithdrawnAt': refundWithdrawnAt,
          },
        },
      )
    }

    // NEW: update NFT portfolio item status by escrowId
    if (body.updateNFTPortfolioStatus) {
      const { escrowId, status, resolvedAt, loanId } =
        body.updateNFTPortfolioStatus
      const fields: Record<string, any> = { 'nftPortfolio.$.status': status }
      if (resolvedAt) fields['nftPortfolio.$.resolvedAt'] = resolvedAt
      if (loanId) fields['nftPortfolio.$.loanId'] = loanId
      await User.updateOne(
        { _id: payload.userId, 'nftPortfolio.escrowId': escrowId },
        { $set: fields },
      )
    }

    // NEW: sync pending refund amounts from contract for multiple bids at once
    if (body.syncBidRefunds && Array.isArray(body.syncBidRefunds)) {
      for (const bid of body.syncBidRefunds) {
        const bidFields: Record<string, any> = {}
        if (bid.refundAmount !== undefined)
          bidFields['bids.$.refundAmount'] = bid.refundAmount
        if (bid.outcome) bidFields['bids.$.outcome'] = bid.outcome
        if (Object.keys(bidFields).length) {
          await User.updateOne(
            { _id: payload.userId, 'bids.auctionId': bid.auctionId },
            { $set: bidFields },
          )
        }
      }
    }

    // Fix mongoose warning: use returnDocument instead of new
    const user = Object.keys(mongoUpdate).length
      ? await User.findByIdAndUpdate(payload.userId, mongoUpdate, {
          returnDocument: 'after',
        }).select('-password -walletAddressHash')
      : await User.findById(payload.userId).select(
          '-password -walletAddressHash',
        )

    return NextResponse.json({ user })
  } catch (err: any) {
    console.error('SAVE ERROR:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 },
    )
  }
}
