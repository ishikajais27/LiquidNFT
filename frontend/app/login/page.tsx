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
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
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

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 4,
              marginBottom: 28,
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
                  padding: '9px 0',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#0a0a0f' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                style={inputStyle}
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
                style={inputStyle}
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
                marginTop: 4,
                background:
                  'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#0a0a0f',
                border: 'none',
                borderRadius: 8,
                padding: '12px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 800,
                fontSize: 15,
                fontFamily: "'Syne', sans-serif",
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
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
              marginTop: 24,
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
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
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
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '11px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
