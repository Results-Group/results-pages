'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

  if (!page) return <p className="text-gray-500">טוען...</p>

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-2">עריכת דף</h2>
      <p className="text-sm text-gray-500 mb-6">{page._count.views} צפיות • נוצר {new Date(page.createdAt).toLocaleDateString('he-IL')}</p>

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
        <p className="text-xs text-gray-400 mb-1">URL</p>
        <code className="text-sm" dir="ltr">/pages/{client}/{slug}</code>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">כותרת</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">לקוח</label>
          <input
            type="text"
            value={client}
            onChange={e => setClient(e.target.value)}
            dir="ltr"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            dir="ltr"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">תאריך תוקף</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            dir="ltr"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
          </label>
          <span className="text-sm">{active ? 'פעיל' : 'מושבת'}</span>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-3 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
          >
            מחיקה
          </button>
        </div>
      </form>
    </div>
  )
}
