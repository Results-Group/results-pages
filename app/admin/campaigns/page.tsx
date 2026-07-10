'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, MessageCircle, Files } from 'lucide-react'
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
const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  draft: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  published: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  archived: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
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
    if (!confirm(`למחוק את הקמפיין "${name}"? פעולה זו בלתי הפיכה.`)) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  function parseSections(raw: unknown): { assets: unknown[] }[] {
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {} }
    return []
  }

  const totalAssets = (c: Campaign) => parseSections(c.sections).reduce((sum, s) => sum + (s.assets?.length || 0), 0)

  const groupedByClient = (() => {
    const groups = new Map<string, Campaign[]>()
    for (const c of campaigns) {
      const key = c.client?.trim() || 'ללא לקוח'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'he'))
  })()

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>קמפיינים</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>ניהול קמפיינים קריאייטיביים ושליחה ללקוחות</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <Plus className="w-4 h-4" />
          קמפיין חדש
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם קמפיין או לקוח..."
          className="w-full pr-10 pl-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <span className="text-sm">טוען קמפיינים...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--admin-text-muted)' }}>
            {search ? 'לא נמצאו תוצאות' : 'אין קמפיינים עדיין'}
          </p>
          {!search && (
            <Link href="/admin/campaigns/new" className="text-sm font-medium" style={{ color: 'var(--admin-accent)' }}>
              צרו את הקמפיין הראשון
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByClient.map(([clientName, clientCampaigns]) => (
            <div key={clientName}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--admin-accent)' }}>{clientName}</h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                  style={{ color: 'var(--admin-text-muted)', background: 'var(--admin-bg-elevated)' }}
                >
                  {clientCampaigns.length} {clientCampaigns.length === 1 ? 'קמפיין' : 'קמפיינים'}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--admin-border)' }} />
              </div>
              <div className="space-y-3">
                {clientCampaigns.map(c => {
                  const ss = STATUS_STYLES[c.status] || STATUS_STYLES.draft
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3.5 rounded-xl transition-colors"
                      style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text-primary)' }}>{c.campaign_name}</h3>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0"
                            style={{ color: ss.color, background: ss.bg }}
                          >
                            {STATUS_LABELS[c.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                          <span>{totalAssets(c)} תוצרים</span>
                          <span>{new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                          {(() => {
                            const ws = workspaces.find(w => w.id === c.workspace_id)
                            return ws ? (
                              <span className="px-2 py-0.5 rounded-md font-medium" style={{ background: `${ws.color}20`, color: ws.color, fontSize: '10px' }}>
                                {ws.name}
                              </span>
                            ) : null
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.status === 'published' && (
                          <>
                            <a
                              href={getCampaignUrl(c.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 rounded-lg transition-colors"
                              style={{ color: 'var(--admin-text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)'; e.currentTarget.style.color = 'var(--admin-text-primary)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                              title="פתיחה"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleCopy(c.slug)}
                              className="p-2.5 rounded-lg transition-colors"
                              style={{ color: copied === c.slug ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              title="העתקת לינק"
                            >
                              {copied === c.slug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleWhatsApp(c)}
                              className="p-2.5 rounded-lg transition-colors"
                              style={{ color: 'var(--admin-text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)'; e.currentTarget.style.color = '#25d366' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
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
                            className="p-2.5 rounded-lg transition-colors disabled:opacity-40"
                            style={{ color: 'var(--admin-text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)'; e.currentTarget.style.color = 'var(--admin-accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                            title="שכפול"
                          >
                            <Files className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/admin/campaigns/${c.id}`}
                          className="p-2.5 rounded-lg transition-colors"
                          style={{ color: 'var(--admin-text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)'; e.currentTarget.style.color = 'var(--admin-accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                          title="עריכה"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDelete(c.id, c.campaign_name)}
                            className="p-2.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-danger-bg)'; e.currentTarget.style.color = 'var(--admin-danger)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-muted)' }}
                            title="מחיקה"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
