'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '48px 40px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', width: '100%', maxWidth: '380px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Results Pages</h1>
        <p style={{ color: '#666', textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>ניהול דפים</p>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="סיסמה"
          autoFocus
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', marginBottom: '16px', boxSizing: 'border-box', direction: 'ltr' }}
        />

        {error && <p style={{ color: '#e53e3e', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#111', color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '...' : 'כניסה'}
        </button>
      </form>
    </div>
  )
}
