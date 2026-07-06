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
      router.push('/pizza-house')
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
      style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #16213e 100%)', fontFamily: 'Heebo, sans-serif' }}
    >
      <div className="w-full max-w-sm px-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-10"
          style={{ background: 'rgba(26,26,46,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              <Pizza className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-xl font-black text-center mb-1 text-slate-100">Pizza House</h1>
          <p className="text-center text-sm mb-8 text-slate-400">דאשבורד מכירות ושיווק</p>

          <div className="relative mb-5">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="סיסמה"
              autoFocus
              className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none text-slate-100"
              style={{ background: 'rgba(15,15,35,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {error && <p className="text-sm mb-4 text-center text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            {loading ? '...' : 'כניסה לדאשבורד'}
          </button>
        </form>
      </div>
    </div>
  )
}
