'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--login-bg)' }}>
      <div className="w-full max-w-sm px-4">
        <div className="rounded-xl p-7" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }}>
          <div className="flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Results" className="h-9 w-auto" />
          </div>

          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-accent)' }} />
              <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--admin-text-primary)' }}>הבקשה נשלחה</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--admin-text-muted)' }}>
                אם קיים חשבון עם האימייל הזה, ישלח אליו קישור לאיפוס הסיסמה.
              </p>
              <Link href="/admin/login" className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--admin-accent)' }}>
                <ArrowRight className="w-4 h-4" /> חזרה להתחברות
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="text-lg font-semibold text-center mb-1" style={{ color: 'var(--admin-text-primary)' }}>שכחת סיסמה?</h1>
              <p className="text-center text-xs mb-6" style={{ color: 'var(--admin-text-muted)' }}>
                נשלח קישור לאיפוס לכתובת המייל שלך
              </p>

              <div className="relative mb-5">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="אימייל"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
                  style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border-input)', color: 'var(--admin-text-primary)' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border-input)'}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
              >
                {loading ? '...' : 'שליחת קישור'}
              </button>

              <div className="text-center mt-4">
                <Link href="/admin/login" className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                  חזרה להתחברות
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
