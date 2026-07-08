'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Pizza } from 'lucide-react'

export default function PizzaHouseLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/pizza-house/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      window.location.href = '/pizza-house'
      return
    } else {
      const data = await res.json()
      setError(data.error || 'שגיאה בהתחברות')
      setLoading(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="flex items-center justify-center min-h-screen"
      style={{ background: '#050505' }}
    >
      <div className="w-full max-w-sm px-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-10"
          style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(243,213,109,0.12)' }}
            >
              <Pizza className="w-8 h-8" style={{ color: '#F3D56D' }} />
            </div>
          </div>

          <h1 className="text-xl font-black text-center mb-1 text-white">Pizza House</h1>
          <p className="text-center text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>דאשבורד מכירות ושיווק</p>

          <div className="relative mb-5">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="סיסמה"
              autoFocus
              className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)' }}
            />
          </div>

          {error && <p className="text-sm mb-4 text-center" style={{ color: '#f87171' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
            style={{ background: '#F3D56D', color: '#050505' }}
          >
            {loading ? '...' : 'כניסה לדאשבורד'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-6 px-2">
          <a
            href="https://www.resultsdigital.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-opacity hover:opacity-100"
            style={{ color: 'rgba(255,255,255,0.4)', opacity: 0.6, textDecoration: 'none' }}
          >
            www.resultsdigital.org
          </a>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', opacity: 0.6, margin: 0 }}>By Results Group</p>
        </div>
      </div>
    </div>
  )
}
