import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models/User'
import { hashWalletAddress, encryptWalletAddress } from '@/lib/wallet-crypto'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value
    if (!token)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { walletAddress } = await req.json()
    if (!walletAddress)
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 },
      )

    const walletAddressHash = await hashWalletAddress(walletAddress)
    const walletAddressEncrypted = encryptWalletAddress(walletAddress)

    await connectDB()

    // Fix mongoose warning: use returnDocument instead of new: true
    const user = await User.findByIdAndUpdate(
      payload.userId,
      {
        walletAddressHash,
        walletAddressEncrypted,
        walletConnectedAt: new Date(),
      },
      { returnDocument: 'after' },
    ).select('-password -walletAddressHash')

    if (!user)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ user })
  } catch (err: any) {
    console.error('WALLET ERROR:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 },
    )
  }
}
