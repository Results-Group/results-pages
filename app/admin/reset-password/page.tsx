'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Lock, CheckCircle2 } from 'lucide-react'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('הסיסמה חייבת להכיל לפחות 8 תווים'); return }
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/admin/login'), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'שגיאה באיפוס הסיסמה')
    }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--admin-danger)' }}>קישור לא תקין</p>
        <Link href="/admin/forgot-password" className="text-sm font-medium" style={{ color: 'var(--admin-accent)' }}>
          בקשת קישור חדש
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-accent)' }} />
        <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--admin-text-primary)' }}>הסיסמה עודכנה</h1>
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>מעבירים אותך להתחברות...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-lg font-semibold text-center mb-1" style={{ color: 'var(--admin-text-primary)' }}>סיסמה חדשה</h1>
      <p className="text-center text-xs mb-6" style={{ color: 'var(--admin-text-muted)' }}>הזינו סיסמה חדשה לחשבון</p>

      <div className="relative mb-4">
        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="סיסמה חדשה" autoFocus
          className="w-full pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border-input)', color: 'var(--admin-text-primary)' }}
        />
      </div>
      <div className="relative mb-5">
        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input
          type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="אימות סיסמה"
          className="w-full pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border-input)', color: 'var(--admin-text-primary)' }}
        />
      </div>

      {error && <p className="text-sm mb-4 text-center" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

      <button
        type="submit" disabled={loading || !password || !confirm}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
        style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
      >
        {loading ? '...' : 'עדכון סיסמה'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--login-bg)' }}>
      <div className="w-full max-w-sm px-4">
        <div className="rounded-xl p-7" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}>
          <div className="flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Results" className="h-9 w-auto" />
          </div>
          <Suspense fallback={<p className="text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
