'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink, Copy, Trash2, Edit3, Check, MessageCircle } from 'lucide-react'

interface Campaign {
  id: string
  client: string
  campaign_name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  sections: { assets: unknown[] }[]
  created_at: string
}

function getUserRole(): string {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_session='))
    if (!cookie) return 'admin'
    const json = atob(decodeURIComponent(cookie.split('=')[1]))
    return JSON.parse(json).role || 'admin'
  } catch { return 'admin' }
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
  const [userRole, setUserRole] = useState('admin')

  useEffect(() => { setUserRole(getUserRole()) }, [])

  useEffect(() => {
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
    const text = `${campaign.campaign_name} - ${campaign.client}\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
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

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text-primary)' }}>קמפיינים</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>ניהול קמפיינים קריאייטיביים ושליחה ללקוחות</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
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
          className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none transition-colors"
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
          <p className="text-lg font-bold mb-2" style={{ color: 'var(--admin-text-muted)' }}>
            {search ? 'לא נמצאו תוצאות' : 'אין קמפיינים עדיין'}
          </p>
          {!search && (
            <Link href="/admin/campaigns/new" className="text-sm font-bold" style={{ color: 'var(--admin-accent)' }}>
              צרו את הקמפיין הראשון
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const ss = STATUS_STYLES[c.status] || STATUS_STYLES.draft
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 p-5 rounded-2xl transition-all duration-200"
                style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-base font-black truncate" style={{ color: 'var(--admin-text-primary)' }}>{c.campaign_name}</h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ color: ss.color, background: ss.bg }}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                    <span className="font-bold" style={{ color: 'var(--admin-link)' }}>{c.client}</span>
                    <span>{totalAssets(c)} תוצרים</span>
                    <span>{new Date(c.created_at).toLocaleDateString('he-IL')}</span>
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
      )}
    </div>
  )
}
