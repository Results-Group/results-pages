'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
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
      body: JSON.stringify({ email: email || undefined, password }),
    })

    if (res.ok) {
      window.location.href = '/admin'
      return
    } else {
      const data = await res.json()
      setError(data.error || 'שגיאה בהתחברות')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--login-bg)' }}>
      <div className="w-full max-w-sm px-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-7"
          style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}
        >
          <div className="flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Results" className="h-9 w-auto" />
          </div>

          <h1 className="text-lg font-semibold text-center mb-1" style={{ color: 'var(--admin-text-primary)' }}>
            Results Pages
          </h1>
          <p className="text-center text-xs mb-6" style={{ color: 'var(--admin-text-muted)' }}>
            ניהול דפים
          </p>

          <div className="relative mb-4">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="אימייל"
              dir="ltr"
              className="w-full pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: 'var(--admin-bg-elevated)',
                border: '1px solid var(--admin-border-input)',
                color: 'var(--admin-text-primary)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border-input)'}
            />
          </div>

          <div className="relative mb-5">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="סיסמה"
              autoFocus
              className="w-full pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: 'var(--admin-bg-elevated)',
                border: '1px solid var(--admin-border-input)',
                color: 'var(--admin-text-primary)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border-input)'}
            />
          </div>

          {error && (
            <p className="text-sm mb-4 text-center" style={{ color: 'var(--admin-danger)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--admin-accent)',
              color: 'var(--admin-accent-text)',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {loading ? '...' : 'כניסה'}
          </button>

          <div className="text-center mt-4">
            <Link href="/admin/forgot-password" className="text-xs transition-colors" style={{ color: 'var(--admin-text-muted)' }}>
              שכחת סיסמה?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
