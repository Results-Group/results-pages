'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/lib/i18n'
import { useToast } from '../_components/toast'
import { Plus, Search, Contact, Trash2, X, RefreshCw, GitMerge, ArrowRight, CheckCircle, Megaphone, FileText, Pencil } from 'lucide-react'

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
  return name.toLowerCase().replace(/[֐-׿\s\-_./]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function similarityScore(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (na === nb) return 1
  // A substring match is NOT near-identity: "פיצה האוס" is contained in
  // "פיצה האוס מבשרת", but they are different branches. Scoring it 0.9 put
  // genuinely distinct clients at the top of an irreversible merge list, so it
  // now falls through to word-overlap scoring like any other pair.
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
  // Distinguishes a real outage from a genuinely empty list.
  const [loadFailed, setLoadFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, syncRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/clients/sync'),
      ])
      setLoadFailed(!clientsRes.ok)
      setClients(clientsRes.ok ? await clientsRes.json() : [])
      if (syncRes.ok) {
        const syncData = await syncRes.json() as { available: boolean }
        setMondayAvailable(syncData.available ?? false)
      }
    } catch {
      setLoadFailed(true)
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
        setSyncMessage({ text: `${data.created} לקוחות חדשים נוספו, ${data.skipped} כבר קיימים (סה"כ ${data.total} ב-Monday)`, ok: true })
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
      if (!res.ok) { showToast(t('clients.deleteError')); return }
      await load()
    } catch {
      showToast(t('clients.deleteError'))
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
            {t('clients.title')}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clients.length > 1 && (
            <button onClick={() => setShowMerge(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
              <GitMerge className="w-4 h-4" /> {t('clients.mergeDuplicates')}
            </button>
          )}
          {mondayAvailable && (
            <button onClick={handleMondaySync} disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('clients.syncing') : t('clients.syncMonday')}
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
            <Plus className="w-4 h-4" /> {t('clients.newClient')}
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3"
          style={{
            background: syncMessage.ok ? 'var(--admin-success-bg)' : 'var(--admin-danger-bg)',
            color: syncMessage.ok ? 'var(--admin-success)' : 'var(--admin-danger)',
            border: `1px solid ${syncMessage.ok ? 'var(--admin-success)' : 'var(--admin-danger)'}`,
          }}>
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} style={{ opacity: 0.6 }} aria-label={t('common.close')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('clients.search')}
          className="w-full max-w-xs pr-10 pl-3.5 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <Contact className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-base font-medium mb-1" style={{ color: loadFailed ? 'var(--admin-danger)' : 'var(--admin-text-primary)' }}>
            {loadFailed ? t('clients.loadError') : t('clients.noClients')}
          </p>
          <p className="text-sm">
            {loadFailed ? t('clients.loadErrorHint') : (search ? t('clients.noResults') : t('clients.noClientsHint'))}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--admin-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--admin-bg-elevated)', borderBottom: '1px solid var(--admin-border)' }}>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.thClient')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.thCampaigns')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.thPages')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.thContacts')}</th>
                <th className="text-start px-4 py-2.5 font-medium text-xs tracking-wide w-24" style={{ color: 'var(--admin-text-muted)' }}>{t('pages.thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const accent = c.brand_color || '#40e1d3'
                return (
                  <tr key={c.id}
                    className="transition-colors duration-150"
                    style={{ borderBottom: '1px solid var(--admin-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Client */}
                    <td className="px-4 py-3">
                      <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-3 group">
                        {c.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" style={{ border: `2px solid ${accent}44` }} />
                        ) : (
                          <span className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                            style={{ background: accent + '18', color: accent }}>
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium group-hover:underline decoration-1 underline-offset-2"
                            style={{ color: 'var(--admin-text-primary)' }}>
                            {c.name}
                          </span>
                          <div className="w-full h-0.5 rounded-full mt-1" style={{ background: accent, maxWidth: 40, opacity: 0.6 }} />
                        </div>
                      </Link>
                    </td>
                    {/* Campaigns */}
                    <td className="px-4 py-3">
                      {c.campaign_count > 0 ? (
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                          <Megaphone className="w-3.5 h-3.5" /> {c.campaign_count}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    {/* Pages */}
                    <td className="px-4 py-3">
                      {c.page_count > 0 ? (
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--admin-text-secondary)' }}>
                          <FileText className="w-3.5 h-3.5" /> {c.page_count}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    {/* Contacts */}
                    <td className="px-4 py-3">
                      {c.contacts_count > 0 ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-md font-medium"
                          style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                          {c.contacts_count}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/clients/${c.id}`}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--admin-link)' }}
                          title={t('common.edit')}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--admin-danger)' }}
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {showMerge && <MergeModal clients={clients} onClose={() => setShowMerge(false)} onMerged={() => { setShowMerge(false); load() }} />}
    </div>
  )
}

function ClientAvatar({ client }: { client: Client }) {
  const accent = client.brand_color || '#40e1d3'
  if (client.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={client.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
  }
  return (
    <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ background: accent + '18', color: accent }}>
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

  // State, not a local: a plain Set was rebuilt on every render, so pairs
  // referencing an already-deleted client stayed listed and clickable.
  const [mergedAway, setMergedAway] = useState<Set<string>>(new Set())
  const activePairs = pairs.filter(p => !mergedAway.has(p.a.id) && !mergedAway.has(p.b.id) && !done.has(`${p.a.id}-${p.b.id}`))

  function pairKey(p: DuplicatePair) { return `${p.a.id}-${p.b.id}` }
  function keepFor(p: DuplicatePair) { return selectedKeep[pairKey(p)] ?? p.b.id }
  function deleteFor(p: DuplicatePair) { const k = keepFor(p); return k === p.a.id ? p.b.id : p.a.id }

  async function handleMerge(p: DuplicatePair) {
    const deleteId = deleteFor(p)
    const keepId = keepFor(p)
    // Irreversible: the source client's row — logo, contacts, notes, brand
    // colour and positioning — is deleted, not merged. Name both sides.
    const deleteName = deleteId === p.a.id ? p.a.name : p.b.name
    const keepName = keepId === p.a.id ? p.a.name : p.b.name
    if (!window.confirm(
      `למזג את "${deleteName}" לתוך "${keepName}"?\n\n` +
      `הקמפיינים, הדפים והדוחות יועברו ל"${keepName}", ו"${deleteName}" יימחק לצמיתות. לא ניתן לבטל.`
    )) return
    setMerging(pairKey(p))
    setError(null)
    try {
      const res = await fetch(`/api/clients/${deleteId}/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_into_id: keepId }),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? t('clients.mergeError')); return }
      setMergedAway(prev => new Set([...prev, deleteId]))
      setDone(prev => new Set([...prev, pairKey(p)]))
    } catch { setError(t('clients.mergeError')) } finally { setMerging(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--admin-text-primary)' }}>
              <GitMerge className="w-4 h-4" /> {t('clients.mergeTitle')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.mergeHint')}</p>
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
          ) : activePairs.map(p => {
            const key = pairKey(p); const keepId = keepFor(p); const isMergingThis = merging === key
            return (
              <div key={key} className="rounded-xl p-4" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setSelectedKeep(s => ({ ...s, [key]: p.a.id }))}
                    className={`flex-1 flex items-center gap-2.5 rounded-lg p-2.5 text-right transition-all ${keepId === p.a.id ? '' : 'opacity-60 hover:opacity-100'}`}
                    style={{ background: keepId === p.a.id ? 'var(--admin-bg)' : 'transparent', outline: keepId === p.a.id ? '2px solid var(--admin-accent)' : 'none' }}>
                    <ClientAvatar client={p.a} />
                    <span className="text-sm font-medium leading-snug text-right flex-1" style={{ color: 'var(--admin-text-primary)' }}>{p.a.name}</span>
                    {keepId === p.a.id && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />}
                  </button>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-text-muted)' }} />
                  <button onClick={() => setSelectedKeep(s => ({ ...s, [key]: p.b.id }))}
                    className={`flex-1 flex items-center gap-2.5 rounded-lg p-2.5 text-right transition-all ${keepId === p.b.id ? '' : 'opacity-60 hover:opacity-100'}`}
                    style={{ background: keepId === p.b.id ? 'var(--admin-bg)' : 'transparent', outline: keepId === p.b.id ? '2px solid var(--admin-accent)' : 'none' }}>
                    <ClientAvatar client={p.b} />
                    <span className="text-sm font-medium leading-snug text-right flex-1" style={{ color: 'var(--admin-text-primary)' }}>{p.b.name}</span>
                    {keepId === p.b.id && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-accent)' }} />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{t('clients.similarity')}: {Math.round(p.score * 100)}%</span>
                  <button onClick={() => handleMerge(p)} disabled={isMergingThis}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
                    <GitMerge className="w-3.5 h-3.5" />
                    {isMergingThis ? t('clients.merging') : t('clients.merge')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {error && <div className="px-5 pb-3"><p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)' }}>{error}</p></div>}
        <div className="p-5 border-t" style={{ borderColor: 'var(--admin-border)' }}>
          <button onClick={onMerged} className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }}>
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
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brand_color: brandColor }),
      })
      if (res.ok) onCreated()
      else { setError(t('clients.createError')); setSaving(false) }
    } catch { setError(t('clients.createError')); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('clients.createTitle')}</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-text-muted)' }} aria-label={t('common.close')}><X className="w-4 h-4" /></button>
        </div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.clientName')}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('clients.brandColor')}</label>
        <div className="flex items-center gap-2 mb-4">
          <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
          <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} dir="ltr"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
        </div>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--admin-danger)' }}>{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
          {saving ? t('clients.saving') : t('clients.createBtn')}
        </button>
      </div>
    </div>
  )
}
