'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setError('סיסמה שגויה')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--login-bg)' }}>
      <div className="w-full max-w-sm px-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-10"
          style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}
        >
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Results" className="h-12 w-auto" />
          </div>

          <h1 className="text-xl font-black text-center mb-1" style={{ color: 'var(--admin-text-primary)' }}>
            Results Pages
          </h1>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--admin-text-muted)' }}>
            ניהול דפים
          </p>

          <div className="relative mb-5">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="סיסמה"
              autoFocus
              className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{
                background: 'var(--admin-bg-elevated)',
                border: '1px solid var(--admin-border-input)',
                color: 'var(--admin-text-primary)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#F3D56D'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border-input)'}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
            style={{
              background: '#F3D56D',
              color: '#050505',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px rgba(243,213,109,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            {loading ? '...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  )
}
