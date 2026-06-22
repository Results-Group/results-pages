'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

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

  function getStatus(page: PageItem): { label: string; color: string; bg: string } {
    if (!page.active) return { label: 'מושבת', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' }
    if (page.expiresAt && new Date(page.expiresAt) < new Date()) return { label: 'פג תוקף', color: '#f87171', bg: 'rgba(248,113,113,0.1)' }
    return { label: 'פעיל', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text-primary)' }}>דפים</h2>
        <Link
          href="/admin/upload"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          style={{ background: '#F3D56D', color: '#050505' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px rgba(243,213,109,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
        >
          <Plus className="w-4 h-4" />
          העלאת דף
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
          <input
            type="text"
            placeholder="חיפוש..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: 'var(--admin-bg-elevated)',
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-text-primary)',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-border-input)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--admin-bg-elevated)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-text-primary)',
          }}
        >
          <option value="">כל הלקוחות</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <p className="text-lg font-bold mb-1">אין דפים</p>
          <p className="text-sm">לחץ &quot;העלאת דף&quot; להתחיל</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--admin-bg-elevated)', borderBottom: '1px solid var(--admin-border)' }}>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>לקוח</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>כותרת</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>URL</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>סטטוס</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>צפיות</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(page => {
                const status = getStatus(page)
                return (
                  <tr
                    key={page.id}
                    className="transition-colors duration-150"
                    style={{ borderBottom: '1px solid var(--admin-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-5 py-4 font-bold" style={{ color: 'var(--admin-text-primary)' }}>{page.client}</td>
                    <td className="px-5 py-4" style={{ color: 'var(--admin-text-secondary)' }}>{page.title}</td>
                    <td className="px-5 py-4">
                      <code
                        className="text-xs px-2.5 py-1 rounded-lg"
                        dir="ltr"
                        style={{ background: 'var(--admin-bg-elevated)', color: '#22D3EE' }}
                      >
                        /{page.client}/{page.slug}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-xs px-3 py-1 rounded-full font-bold"
                        style={{ color: status.color, background: status.bg }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4" style={{ color: 'var(--admin-text-muted)' }}>
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {page._count.views}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/pages/${page.id}`}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#22D3EE' }}
                          title="עריכה"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleToggle(page.id, page.active)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#F3D56D' }}
                          title={page.active ? 'השבת' : 'הפעל'}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {page.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(page.id, page.title)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                          style={{ color: '#f87171' }}
                          title="מחיקה"
                        >
                          <Trash2 className="w-4 h-4" />
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
