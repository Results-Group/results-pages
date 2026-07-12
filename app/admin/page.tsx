'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, ExternalLink, Pencil, ToggleLeft, ToggleRight, Trash2, Monitor, Smartphone, X, Copy, MessageCircle, Lock, Building, CheckSquare, Square } from 'lucide-react'
import { whatsappShareUrl } from '@/lib/share'
import { useT, useLocale } from '@/lib/i18n'
import { useToast } from './_components/toast'

interface PageItem {
  id: string
  client: string
  slug: string
  title: string
  active: boolean
  expires_at: string | null
  has_password: boolean
  short_url: string | null
  created_at: string
  workspace_id: string | null
  _count: { views: number }
}

type UserRole = 'admin' | 'editor' | 'viewer'

async function fetchUserRole(): Promise<UserRole> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return 'viewer'
    const { user } = await res.json()
    return (user?.role as UserRole) || 'viewer'
  } catch {
    return 'viewer'
  }
}

interface Workspace {
  id: string
  name: string
  color: string
}

export default function AdminDashboard() {
  const t = useT()
  const locale = useLocale()
  const { showToast } = useToast()
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [previewPage, setPreviewPage] = useState<PageItem | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [userRole, setUserRole] = useState<UserRole>('viewer')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [moveTarget, setMoveTarget] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    fetchUserRole().then(r => setUserRole(r))
    fetch('/api/workspaces').then(r => r.ok ? r.json() : []).then(setWorkspaces).catch(() => {})
  }, [])

  useEffect(() => {
    fetchPages()
  }, [filter])

  async function fetchPages() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('client', filter)
      const res = await fetch(`/api/pages?${params}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPages(Array.isArray(data) ? data : [])
    } catch {
      setPages([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(locale === 'en' ? `Delete "${title}"?` : `למחוק את "${title}"?`)) return
    const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      showToast(locale === 'en' ? 'Delete failed' : 'שגיאה במחיקה')
      return
    }
    fetchPages()
  }

  async function handleDuplicate(id: string, title: string) {
    if (!confirm(locale === 'en' ? `Duplicate "${title}"?` : `לשכפל את "${title}"?`)) return
    const res = await fetch(`/api/pages/${id}/duplicate`, { method: 'POST' })
    if (res.ok) {
      fetchPages()
    } else {
      const err = await res.json()
      showToast(`${locale === 'en' ? 'Duplication error:' : 'שגיאה בשכפול:'} ${err.error || 'Unknown error'}`)
    }
  }

  function handleWhatsApp(page: PageItem) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = page.short_url
      ? `${base}/r/${page.short_url}`
      : `${base}/pages/${page.client}/${page.slug}`
    window.open(whatsappShareUrl({ title: page.title, client: page.client, url }), '_blank')
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const res = await fetch(`/api/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !currentActive }),
    })
    if (!res.ok) {
      showToast(locale === 'en' ? 'Update failed' : 'שגיאה בעדכון')
      return
    }
    fetchPages()
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filtered.length) return new Set()
      return new Set(filtered.map(p => p.id))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, search])

  async function handleBulkMove() {
    if (!moveTarget || selectedIds.size === 0) return
    setMoving(true)
    const results = await Promise.all([...selectedIds].map(id =>
      fetch(`/api/pages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: moveTarget }),
      }).then(r => r.ok).catch(() => false)
    ))
    const failed = results.filter(ok => !ok).length
    if (failed > 0) {
      showToast(locale === 'en' ? `${failed} item(s) failed to move` : `${failed} פריטים נכשלו בהעברה`)
    }
    setSelectedIds(new Set())
    setMoveTarget('')
    setMoving(false)
    fetchPages()
  }

  const clients = [...new Set(pages.map(p => p.client))].sort()
  const filtered = pages.filter(p =>
    !search || p.title.includes(search) || p.slug.includes(search) || p.client.includes(search)
  )

  function getStatus(page: PageItem): { label: string; colorVar: string; bgVar: string } {
    if (!page.active) return { label: t('pages.statusDisabled'), colorVar: 'var(--admin-disabled-text)', bgVar: 'var(--admin-disabled-bg)' }
    if (page.expires_at && new Date(page.expires_at) < new Date()) return { label: t('pages.statusExpired'), colorVar: 'var(--admin-danger)', bgVar: 'var(--admin-danger-bg)' }
    return { label: t('pages.statusActive'), colorVar: 'var(--admin-success)', bgVar: 'var(--admin-success-bg)' }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('pages.title')}</h2>
        {userRole !== 'viewer' && (
          <Link
            href="/admin/upload"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <Plus className="w-4 h-4" />
            {t('pages.uploadPage')}
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
          <input
            type="text"
            placeholder={t('pages.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full ps-10 pe-3.5 py-2 rounded-lg text-sm outline-none transition-colors"
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
          className="px-3.5 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--admin-bg-elevated)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-text-primary)',
          }}
        >
          <option value="">{t('pages.allClients')}</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && workspaces.length > 1 && (
        <div
          className="mb-4 flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          <Building className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
            {selectedIds.size} {t('pages.selectedPages')}
          </span>
          <select
            value={moveTarget}
            onChange={e => setMoveTarget(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-text-primary)',
            }}
          >
            <option value="">{t('pages.moveToWorkspace')}</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <button
            onClick={handleBulkMove}
            disabled={!moveTarget || moving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            {moving ? t('pages.moving') : t('pages.move')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 rounded-lg mr-auto"
            style={{ color: 'var(--admin-text-muted)' }}
            title={t('pages.cancelSelection')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <p className="text-lg font-medium mb-1">{t('pages.noPages')}</p>
          <p className="text-sm">{t('pages.noPagesHint')}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--admin-border)' }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ background: 'var(--admin-bg-elevated)', borderBottom: '1px solid var(--admin-border)' }}>
                {workspaces.length > 1 && (
                  <th className="px-3 py-2.5 w-10">
                    <button type="button" onClick={toggleAll} style={{ color: 'var(--admin-text-muted)' }} aria-label={t('pages.selectAll')}>
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thClient')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thTitle')}</th>
                {workspaces.length > 0 && (
                  <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thWorkspace')}</th>
                )}
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>URL</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thStatus')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thViews')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thActions')}</th>
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
                    {workspaces.length > 1 && (
                      <td className="px-3 py-4 w-10">
                        <button type="button" onClick={() => toggleSelect(page.id)} style={{ color: 'var(--admin-text-muted)' }} aria-label={t('pages.selectRow')}>
                          {selectedIds.has(page.id)
                            ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text-primary)' }}>{page.client}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-secondary)' }}>
                      <span className="flex items-center gap-1.5">
                        {page.title}
                        {page.has_password && <span title={t('pages.passwordProtected')}><Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} /></span>}
                      </span>
                    </td>
                    {workspaces.length > 0 && (
                      <td className="px-4 py-3">
                        {(() => {
                          const ws = workspaces.find(w => w.id === page.workspace_id)
                          return ws ? (
                            <span className="text-xs px-2.5 py-1 rounded-md font-medium" style={{ background: `${ws.color}20`, color: ws.color }}>
                              {ws.name}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>—</span>
                          )
                        })()}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`/pages/${page.client}/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-lg hover:underline"
                          dir="ltr"
                          style={{ background: 'var(--admin-bg-elevated)', color: 'var(--admin-link)' }}
                        >
                          /{page.client}/{page.slug}
                        </a>
                        {page.short_url && (
                          <a
                            href={`/r/${page.short_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] px-2 py-0.5 rounded-md hover:underline font-medium"
                            dir="ltr"
                            style={{ background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa' }}
                          >
                            /r/{page.short_url}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-md font-medium"
                        style={{ color: status.colorVar, background: status.bgVar }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {page._count.views}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <a
                          href={`/pages/${page.client}/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--admin-view)' }}
                          title={t('pages.viewPage')}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => { setPreviewPage(page); setPreviewMode('desktop') }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--admin-info)' }}
                          title={t('pages.preview')}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {userRole !== 'viewer' && (
                          <Link
                            href={`/admin/pages/${page.id}`}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-link)' }}
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        )}
                        {userRole !== 'viewer' && (
                          <button
                            onClick={() => handleToggle(page.id, page.active)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-accent)' }}
                            title={page.active ? t('pages.disable') : t('pages.enable')}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {page.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        )}
                        {userRole !== 'viewer' && (
                          <button
                            onClick={() => handleDuplicate(page.id, page.title)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-link)' }}
                            title={t('pages.duplicate')}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleWhatsApp(page)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#25D366' }}
                          title={t('pages.sendWhatsapp')}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDelete(page.id, page.title)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-danger)' }}
                            title={t('common.delete')}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
            className="relative w-[95vw] h-[92vh] rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-bg-elevated)' }}
            >
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                  {t('pages.previewTitle')}: {previewPage.title}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-lg" dir="ltr" style={{ background: 'var(--admin-bg)', color: 'var(--admin-link)' }}>
                  /{previewPage.client}/{previewPage.slug}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Device Toggle */}
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-200"
                    style={{
                      background: previewMode === 'desktop' ? 'var(--admin-link)' : 'transparent',
                      color: previewMode === 'desktop' ? 'var(--admin-accent-text)' : 'var(--admin-text-muted)',
                    }}
                  >
                    <Monitor className="w-4 h-4" />
                    {t('pages.desktop')}
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-200"
                    style={{
                      background: previewMode === 'mobile' ? 'var(--admin-link)' : 'transparent',
                      color: previewMode === 'mobile' ? 'var(--admin-accent-text)' : 'var(--admin-text-muted)',
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    {t('pages.mobile')}
                  </button>
                </div>
                {/* Close Button */}
                <button
                  onClick={() => setPreviewPage(null)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--admin-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-hover-bg)'; e.currentTarget.style.color = 'var(--admin-danger)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                  title={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 flex items-center justify-center overflow-hidden p-4" style={{ background: 'var(--admin-preview-bg)' }}>
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  width: previewMode === 'desktop' ? '100%' : '375px',
                  maxWidth: previewMode === 'desktop' ? '1280px' : '375px',
                  ...(previewMode === 'mobile' ? {
                    borderRadius: '2rem',
                    border: '8px solid var(--admin-preview-frame)',
                    boxShadow: '0 0 40px rgba(34,211,238,0.08), inset 0 0 0 2px var(--admin-preview-frame-inner)',
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
