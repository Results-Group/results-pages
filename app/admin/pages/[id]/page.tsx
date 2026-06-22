'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, Trash2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface PageData {
  id: string
  client: string
  slug: string
  title: string
  active: boolean
  expiresAt: string | null
  filePath: string
  createdAt: string
  _count: { views: number }
}

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [page, setPage] = useState<PageData | null>(null)
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [slug, setSlug] = useState('')
  const [active, setActive] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/pages/${id}`)
      .then(r => r.json())
      .then(data => {
        setPage(data)
        setTitle(data.title)
        setClient(data.client)
        setSlug(data.slug)
        setActive(data.active)
        setExpiresAt(data.expiresAt ? data.expiresAt.split('T')[0] : '')
      })
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch(`/api/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, client, slug, active, expiresAt: expiresAt || null }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'שגיאה בשמירה')
    } else {
      router.push('/admin')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`למחוק את "${page?.title}"? פעולה זו בלתי הפיכה.`)) return
    await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  if (!page) return <p style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>

  return (
    <div className="max-w-lg">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-bold mb-6 transition-colors"
        style={{ color: 'var(--admin-text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--admin-text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--admin-text-muted)'}
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לדפים
      </Link>

      <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--admin-text-primary)' }}>עריכת דף</h2>
      <div className="flex items-center gap-3 mb-8">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          <Eye className="w-3.5 h-3.5" />
          {page._count.views} צפיות
        </span>
        <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          נוצר {new Date(page.createdAt).toLocaleDateString('he-IL')}
        </span>
      </div>

      <div
        className="mb-8 p-5 rounded-2xl"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
      >
        <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>URL</p>
        <code className="text-sm" dir="ltr" style={{ color: 'var(--admin-link)' }}>/pages/{client}/{slug}</code>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>לקוח</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>תאריך תוקף</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActive(!active)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: active ? 'var(--admin-success)' : 'var(--admin-border-input)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
              style={{ transform: active ? 'translateX(-2px)' : 'translateX(-22px)' }}
            />
          </button>
          <span className="text-sm font-bold" style={{ color: 'var(--admin-text-secondary)' }}>
            {active ? 'פעיל' : 'מושבת'}
          </span>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{ color: 'var(--admin-danger)', border: '1px solid var(--admin-danger-border)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Trash2 className="w-4 h-4" />
            מחיקה
          </button>
        </div>
      </form>
    </div>
  )
}
