'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PageItem {
  id: string
  client: string
  slug: string
  title: string
  active: boolean
  expiresAt: string | null
  createdAt: string
  _count: { views: number }
}

export default function AdminDashboard() {
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchPages()
  }, [filter])

  async function fetchPages() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('client', filter)
    const res = await fetch(`/api/pages?${params}`)
    const data = await res.json()
    setPages(data)
    setLoading(false)
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`למחוק את "${title}"?`)) return
    await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    fetchPages()
  }

  async function handleToggle(id: string, currentActive: boolean) {
    await fetch(`/api/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !currentActive }),
    })
    fetchPages()
  }

  const clients = [...new Set(pages.map(p => p.client))].sort()
  const filtered = pages.filter(p =>
    !search || p.title.includes(search) || p.slug.includes(search) || p.client.includes(search)
  )

  function getStatus(page: PageItem): { label: string; color: string } {
    if (!page.active) return { label: 'מושבת', color: 'bg-gray-200 text-gray-700' }
    if (page.expiresAt && new Date(page.expiresAt) < new Date()) return { label: 'פג תוקף', color: 'bg-red-100 text-red-700' }
    return { label: 'פעיל', color: 'bg-green-100 text-green-700' }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">דפים</h2>
        <Link href="/admin/upload" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          + העלאת דף
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="חיפוש..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 max-w-xs"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">כל הלקוחות</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">טוען...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">אין דפים</p>
          <p className="text-sm mt-1">לחץ &quot;העלאת דף&quot; להתחיל</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-gray-600">לקוח</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">כותרת</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">URL</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">סטטוס</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">צפיות</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(page => {
                const status = getStatus(page)
                return (
                  <tr key={page.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{page.client}</td>
                    <td className="px-4 py-3">{page.title}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded" dir="ltr">
                        /{page.client}/{page.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{page._count.views}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/pages/${page.id}`} className="text-blue-600 hover:underline text-xs">
                          עריכה
                        </Link>
                        <button onClick={() => handleToggle(page.id, page.active)} className="text-yellow-600 hover:underline text-xs">
                          {page.active ? 'השבת' : 'הפעל'}
                        </button>
                        <button onClick={() => handleDelete(page.id, page.title)} className="text-red-600 hover:underline text-xs">
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
