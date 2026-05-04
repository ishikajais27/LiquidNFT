'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const LiquidEther = dynamic(() => import('../../components/LiquidEther'), {
  ssr: false,
})

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    if (!email || !password) return setError('Please fill in all fields.')
    setLoading(true)

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) return setError(data.error || 'Something went wrong')

    const savedWallet = data.user?.walletAddress
    if (savedWallet && (window as any).ethereum) {
      try {
        const { ethers } = await import('ethers')
        const eth = (window as any).ethereum
        const accounts: string[] = await eth.request({ method: 'eth_accounts' })
        if (
          accounts.length > 0 &&
          accounts[0].toLowerCase() === savedWallet.toLowerCase()
        ) {
          const p = new ethers.BrowserProvider(eth)
          await p.getSigner()
        }
      } catch {}
    }

    router.push('/')
    router.refresh()
  }

  return (
    <>
      <div className="liquid-bg-wrapper">
        <LiquidEther
          colors={['#5227FF', '#FF9FFC', '#B497CF']}
          mouseForce={28}
          cursorSize={140}
          autoDemo={true}
          autoSpeed={0.6}
          autoIntensity={3.0}
          resolution={0.5}
          iterationsPoisson={16}
          iterationsViscous={16}
          dt={0.012}
        />
      </div>

      <div
        className="liquid-page-content"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background:
                'linear-gradient(135deg, var(--accent), var(--accent2))',
            }}
          />
          <span
            style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}
          >
            LiquidNFT
          </span>
        </div>

        {/* Glassmorphism Card */}
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'rgba(17, 17, 24, 0.4)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            boxShadow:
              '0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 0 1px rgba(167, 139, 250, 0.1) inset, 0 0 20px rgba(167, 139, 250, 0.2)',
            borderRadius: 30,
            padding: 32,
            transition: 'all 0.3s ease',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              background: 'rgba(10, 10, 15, 0.4)',
              border: '1px solid rgba(30, 30, 46, 0.6)',
              borderRadius: 60,
              padding: 6,
              marginBottom: 32,
            }}
          >
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 60,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#0a0a0f' : 'var(--text)',
                  transition: 'all 0.2s ease',
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                style={{
                  ...inputStyle,
                  background: 'rgba(10, 10, 15, 0.6)',
                  border: '1px solid rgba(30, 30, 46, 0.8)',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(167, 139, 250, 0.8)'
                  e.target.style.boxShadow =
                    '0 0 0 2px rgba(167, 139, 250, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(30, 30, 46, 0.8)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={
                  mode === 'signup' ? 'Min. 6 characters' : '••••••••'
                }
                style={{
                  ...inputStyle,
                  background: 'rgba(10, 10, 15, 0.6)',
                  border: '1px solid rgba(30, 30, 46, 0.8)',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(167, 139, 250, 0.8)'
                  e.target.style.boxShadow =
                    '0 0 0 2px rgba(167, 139, 250, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(30, 30, 46, 0.8)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  color: 'var(--red)',
                  fontSize: 13,
                  background: '#f8717111',
                  border: '1px solid #f8717133',
                  borderRadius: 6,
                  padding: '8px 12px',
                }}
              >
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                marginTop: 8,
                background:
                  'linear-gradient(105deg, var(--accent) 0%, var(--accent2) 100%)',
                color: '#0a0a0f',
                border: 'none',
                borderRadius: 40,
                padding: '14px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 800,
                fontSize: 15,
                fontFamily: "'Syne', sans-serif",
                opacity: loading ? 0.7 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 4px 15px rgba(167, 139, 250, 0.3)',
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow =
                    '0 6px 20px rgba(167, 139, 250, 0.4)'
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow =
                    '0 4px 15px rgba(167, 139, 250, 0.3)'
                }
              }}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Log In'
                  : 'Create Account'}
            </button>
          </div>

          <p
            style={{
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              marginTop: 28,
            }}
          >
            {mode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <span
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
              }}
              style={{
                background:
                  'linear-gradient(105deg, var(--accent), var(--accent2))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                cursor: 'pointer',
                fontWeight: 700,
                transition: 'opacity 0.2s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </span>
          </p>
        </div>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--muted)',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  padding: '11px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
