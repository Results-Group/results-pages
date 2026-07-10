'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/lib/i18n'
import { Plus, Search, Contact, Trash2, Edit3, X, RefreshCw, GitMerge, ArrowRight, CheckCircle } from 'lucide-react'

interface Client {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
  workspace_id: string | null
}

// Normalise a client name for fuzzy duplicate detection
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u0590-\u05FF\s\-_./]+/g, ' ') // strip Hebrew + punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

function similarityScore(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (na === nb) return 1
  // Check if one is a substring of the other
  if (na.includes(nb) || nb.includes(na)) return 0.9
  // Word overlap
  const wa = new Set(na.split(' ').filter(Boolean))
  const wb = new Set(nb.split(' ').filter(Boolean))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : intersection / union
}

interface DuplicatePair { a: Client; b: Client; score: number }

export default function ClientsPage() {
  const t = useT()
  const locale = useLocale()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [mondayAvailable, setMondayAvailable] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [showMerge, setShowMerge] = useState(false)

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
    if (!confirm(t('clients.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert(t('clients.deleteError'))
        return
      }
      await load()
    } catch {
      alert(t('clients.deleteError'))
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
            <Contact className="w-5 h-5" /> {t('clients.title')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clients.length > 1 && (
            <button
              onClick={() => setShowMerge(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
            >
              <GitMerge className="w-4 h-4" /> {t('clients.mergeDuplicates')}
            </button>
          )}
          {mondayAvailable && (
            <button
              onClick={handleMondaySync}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
              title={t('clients.syncMonday')}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('clients.syncing') : t('clients.syncMonday')}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            <Plus className="w-4 h-4" /> {t('clients.newClient')}
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
          placeholder={t('clients.search')}
          className="w-full max-w-xs pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <Contact className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--admin-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.noClients')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map(c => {
            const accent = c.brand_color || '#40e1d3'
            return (
              <div
                key={c.id}
                className="group relative rounded-xl overflow-hidden flex items-center transition-colors"
                style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
              >
                {/* Color accent bar on the right (RTL = visual left) */}
                <div className="w-1 self-stretch flex-shrink-0" style={{ background: accent }} />

                <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5">
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ outline: `2px solid ${accent}55` }} />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: accent + '22', color: accent, border: `1.5px solid ${accent}55` }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p
                    className="text-sm font-medium leading-snug"
                    style={{
                      color: 'var(--admin-text-primary)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {c.name}
                  </p>
                </Link>

                <div className="flex items-center gap-1 pl-3 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Link href={`/admin/clients/${c.id}`} className="p-1.5 rounded-lg" style={{ color: 'var(--admin-text-muted)' }}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg" style={{ color: 'var(--admin-danger)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {showMerge && <MergeModal clients={clients} onClose={() => setShowMerge(false)} onMerged={() => { setShowMerge(false); load() }} />}
    </div>
  )
}

function ClientAvatar({ client }: { client: Client }) {
  const accent = client.brand_color || '#40e1d3'
  if (client.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={client.logo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  }
  return (
    <span
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ background: accent + '22', color: accent, border: `1.5px solid ${accent}55` }}
    >
      {client.name.charAt(0).toUpperCase()}
    </span>
  )
}

function MergeModal({ clients, onClose, onMerged }: { clients: Client[]; onClose: () => void; onMerged: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [merging, setMerging] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  // selectedKeep: for each pair key, which client id to keep
  const [selectedKeep, setSelectedKeep] = useState<Record<string, string>>({})

  const pairs: DuplicatePair[] = []
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const score = similarityScore(clients[i].name, clients[j].name)
      if (score >= 0.5) pairs.push({ a: clients[i], b: clients[j], score })
    }
  }
  pairs.sort((x, y) => y.score - x.score)

  // Filter out pairs where one side was already merged away
  const mergedAway = new Set<string>()
  const activePairs = pairs.filter(p => !mergedAway.has(p.a.id) && !mergedAway.has(p.b.id) && !done.has(`${p.a.id}-${p.b.id}`))

  function pairKey(p: DuplicatePair) { return `${p.a.id}-${p.b.id}` }
  function keepFor(p: DuplicatePair) { return selectedKeep[pairKey(p)] ?? p.b.id }
  function deleteFor(p: DuplicatePair) { const k = keepFor(p); return k === p.a.id ? p.b.id : p.a.id }

  async function handleMerge(p: DuplicatePair) {
    const deleteId = deleteFor(p)
    const keepId = keepFor(p)
    setMerging(pairKey(p))
    setError(null)
    try {
      const res = await fetch(`/api/clients/${deleteId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_into_id: keepId }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? t('clients.mergeError'))
        return
      }
      mergedAway.add(deleteId)
      setDone(prev => new Set([...prev, pairKey(p)]))
    } catch {
      setError(t('clients.mergeError'))
    } finally {
      setMerging(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
              <GitMerge className="w-4 h-4" /> {t('clients.mergeTitle')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
              {t('clients.mergeHint')}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {activePairs.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-accent)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{t('clients.noDuplicates')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.noDuplicatesHint')}</p>
            </div>
          ) : (
            activePairs.map(p => {
              const key = pairKey(p)
              const keepId = keepFor(p)
              const isMergingThis = merging === key
              return (
                <div key={key} className="rounded-xl p-4" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    {/* Client A */}
                    <button
                      onClick={() => setSelectedKeep(s => ({ ...s, [key]: p.a.id }))}
                      className={`flex-1 flex items-center gap-2.5 rounded-lg p-2.5 text-right transition-all ${keepId === p.a.id ? 'ring-2' : 'opacity-60 hover:opacity-100'}`}
                      style={{
                        background: keepId === p.a.id ? 'var(--admin-bg)' : 'transparent',
                        outline: keepId === p.a.id ? '2px solid var(--admin-accent)' : 'none',
                      }}
                    >
                      <ClientAvatar client={p.a} />
                      <span className="text-sm font-medium leading-snug text-right flex-1" style={{ color: 'var(--admin-text-primary)' }}>{p.a.name}</span>
                      {keepId === p.a.id && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />}
                    </button>

                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-text-muted)' }} />

                    {/* Client B */}
                    <button
                      onClick={() => setSelectedKeep(s => ({ ...s, [key]: p.b.id }))}
                      className={`flex-1 flex items-center gap-2.5 rounded-lg p-2.5 text-right transition-all ${keepId === p.b.id ? 'ring-2' : 'opacity-60 hover:opacity-100'}`}
                      style={{
                        background: keepId === p.b.id ? 'var(--admin-bg)' : 'transparent',
                        outline: keepId === p.b.id ? '2px solid var(--admin-accent)' : 'none',
                      }}
                    >
                      <ClientAvatar client={p.b} />
                      <span className="text-sm font-medium leading-snug text-right flex-1" style={{ color: 'var(--admin-text-primary)' }}>{p.b.name}</span>
                      {keepId === p.b.id && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                      {t('clients.similarity')}: {Math.round(p.score * 100)}%
                    </span>
                    <button
                      onClick={() => handleMerge(p)}
                      disabled={isMergingThis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      {isMergingThis ? t('clients.merging') : t('clients.merge')}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {error && (
          <div className="px-5 pb-3">
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)' }}>{error}</p>
          </div>
        )}

        <div className="p-5 border-t" style={{ borderColor: 'var(--admin-border)' }}>
          <button onClick={onMerged} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [name, setName] = useState('')
  const [brandColor, setBrandColor] = useState('#40e1d3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError(t('clients.clientNameRequired')); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brand_color: brandColor }),
      })
      if (res.ok) onCreated()
      else { setError(t('clients.createError')); setSaving(false) }
    } catch {
      setError(t('clients.createError'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('clients.createTitle')}</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.clientName')}</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.brandColor')}</label>
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
          {saving ? t('clients.saving') : t('clients.createBtn')}
        </button>
      </div>
    </div>
  )
}
