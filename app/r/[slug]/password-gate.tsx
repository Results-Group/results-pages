'use client'

import { useState, FormEvent } from 'react'

export default function PasswordGate({ slug, clientName }: { slug: string; clientName: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/report-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        setError('סיסמה שגויה')
      }
    } catch {
      setError('שגיאה — נסו שוב')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#090c0e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Ping','Heebo',sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '48px 40px', maxWidth: 400, width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', marginBottom: 8 }}>Results Digital</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32, fontSize: '0.9rem' }}>דוח ביצועים עבור {clientName}</p>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="הזינו סיסמה"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', outline: 'none', textAlign: 'center', marginBottom: 16, fontFamily: 'inherit' }}
          autoFocus
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading || !password}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#40e1d3', color: '#000', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
          {loading ? '...' : 'כניסה'}
        </button>
      </form>
    </div>
  )
}
