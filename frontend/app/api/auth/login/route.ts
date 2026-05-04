import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models/User'
import { signToken } from '@/lib/auth'
import { decryptWalletAddress } from '@/lib/wallet-crypto'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password)
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 },
      )

    await connectDB()

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )

    const match = await bcrypt.compare(password, user.password)
    if (!match)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )

    user.lastLoginAt = new Date()
    await user.save()

    const token = signToken({ userId: user._id.toString(), email: user.email })

    // Decrypt wallet for frontend auto-reconnect
    let walletAddress = ''
    if (user.walletAddressEncrypted) {
      try {
        walletAddress = decryptWalletAddress(user.walletAddressEncrypted)
      } catch {}
    }

    const res = NextResponse.json({
      message: 'Logged in',
      user: {
        email: user.email,
        walletAddress,
        walletConnectedAt: user.walletConnectedAt,
        lastActiveTab: user.lastActiveTab,
        preferredNetwork: user.preferredNetwork,
        offers: user.offers,
        loans: user.loans,
        escrows: user.escrows,
        bids: user.bids,
        auctionsWon: user.auctionsWon,
        notificationPrefs: user.notificationPrefs,
        repaymentBufferAcknowledged: user.repaymentBufferAcknowledged,
      },
    })
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (err: any) {
    console.error('LOGIN ERROR:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
