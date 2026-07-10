'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Contact, Trash2, Edit3, X, RefreshCw } from 'lucide-react'

interface Client {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
  workspace_id: string | null
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [mondayAvailable, setMondayAvailable] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, syncRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/clients/sync'),
      ])
      setClients(clientsRes.ok ? await clientsRes.json() : [])
      if (syncRes.ok) {
        const syncData = await syncRes.json() as { available: boolean }
        setMondayAvailable(syncData.available ?? false)
      }
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleMondaySync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/clients/sync', { method: 'POST' })
      const data = await res.json() as { created?: number; skipped?: number; total?: number; error?: string }
      if (res.ok && data.created !== undefined) {
        setSyncMessage({
          text: `${data.created} לקוחות חדשים נוספו, ${data.skipped} כבר קיימים (סה"כ ${data.total} ב-Monday)`,
          ok: true,
        })
        await load()
      } else {
        setSyncMessage({ text: data.error ?? 'שגיאה בסנכרון', ok: false })
      }
    } catch {
      setSyncMessage({ text: 'שגיאה בסנכרון מ-Monday.com', ok: false })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [load])

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הלקוח? דפים וקמפיינים משויכים לא יימחקו אך יאבדו את השיוך.')) return
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('שגיאה במחיקת הלקוח')
        return
      }
      await load()
    } catch {
      alert('שגיאה במחיקת הלקוח')
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
            <Contact className="w-5 h-5" /> לקוחות
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>
            ניהול לקוחות, לוגו, צבע מותג ואנשי קשר
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mondayAvailable && (
            <button
              onClick={handleMondaySync}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
              title="סנכרן לקוחות מ-Monday.com"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'מסנכרן...' : 'סנכרן מ-Monday'}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            <Plus className="w-4 h-4" /> לקוח חדש
          </button>
        </div>
      </div>

      {syncMessage && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3"
          style={{
            background: syncMessage.ok ? 'var(--admin-success-bg, #d1fae5)' : 'var(--admin-danger-bg)',
            color: syncMessage.ok ? 'var(--admin-success, #065f46)' : 'var(--admin-danger)',
            border: `1px solid ${syncMessage.ok ? 'var(--admin-success, #6ee7b7)' : 'var(--admin-danger)'}`,
          }}
        >
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} style={{ opacity: 0.6 }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לקוח..."
          className="w-full max-w-xs pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <Contact className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>אין לקוחות עדיין</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-xl p-4 group relative" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
              <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-3">
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" style={{ background: 'var(--admin-bg)' }} />
                ) : (
                  <span className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-base font-semibold" style={{ background: c.brand_color || 'var(--admin-bg)', color: '#fff' }}>
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text-primary)' }}>{c.name}</p>
                  <span className="inline-flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.brand_color || '#40e1d3' }} />
                    {c.brand_color || '#40e1d3'}
                  </span>
                </div>
              </Link>
              <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/admin/clients/${c.id}`} className="p-1.5 rounded-lg" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-secondary)' }}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Link>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg" style={{ background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [brandColor, setBrandColor] = useState('#40e1d3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('שם לקוח הוא שדה חובה'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brand_color: brandColor }),
      })
      if (res.ok) onCreated()
      else { setError('שגיאה ביצירת לקוח'); setSaving(false) }
    } catch {
      setError('שגיאה ביצירת לקוח')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>לקוח חדש</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>שם הלקוח</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>צבע מותג</label>
        <div className="flex items-center gap-2 mb-4">
          <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
          <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} dir="ltr"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
        </div>

        {error && <p className="text-sm mb-3" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
          {saving ? 'שומר...' : 'צור לקוח'}
        </button>
      </div>
    </div>
  )
}
