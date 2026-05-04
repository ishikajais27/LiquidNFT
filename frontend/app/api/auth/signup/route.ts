import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password)
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 },
      )

    if (password.length < 6)
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 },
      )

    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing)
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 },
      )

    const hashed = await bcrypt.hash(password, 12)
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashed,
    })

    const token = signToken({ userId: user._id.toString(), email: user.email })

    const res = NextResponse.json({
      message: 'Account created',
      user: { email: user.email, walletAddress: '' },
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
    console.error('SIGNUP ERROR:', err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 },
    )
  }
}
