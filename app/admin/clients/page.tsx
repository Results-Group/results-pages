'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/lib/i18n'
import { useToast } from '../_components/toast'
import { Plus, Search, Contact, Trash2, X, RefreshCw, GitMerge, ArrowRight, CheckCircle, Megaphone, FileText, Users as UsersIcon } from 'lucide-react'

interface Client {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
  workspace_id: string | null
  campaign_count: number
  page_count: number
  contacts_count: number
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[֐-׿\s\-_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarityScore(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
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
  const { showToast } = useToast()
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

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('clients.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast(t('clients.deleteError'))
        return
      }
      await load()
    } catch {
      showToast(t('clients.deleteError'))
    }
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--admin-text-primary)' }}>
            {t('clients.title')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-text-muted)' }}>
            {filtered.length} {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clients.length > 1 && (
            <button
              onClick={() => setShowMerge(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
            >
              <GitMerge className="w-4 h-4" /> {t('clients.mergeDuplicates')}
            </button>
          )}
          {mondayAvailable && (
            <button
              onClick={handleMondaySync}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-[1.02]"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}
              title={t('clients.syncMonday')}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('clients.syncing') : t('clients.syncMonday')}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            <Plus className="w-4 h-4" /> {t('clients.newClient')}
          </button>
        </div>
      </div>

      {syncMessage && (
        <div
          className="mb-5 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3"
          style={{
            background: syncMessage.ok ? 'var(--admin-success-bg)' : 'var(--admin-danger-bg)',
            color: syncMessage.ok ? 'var(--admin-success)' : 'var(--admin-danger)',
            border: `1px solid ${syncMessage.ok ? 'var(--admin-success)' : 'var(--admin-danger)'}`,
          }}
        >
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} style={{ opacity: 0.6 }} aria-label={t('common.close')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('clients.search')}
          className="w-full max-w-sm pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-[140px] animate-pulse" style={{ background: 'var(--admin-bg-elevated)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <Contact className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--admin-text-muted)' }} />
          <p className="text-base font-medium mb-1" style={{ color: 'var(--admin-text-primary)' }}>{t('clients.noClients')}</p>
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{search ? t('clients.noResults') : t('clients.noClientsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientCard key={c.id} client={c} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {showMerge && <MergeModal clients={clients} onClose={() => setShowMerge(false)} onMerged={() => { setShowMerge(false); load() }} />}
    </div>
  )
}

function ClientCard({ client: c, onDelete }: { client: Client; onDelete: (id: string, e: React.MouseEvent) => void }) {
  const t = useT()
  const accent = c.brand_color || '#40e1d3'
  const totalWork = c.campaign_count + c.page_count

  return (
    <Link
      href={`/admin/clients/${c.id}`}
      className="group relative rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'var(--admin-bg-elevated)',
        border: '1px solid var(--admin-border)',
      }}
    >
      {/* Top accent stripe */}
      <div className="h-1" style={{ background: accent }} />

      <div className="p-5">
        {/* Logo + Name row */}
        <div className="flex items-start gap-3.5 mb-4">
          {c.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logo_url}
              alt=""
              className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
              style={{ border: `2px solid ${accent}33` }}
            />
          ) : (
            <span
              className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold"
              style={{ background: accent + '18', color: accent }}
            >
              {c.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold leading-snug group-hover:underline decoration-1 underline-offset-2"
              style={{ color: 'var(--admin-text-primary)' }}
            >
              {c.name}
            </h3>
            {c.contacts_count > 0 && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--admin-text-muted)' }}>
                <UsersIcon className="w-3 h-3" />
                {c.contacts_count} {c.contacts_count === 1 ? 'איש קשר' : 'אנשי קשר'}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" style={{ color: totalWork > 0 ? 'var(--admin-text-secondary)' : 'var(--admin-text-muted)' }}>
            <Megaphone className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{c.campaign_count}</span>
          </div>
          <div className="flex items-center gap-1.5" style={{ color: totalWork > 0 ? 'var(--admin-text-secondary)' : 'var(--admin-text-muted)' }}>
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{c.page_count}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={e => onDelete(c.id, e)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--admin-text-muted)' }}
            aria-label={t('common.delete')}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)'; e.currentTarget.style.background = 'var(--admin-danger-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Link>
  )
}

function ClientAvatar({ client }: { client: Client }) {
  const accent = client.brand_color || '#40e1d3'
  if (client.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={client.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
  }
  return (
    <span
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ background: accent + '18', color: accent }}
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
  const [selectedKeep, setSelectedKeep] = useState<Record<string, string>>({})

  const pairs: DuplicatePair[] = []
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const score = similarityScore(clients[i].name, clients[j].name)
      if (score >= 0.5) pairs.push({ a: clients[i], b: clients[j], score })
    }
  }
  pairs.sort((x, y) => y.score - x.score)

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
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
              <GitMerge className="w-4 h-4" /> {t('clients.mergeTitle')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
              {t('clients.mergeHint')}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }} aria-label={t('common.close')}><X className="w-4 h-4" /></button>
        </div>

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
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('clients.createTitle')}</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }} aria-label={t('common.close')}><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.clientName')}</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.brandColor')}</label>
        <div className="flex items-center gap-2 mb-5">
          <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
          <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} dir="ltr"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
        </div>

        {error && <p className="text-sm mb-3" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 hover:scale-[1.01]"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
          {saving ? t('clients.saving') : t('clients.createBtn')}
        </button>
      </div>
    </div>
  )
}
