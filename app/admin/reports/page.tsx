'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, Calendar, BarChart3 } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'

interface Report {
  id: string
  client: string
  report_name: string
  slug: string
  period_label: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
  workspace_id: string | null
}

async function fetchUserRole(): Promise<string> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return 'viewer'
    const { user } = await res.json()
    return user?.role || 'viewer'
  } catch { return 'viewer' }
}

const STATUS_DOT: Record<string, string> = { draft: '#f59e0b', published: '#40e1d3', archived: '#64748b' }

export default function ReportsListPage() {
  const t = useT()
  const locale = useLocale()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('admin')

  const STATUS_LABELS: Record<string, string> = { draft: t('common.draft'), published: t('common.published'), archived: t('common.archived') }

  useEffect(() => { fetchUserRole().then(r => setUserRole(r)) }, [])

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      fetch(`/api/reports?${params}`)
        .then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return null } return r.json() })
        .then(data => { if (Array.isArray(data)) setReports(data); setLoading(false) })
        .catch(() => setLoading(false))
    }, search ? 300 : 0)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  function getReportUrl(slug: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/r/${slug}`
  }

  function handleCopy(slug: string) {
    navigator.clipboard.writeText(getReportUrl(slug))
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(locale === 'en' ? `Delete report "${name}"?` : `למחוק את הדוח "${name}"?`)) return
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    setReports(prev => prev.filter(r => r.id !== id))
  }

  const groupedByClient = (() => {
    const groups = new Map<string, Report[]>()
    for (const r of reports) {
      const key = r.client?.trim() || (locale === 'en' ? 'No client' : 'ללא לקוח')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], locale === 'en' ? 'en' : 'he'))
  })()

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#40e1d3', boxShadow: '0 0 12px rgba(64,225,211,0.6)' }} />
          <div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-text-primary)' }}>{t('reports.title')}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{t('reports.subtitle')}</p>
          </div>
        </div>
        <Link
          href="/admin/reports/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
          style={{ background: 'rgba(64,225,211,0.12)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }}
        >
          <Plus className="w-4 h-4" />
          {t('reports.new')}
        </Link>
      </div>

      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: t('reports.totalReports'), value: reports.length },
            { label: t('common.published'), value: reports.filter(r => r.status === 'published').length },
            { label: t('nav.clients'), value: groupedByClient.length },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl p-4" style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>{kpi.label}</div>
              <div className="text-2xl font-black" style={{ color: '#40e1d3' }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="relative mb-8">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('reports.searchPlaceholder')}
          className="w-full ps-11 pe-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--admin-text-primary)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.4)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--admin-text-muted)' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(64,225,211,0.3)', borderTopColor: '#40e1d3' }} />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="relative text-center py-24 px-8 rounded-2xl" style={{ background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-lg font-bold mb-3" style={{ color: 'var(--admin-text-secondary)' }}>
            {search ? t('common.noResults') : t('reports.empty')}
          </p>
          {!search && (
            <Link href="/admin/reports/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold" style={{ background: 'rgba(64,225,211,0.12)', border: '1px solid rgba(64,225,211,0.3)', color: '#40e1d3' }}>
              <Plus className="w-4 h-4" /> {t('reports.createFirst')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByClient.map(([clientName, clientReports]) => (
            <div key={clientName}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#40e1d3', boxShadow: '0 0 8px rgba(64,225,211,0.5)' }} />
                <h3 className="text-sm font-bold tracking-wide" style={{ color: '#40e1d3' }}>{clientName}</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded font-semibold" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>{clientReports.length}</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(64,225,211,0.15), transparent)' }} />
              </div>

              <div className="space-y-3">
                {clientReports.map(r => {
                  const dotColor = STATUS_DOT[r.status] || STATUS_DOT.draft
                  return (
                    <div key={r.id} className="group relative rounded-xl p-4 transition-all duration-300"
                      style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.25)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}60` }} />
                            <h3 className="text-sm font-bold truncate" style={{ color: '#fff' }}>{r.report_name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0" style={{ color: dotColor, background: `${dotColor}18` }}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {r.period_label && <span className="font-medium">{r.period_label}</span>}
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(r.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {r.status === 'published' && (
                            <>
                              <a href={getReportUrl(r.slug)} target="_blank" rel="noopener noreferrer"
                                className="p-2 rounded-lg transition-all duration-200" style={{ color: 'rgba(255,255,255,0.4)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                                title="פתיחה">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button onClick={() => handleCopy(r.slug)}
                                className="p-2 rounded-lg transition-all duration-200"
                                style={{ color: copied === r.slug ? '#40e1d3' : 'rgba(255,255,255,0.4)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                title="העתקת לינק">
                                {copied === r.slug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          <Link href={`/admin/reports/${r.id}`}
                            className="p-2 rounded-lg transition-all duration-200" style={{ color: 'rgba(255,255,255,0.4)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                            title="עריכה">
                            <Edit3 className="w-4 h-4" />
                          </Link>
                          {userRole === 'admin' && (
                            <button onClick={() => handleDelete(r.id, r.report_name)}
                              className="p-2 rounded-lg transition-all duration-200" style={{ color: 'rgba(255,255,255,0.4)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                              title="מחיקה">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
