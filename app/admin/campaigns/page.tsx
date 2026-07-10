'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, MessageCircle, Files, Image as ImageIcon, Calendar } from 'lucide-react'
import { whatsappShareUrl } from '@/lib/share'

interface Campaign {
  id: string
  client: string
  campaign_name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  sections: { assets: unknown[] }[]
  created_at: string
  workspace_id: string | null
}

interface Workspace {
  id: string
  name: string
  color: string
}

async function fetchUserRole(): Promise<string> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return 'viewer'
    const { user } = await res.json()
    return user?.role || 'viewer'
  } catch { return 'viewer' }
}

const STATUS_LABELS: Record<string, string> = { draft: 'טיוטה', published: 'פורסם', archived: 'ארכיון' }
const STATUS_DOT: Record<string, string> = {
  draft: '#f59e0b',
  published: '#40e1d3',
  archived: '#64748b',
}

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('admin')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  useEffect(() => {
    fetchUserRole().then(r => setUserRole(r))
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
        alert(`שגיאה בשכפול: ${err.error || 'Unknown error'}`)
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

  function parseSections(raw: unknown): { assets: unknown[] }[] {
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {} }
    return []
  }

  const totalAssets = (c: Campaign) => parseSections(c.sections).reduce((sum, s) => sum + (s.assets?.length || 0), 0)
  const totalSections = (c: Campaign) => parseSections(c.sections).length

  const groupedByClient = (() => {
    const groups = new Map<string, Campaign[]>()
    for (const c of campaigns) {
      const key = c.client?.trim() || 'ללא לקוח'
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
            <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-text-primary)' }}>קמפיינים</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>ניהול קמפיינים קריאייטיביים ושליחה ללקוחות</p>
          </div>
        </div>
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
          קמפיין חדש
        </Link>
      </div>

      {/* KPI Summary */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'סה״כ קמפיינים', value: totalCampaigns },
            { label: 'פורסמו', value: publishedCount },
            { label: 'לקוחות', value: groupedByClient.length },
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
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם קמפיין או לקוח..."
          className="w-full pr-11 pl-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(10,10,10,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--admin-text-primary)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(64,225,211,0.15)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--admin-text-muted)' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(64,225,211,0.3)', borderTopColor: '#40e1d3' }} />
          <span className="text-sm">טוען קמפיינים...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="relative text-center py-24 px-8 rounded-2xl" style={{ background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute top-0 right-0 w-16 h-16" style={{ borderTop: '2px solid rgba(64,225,211,0.3)', borderRight: '2px solid rgba(64,225,211,0.3)' }} />
          <div className="absolute bottom-0 left-0 w-16 h-16" style={{ borderBottom: '2px solid rgba(64,225,211,0.15)', borderLeft: '2px solid rgba(64,225,211,0.15)' }} />
          <p className="text-lg font-bold mb-3" style={{ color: 'var(--admin-text-secondary)' }}>
            {search ? 'לא נמצאו תוצאות' : 'אין קמפיינים עדיין'}
          </p>
          {!search && (
            <Link
              href="/admin/campaigns/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
              style={{ background: 'rgba(64,225,211,0.12)', border: '1px solid rgba(64,225,211,0.3)', color: '#40e1d3' }}
            >
              <Plus className="w-4 h-4" /> צרו את הקמפיין הראשון
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
                          </div>

                          {/* Metrics row */}
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="w-3 h-3" />
                              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{assets}</span> תוצרים
                            </span>
                            <span className="font-medium">{sections} שקפים</span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(c.created_at).toLocaleDateString('he-IL')}
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
    </div>
  )
}
