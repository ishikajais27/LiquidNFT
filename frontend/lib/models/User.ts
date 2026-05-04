import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IOffer {
  offerId: string
  amount: string
  rateBps: number
  durationDays: number
  status: 'active' | 'matched' | 'cancelled'
  createdAt: Date
}

export interface IEscrow {
  escrowId: string
  nftContract: string
  tokenId: string
  depositedAt: Date
  status: 'locked' | 'unlocked' | 'liquidated'
}

export interface ILoan {
  loanId: string
  escrowId: string
  offerId: string
  principal: string
  rateBps: number
  durationDays: number
  startTime: Date
  expiryTime: Date
  lenderAddress: string
  status: 'Active' | 'Repaid' | 'Defaulted' | 'Liquidated'
  repaidAt: Date | null
  repaidAmount: string | null
  overpaymentRefund: string | null
}

export interface IBid {
  auctionId: string
  amount: string
  placedAt: Date
  outcome: 'pending' | 'won' | 'outbid' | 'refunded'
  refundAmount: string | null
  refundWithdrawnAt: Date | null
  refundWithdrawnAmount: string | null
}

export interface IAuctionWon {
  auctionId: string
  nftContract: string
  tokenId: string
  wonAt: Date
  paidAmount: string
}

export interface INotificationPrefs {
  loanExpiryAlert: boolean
  outbidAlert: boolean
  loanRepaidAlert: boolean
  expiryAlertHoursBefore: number
}

export interface INFTPortfolioItem {
  nftContract: string
  tokenId: string
  escrowId: string
  loanId: string | null
  status: 'in_escrow' | 'locked_in_loan' | 'returned' | 'liquidated'
  depositedAt: Date
  resolvedAt: Date | null
}

export interface IUser extends Document {
  email: string
  password: string
  walletAddressHash: string
  walletAddressEncrypted: string
  walletConnectedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  offers: IOffer[]
  totalEthLent: string
  offersCreated: number
  offersMatched: number
  offersCancelled: number
  escrows: IEscrow[]
  loans: ILoan[]
  bids: IBid[]
  auctionsWon: IAuctionWon[]
  nftPortfolio: INFTPortfolioItem[]
  notificationPrefs: INotificationPrefs
  lastActiveTab: string
  preferredNetwork: string
  repaymentBufferAcknowledged: boolean
}

const OfferSchema = new Schema<IOffer>({
  offerId: { type: String, required: true },
  amount: { type: String, required: true },
  rateBps: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  status: {
    type: String,
    enum: ['active', 'matched', 'cancelled'],
    default: 'active',
  },
  createdAt: { type: Date, default: Date.now },
})

const EscrowSchema = new Schema<IEscrow>({
  escrowId: { type: String, required: true },
  nftContract: { type: String, required: true },
  tokenId: { type: String, required: true },
  depositedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['locked', 'unlocked', 'liquidated'],
    default: 'locked',
  },
})

const LoanSchema = new Schema<ILoan>({
  loanId: { type: String, required: true },
  escrowId: { type: String, required: true },
  offerId: { type: String, required: true },
  principal: { type: String, required: true },
  rateBps: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  startTime: { type: Date, required: true },
  expiryTime: { type: Date, required: true },
  lenderAddress: { type: String, required: true },
  status: {
    type: String,
    enum: ['Active', 'Repaid', 'Defaulted', 'Liquidated'],
    default: 'Active',
  },
  repaidAt: { type: Date, default: null },
  repaidAmount: { type: String, default: null },
  overpaymentRefund: { type: String, default: null },
})

const BidSchema = new Schema<IBid>({
  auctionId: { type: String, required: true },
  amount: { type: String, required: true },
  placedAt: { type: Date, default: Date.now },
  outcome: {
    type: String,
    enum: ['pending', 'won', 'outbid', 'refunded'],
    default: 'pending',
  },
  refundAmount: { type: String, default: null },
  refundWithdrawnAt: { type: Date, default: null },
  refundWithdrawnAmount: { type: String, default: null },
})

const AuctionWonSchema = new Schema<IAuctionWon>({
  auctionId: { type: String, required: true },
  nftContract: { type: String, required: true },
  tokenId: { type: String, required: true },
  wonAt: { type: Date, default: Date.now },
  paidAmount: { type: String, required: true },
})

const NFTPortfolioSchema = new Schema<INFTPortfolioItem>({
  nftContract: { type: String, required: true },
  tokenId: { type: String, required: true },
  escrowId: { type: String, required: true },
  loanId: { type: String, default: null },
  status: {
    type: String,
    enum: ['in_escrow', 'locked_in_loan', 'returned', 'liquidated'],
    default: 'in_escrow',
  },
  depositedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
})

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    walletAddressHash: { type: String, default: '' },
    walletAddressEncrypted: { type: String, default: '' },
    walletConnectedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    offers: { type: [OfferSchema], default: [] },
    totalEthLent: { type: String, default: '0' },
    offersCreated: { type: Number, default: 0 },
    offersMatched: { type: Number, default: 0 },
    offersCancelled: { type: Number, default: 0 },
    escrows: { type: [EscrowSchema], default: [] },
    loans: { type: [LoanSchema], default: [] },
    bids: { type: [BidSchema], default: [] },
    auctionsWon: { type: [AuctionWonSchema], default: [] },
    nftPortfolio: { type: [NFTPortfolioSchema], default: [] },
    notificationPrefs: {
      type: {
        loanExpiryAlert: { type: Boolean, default: true },
        outbidAlert: { type: Boolean, default: true },
        loanRepaidAlert: { type: Boolean, default: true },
        expiryAlertHoursBefore: { type: Number, default: 24 },
      },
      default: () => ({
        loanExpiryAlert: true,
        outbidAlert: true,
        loanRepaidAlert: true,
        expiryAlertHoursBefore: 24,
      }),
    },
    lastActiveTab: { type: String, default: 'offers' },
    preferredNetwork: { type: String, default: 'sepolia' },
    repaymentBufferAcknowledged: { type: Boolean, default: false },
  },
  { timestamps: true },
)

UserSchema.index({ walletAddressHash: 1 })

export const User: Model<IUser> =
  mongoose.models['User'] ?? mongoose.model<IUser>('User', UserSchema)
