'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, MessageCircle, Files, Image as ImageIcon, Calendar, LayoutTemplate, Bookmark, X, Loader2 } from 'lucide-react'
import { whatsappShareUrl } from '@/lib/share'
import { useT, useLocale } from '@/lib/i18n'
import { useToast } from '../_components/toast'

interface Campaign {
  id: string
  client: string
  campaign_name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  sections: { assets: unknown[] }[]
  created_at: string
  workspace_id: string | null
  created_by?: string | null
  feedback_counts?: { approved: number; rejected: number; pending: number }
}

interface Workspace {
  id: string
  name: string
  color: string
}

async function fetchMe(): Promise<{ role: string; id: string | null }> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return { role: 'viewer', id: null }
    const { user } = await res.json()
    return { role: user?.role || 'viewer', id: user?.id || user?.userId || null }
  } catch { return { role: 'viewer', id: null } }
}

const STATUS_DOT: Record<string, string> = {
  draft: '#f59e0b',
  published: '#40e1d3',
  archived: '#64748b',
}

export default function CampaignsListPage() {
  const t = useT()
  const locale = useLocale()
  const { showToast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('admin')
  const [myId, setMyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [templates, setTemplates] = useState<Campaign[] | null>(null)
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null)
  const router = useRouter()

  const STATUS_LABELS: Record<string, string> = { draft: t('common.draft'), published: t('common.published'), archived: t('common.archived') }

  useEffect(() => {
    fetchMe().then(me => { setUserRole(me.role); setMyId(me.id) })
    fetch('/api/workspaces').then(r => r.ok ? r.json() : []).then(setWorkspaces).catch(() => {})
  }, [])

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      fetch(`/api/campaigns?${params}`)
        .then(r => {
          if (r.status === 401) {
            window.location.href = '/admin/login'
            return null
          }
          return r.json()
        })
        .then(data => {
          if (Array.isArray(data)) setCampaigns(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, search ? 300 : 0)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  function getCampaignUrl(slug: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/c/${slug}`
  }

  function handleCopy(slug: string) {
    navigator.clipboard.writeText(getCampaignUrl(slug))
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleWhatsApp(campaign: Campaign) {
    const url = getCampaignUrl(campaign.slug)
    window.open(whatsappShareUrl({ title: campaign.campaign_name, client: campaign.client, url }), '_blank')
  }

  async function handleDuplicate(campaign: Campaign) {
    if (!confirm(`לשכפל את "${campaign.campaign_name}"?`)) return
    setDuplicating(campaign.id)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/duplicate`, { method: 'POST' })
      if (res.ok) {
        const created = await res.json()
        setCampaigns(prev => [created, ...prev])
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(`שגיאה בשכפול: ${err.error || 'Unknown error'}`)
      }
    } finally {
      setDuplicating(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את הקמפיין "${name}"?`)) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  async function handleSaveAsTemplate(campaign: Campaign) {
    setDuplicating(campaign.id)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asTemplate: true }),
      })
      showToast(res.ok ? t('campaigns.savedAsTemplate') : 'שגיאה', res.ok ? 'success' : 'error')
    } finally {
      setDuplicating(null)
    }
  }

  function openTemplates() {
    setTemplatesOpen(true)
    setTemplates(null)
    fetch('/api/campaigns?templates=1')
      .then(r => r.ok ? r.json() : [])
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
  }

  async function handleUseTemplate(template: Campaign) {
    setCreatingFrom(template.id)
    try {
      const res = await fetch(`/api/campaigns/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: template.campaign_name }),
      })
      if (res.ok) {
        const created = await res.json()
        router.push(`/admin/campaigns/${created.id}`)
      } else {
        showToast('שגיאה ביצירת קמפיין מהתבנית', 'error')
      }
    } finally {
      setCreatingFrom(null)
    }
  }

  function parseSections(raw: unknown): { assets: unknown[] }[] {
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {} }
    return []
  }

  const totalAssets = (c: Campaign) => parseSections(c.sections).reduce((sum, s) => sum + (s.assets?.length || 0), 0)
  const totalSections = (c: Campaign) => parseSections(c.sections).length

  const filteredCampaigns = campaigns.filter(c =>
    (statusFilter === 'all' || c.status === statusFilter) &&
    (!mineOnly || (myId != null && c.created_by === myId))
  )

  const groupedByClient = (() => {
    const groups = new Map<string, Campaign[]>()
    for (const c of filteredCampaigns) {
      const key = c.client?.trim() || (locale === 'en' ? 'No client' : 'ללא לקוח')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'he'))
  })()

  const totalCampaigns = campaigns.length
  const publishedCount = campaigns.filter(c => c.status === 'published').length

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#40e1d3', boxShadow: '0 0 12px rgba(64,225,211,0.6)' }} />
          <div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-text-primary)' }}>{t('campaigns.title')}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openTemplates}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
          >
            <LayoutTemplate className="w-4 h-4" />
            {t('campaigns.fromTemplate')}
          </button>
          <Link
            href="/admin/campaigns/new"
            className="campaign-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
            style={{
              background: 'rgba(64,225,211,0.12)',
              border: '1px solid rgba(64,225,211,0.4)',
              color: '#40e1d3',
            }}
          >
            <Plus className="w-4 h-4" />
            {t('campaigns.new')}
          </Link>
        </div>
      </div>

      {/* KPI Summary */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: t('campaigns.total'), value: totalCampaigns },
            { label: t('common.published'), value: publishedCount },
            { label: t('nav.clients'), value: groupedByClient.length },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="rounded-xl p-4 transition-all duration-300"
              style={{
                background: 'rgba(10,10,10,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>{kpi.label}</div>
              <div className="text-2xl font-black" style={{ color: '#40e1d3' }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('campaigns.search')}
          className="w-full ps-11 pe-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(10,10,10,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--admin-text-primary)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(64,225,211,0.15)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', 'draft', 'published', 'archived'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={statusFilter === s
              ? { background: 'rgba(64,225,211,0.14)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }
              : { background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}
          >
            {s === 'all' ? t('common.all') : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={() => setMineOnly(m => !m)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ms-auto"
          style={mineOnly
            ? { background: 'rgba(64,225,211,0.14)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }
            : { background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}
        >
          {t('campaigns.mineOnly')}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--admin-text-muted)' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(64,225,211,0.3)', borderTopColor: '#40e1d3' }} />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="relative text-center py-24 px-8 rounded-2xl" style={{ background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute top-0 right-0 w-16 h-16" style={{ borderTop: '2px solid rgba(64,225,211,0.3)', borderRight: '2px solid rgba(64,225,211,0.3)' }} />
          <div className="absolute bottom-0 left-0 w-16 h-16" style={{ borderBottom: '2px solid rgba(64,225,211,0.15)', borderLeft: '2px solid rgba(64,225,211,0.15)' }} />
          <p className="text-lg font-bold mb-3" style={{ color: 'var(--admin-text-secondary)' }}>
            {search ? t('common.noResults') : t('campaigns.empty')}
          </p>
          {!search && (
            <Link
              href="/admin/campaigns/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
              style={{ background: 'rgba(64,225,211,0.12)', border: '1px solid rgba(64,225,211,0.3)', color: '#40e1d3' }}
            >
              <Plus className="w-4 h-4" /> {t('campaigns.createFirst')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByClient.map(([clientName, clientCampaigns]) => (
            <div key={clientName}>
              {/* Client group header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#40e1d3', boxShadow: '0 0 8px rgba(64,225,211,0.5)' }} />
                <h3 className="text-sm font-bold tracking-wide" style={{ color: '#40e1d3' }}>{clientName}</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded font-semibold" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>
                  {clientCampaigns.length}
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(64,225,211,0.15), transparent)' }} />
              </div>

              <div className="space-y-3">
                {clientCampaigns.map(c => {
                  const dotColor = STATUS_DOT[c.status] || STATUS_DOT.draft
                  const assets = totalAssets(c)
                  const sections = totalSections(c)

                  return (
                    <div
                      key={c.id}
                      className="campaign-card group relative rounded-xl p-4 transition-all duration-300"
                      style={{
                        background: 'rgba(10,10,10,0.8)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(64,225,211,0.25)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(64,225,211,0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}60` }} />
                            <h3 className="text-sm font-bold truncate" style={{ color: '#fff' }}>{c.campaign_name}</h3>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0"
                              style={{ color: dotColor, background: `${dotColor}18` }}
                            >
                              {STATUS_LABELS[c.status]}
                            </span>
                            {c.feedback_counts && (c.feedback_counts.approved + c.feedback_counts.rejected + c.feedback_counts.pending) > 0 && (
                              <span className="flex items-center gap-1.5 text-[10px] font-bold shrink-0" title="משוב לקוח">
                                {c.feedback_counts.approved > 0 && <span style={{ color: '#40e1d3' }}>✓{c.feedback_counts.approved}</span>}
                                {c.feedback_counts.rejected > 0 && <span style={{ color: '#ef4444' }}>✕{c.feedback_counts.rejected}</span>}
                                {c.feedback_counts.pending > 0 && <span style={{ color: '#94a3b8' }}>⏳{c.feedback_counts.pending}</span>}
                              </span>
                            )}
                          </div>

                          {/* Metrics row */}
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="w-3 h-3" />
                              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{assets}</span> {t('campaigns.assets')}
                            </span>
                            <span className="font-medium">{sections} {t('campaigns.slides')}</span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(c.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL')}
                            </span>
                            {(() => {
                              const ws = workspaces.find(w => w.id === c.workspace_id)
                              return ws ? (
                                <span className="px-2 py-0.5 rounded font-semibold" style={{ background: `${ws.color}15`, color: ws.color, fontSize: '10px' }}>
                                  {ws.name}
                                </span>
                              ) : null
                            })()}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {c.status === 'published' && (
                            <>
                              <a
                                href={getCampaignUrl(c.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg transition-all duration-200"
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                                title="פתיחה"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleCopy(c.slug)}
                                className="p-2 rounded-lg transition-all duration-200"
                                style={{ color: copied === c.slug ? '#40e1d3' : 'rgba(255,255,255,0.4)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                title="העתקת לינק"
                              >
                                {copied === c.slug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleWhatsApp(c)}
                                className="p-2 rounded-lg transition-all duration-200"
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.1)'; e.currentTarget.style.color = '#25d366' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                                title="שליחה בוואטסאפ"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {userRole !== 'viewer' && (
                            <button
                              onClick={() => handleDuplicate(c)}
                              disabled={duplicating === c.id}
                              className="p-2 rounded-lg transition-all duration-200 disabled:opacity-30"
                              style={{ color: 'rgba(255,255,255,0.4)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                              title="שכפול"
                            >
                              <Files className="w-4 h-4" />
                            </button>
                          )}
                          {userRole !== 'viewer' && (
                            <button
                              onClick={() => handleSaveAsTemplate(c)}
                              disabled={duplicating === c.id}
                              className="p-2 rounded-lg transition-all duration-200 disabled:opacity-30"
                              style={{ color: 'rgba(255,255,255,0.4)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                              title={t('campaigns.saveAsTemplate')}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            href={`/admin/campaigns/${c.id}`}
                            className="p-2 rounded-lg transition-all duration-200"
                            style={{ color: 'rgba(255,255,255,0.4)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.1)'; e.currentTarget.style.color = '#40e1d3' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                            title="עריכה"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Link>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDelete(c.id, c.campaign_name)}
                              className="p-2 rounded-lg transition-all duration-200"
                              style={{ color: 'rgba(255,255,255,0.4)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                              title="מחיקה"
                            >
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

      {/* From-template modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setTemplatesOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl p-5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
                <LayoutTemplate className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} /> {t('campaigns.templatesTitle')}
              </h3>
              <button onClick={() => setTemplatesOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--admin-text-muted)' }} aria-label="close"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.templatesHint')}</p>
            {templates === null ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--admin-text-muted)' }}>...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--admin-text-muted)' }}>{t('campaigns.noTemplates')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {templates.map(tpl => (
                  <div key={tpl.id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text-primary)' }}>{tpl.campaign_name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--admin-text-muted)' }}>{tpl.client}</p>
                    </div>
                    <button
                      onClick={() => handleUseTemplate(tpl)}
                      disabled={creatingFrom === tpl.id}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                      style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                    >
                      {creatingFrom === tpl.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {creatingFrom === tpl.id ? t('campaigns.creating') : t('campaigns.useTemplate')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
