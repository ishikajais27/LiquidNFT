import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models/User'
import { decryptWalletAddress } from '@/lib/wallet-crypto'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value
    if (!token)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    await connectDB()
    const user = await User.findById(payload.userId)
      .select('-password -walletAddressHash')
      .lean()
    if (!user)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Decrypt wallet address for frontend use
    let walletAddress = ''
    if (user.walletAddressEncrypted) {
      try {
        walletAddress = decryptWalletAddress(user.walletAddressEncrypted)
      } catch {}
    }

    return NextResponse.json({ user: { ...user, walletAddress } })
  } catch (err: any) {
    console.error('ME ERROR:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
