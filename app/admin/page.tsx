'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, ExternalLink, Pencil, ToggleLeft, ToggleRight, Trash2, Monitor, Smartphone, X } from 'lucide-react'

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
  const [previewPage, setPreviewPage] = useState<PageItem | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

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
                      <a
                        href={`/pages/${page.client}/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 rounded-lg hover:underline"
                        dir="ltr"
                        style={{ background: 'var(--admin-bg-elevated)', color: '#22D3EE' }}
                      >
                        /{page.client}/{page.slug}
                      </a>
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
                        <a
                          href={`/pages/${page.client}/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#34d399' }}
                          title="צפייה בדף"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => { setPreviewPage(page); setPreviewMode('desktop') }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#a78bfa' }}
                          title="תצוגה מקדימה"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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

      {/* Preview Modal */}
      {previewPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPreviewPage(null)}
        >
          <div
            className="relative w-[95vw] h-[92vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-bg-elevated)' }}
            >
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-bold" style={{ color: 'var(--admin-text-primary)' }}>
                  תצוגה מקדימה: {previewPage.title}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-lg" dir="ltr" style={{ background: 'var(--admin-bg)', color: '#22D3EE' }}>
                  /{previewPage.client}/{previewPage.slug}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Device Toggle */}
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all duration-200"
                    style={{
                      background: previewMode === 'desktop' ? '#22D3EE' : 'transparent',
                      color: previewMode === 'desktop' ? '#050505' : 'var(--admin-text-muted)',
                    }}
                  >
                    <Monitor className="w-4 h-4" />
                    דסקטופ
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all duration-200"
                    style={{
                      background: previewMode === 'mobile' ? '#22D3EE' : 'transparent',
                      color: previewMode === 'mobile' ? '#050505' : 'var(--admin-text-muted)',
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    מובייל
                  </button>
                </div>
                {/* Close Button */}
                <button
                  onClick={() => setPreviewPage(null)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--admin-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-hover-bg)'; e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                  title="סגירה"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 flex items-center justify-center overflow-hidden p-4" style={{ background: '#1a1a2e' }}>
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  width: previewMode === 'desktop' ? '100%' : '375px',
                  maxWidth: previewMode === 'desktop' ? '1280px' : '375px',
                  ...(previewMode === 'mobile' ? {
                    borderRadius: '2rem',
                    border: '8px solid #2a2a3e',
                    boxShadow: '0 0 40px rgba(34,211,238,0.08), inset 0 0 0 2px #3a3a4e',
                  } : {
                    borderRadius: '0.75rem',
                    border: '1px solid var(--admin-border)',
                  }),
                }}
              >
                <iframe
                  src={`/pages/${previewPage.client}/${previewPage.slug}`}
                  className="w-full h-full"
                  style={{
                    borderRadius: previewMode === 'mobile' ? '1.5rem' : '0.75rem',
                    background: '#fff',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
