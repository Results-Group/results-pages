'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Upload, Plus, Trash2, Megaphone, FileText, Save, Sparkles, Loader2, FileCheck2, Files } from 'lucide-react'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'
import { useToast } from '../../_components/toast'

interface Contact { name?: string; role?: string; email?: string; phone?: string }
interface Client {
  id: string
  name: string
  logo_url: string | null
  logo_path: string | null
  brand_color: string | null
  contacts: Contact[]
  notes: string | null
  workspace_id: string | null
  positioning: string | null
  positioning_pdf_path: string | null
}

interface LinkedCampaign { id: string; campaign_name: string; slug: string; client_id: string | null; status: string }
interface LinkedPage { id: string; title: string; client_id: string | null }

export default function ClientHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<LinkedCampaign[]>([])
  const [pages, setPages] = useState<LinkedPage[]>([])
  const [dirty, setDirty] = useState(false)
  const [distilling, setDistilling] = useState(false)
  const [dupLoading, setDupLoading] = useState(false)
  const { showToast } = useToast()
  const router = useRouter()

  useUnsavedChanges(dirty)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cRes = await fetch(`/api/clients/${id}`)
      const clientData: Client | null = cRes.ok ? await cRes.json() : null
      setClient(clientData)

      // Scope linked-work fetches to the client's own workspace so results
      // aren't hidden by the active-workspace cookie
      const wsParam = clientData?.workspace_id ? `?workspace_id=${encodeURIComponent(clientData.workspace_id)}` : ''
      const [campRes, pgRes] = await Promise.all([
        fetch(`/api/campaigns${wsParam}`),
        fetch(`/api/pages${wsParam}`),
      ])
      const allCamps: LinkedCampaign[] = campRes.ok ? await campRes.json() : []
      const allPages: LinkedPage[] = pgRes.ok ? await pgRes.json() : []
      setCampaigns(allCamps.filter(c => c.client_id === id))
      setPages(allPages.filter(p => p.client_id === id))
    } catch {
      setCampaigns([])
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load().catch(() => {}) }, [load])

  function updateField<K extends keyof Client>(key: K, val: Client[K]) {
    setDirty(true)
    setClient(prev => prev ? { ...prev, [key]: val } : prev)
  }

  function handleLogoSelect(file: File) {
    setDirty(true)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function addContact() {
    updateField('contacts', [...(client?.contacts || []), { name: '', role: '', email: '', phone: '' }])
  }
  function updateContact(i: number, patch: Partial<Contact>) {
    const next = [...(client?.contacts || [])]
    next[i] = { ...next[i], ...patch }
    updateField('contacts', next)
  }
  function removeContact(i: number) {
    updateField('contacts', (client?.contacts || []).filter((_, idx) => idx !== i))
  }

  // Duplicate the client's most recent campaign — a one-click "same as last month".
  async function handleDuplicateLatest() {
    const latest = campaigns[0]
    if (!latest) return
    setDupLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${latest.id}/duplicate`, { method: 'POST' })
      if (res.ok) {
        const created = await res.json()
        router.push(`/admin/campaigns/${created.id}`)
      } else {
        showToast('שגיאה בשכפול הקמפיין')
      }
    } catch {
      showToast('שגיאה בשכפול הקמפיין')
    } finally {
      setDupLoading(false)
    }
  }

  async function handlePositioningUpload(file: File) {
    if (file.type && file.type !== 'application/pdf') { showToast('נא להעלות קובץ PDF'); return }
    setDistilling(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/clients/${id}/positioning`, { method: 'POST', body: form })
      if (res.ok) {
        const data = await res.json()
        setClient(prev => prev ? { ...prev, positioning: data.positioning, positioning_pdf_path: data.positioning_pdf_path } : prev)
        showToast('מסמך המיצוב נותח בהצלחה', 'success')
      } else {
        const data = await res.json().catch(() => null)
        showToast(data?.error || 'שגיאה בניתוח המסמך')
      }
    } catch {
      showToast('שגיאה בניתוח המסמך')
    } finally {
      setDistilling(false)
    }
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    try {
      const form = new FormData()
      form.append('name', client.name)
      form.append('brand_color', client.brand_color || '#40e1d3')
      form.append('notes', client.notes || '')
      form.append('positioning', client.positioning || '')
      form.append('contacts', JSON.stringify(client.contacts || []))
      if (logoFile) form.append('logo', logoFile)
      const res = await fetch(`/api/clients/${id}`, { method: 'PUT', body: form })
      if (res.ok) {
        setLogoFile(null)
        setLogoPreview(null)
        setDirty(false)
        await load()
      } else {
        const data = await res.json().catch(() => null)
        showToast(data?.error || 'שגיאה בשמירת הלקוח')
      }
    } catch {
      showToast('שגיאה בשמירת הלקוח')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
  if (!client) return <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>לקוח לא נמצא</p>

  const displayLogo = logoPreview || client.logo_url

  return (
    <div className="max-w-3xl">
      <Link href="/admin/clients" className="inline-flex items-center gap-1.5 text-sm font-medium mb-4" style={{ color: 'var(--admin-text-muted)' }}>
        <ArrowRight className="w-4 h-4" /> חזרה ללקוחות
      </Link>

      {/* Branding header */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
        <div className="flex items-start gap-4 flex-wrap">
          <label className="relative w-20 h-20 rounded-xl overflow-hidden cursor-pointer flex-shrink-0 flex items-center justify-center"
            style={{ background: client.brand_color || 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold" style={{ color: '#fff' }}>{client.name.charAt(0).toUpperCase()}</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Upload className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoSelect(e.target.files[0]) }} />
          </label>

          <div className="flex-1 min-w-[200px] space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>שם הלקוח</label>
              <input type="text" value={client.name} onChange={e => updateField('name', e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>צבע מותג</label>
              <div className="flex items-center gap-2">
                <input type="color" value={client.brand_color || '#40e1d3'} onChange={e => updateField('brand_color', e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer border-0" />
                <input type="text" value={client.brand_color || ''} onChange={e => updateField('brand_color', e.target.value)} dir="ltr"
                  className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }}>אנשי קשר</h3>
          <button onClick={addContact} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--admin-accent)' }}>
            <Plus className="w-3.5 h-3.5" /> הוסף
          </button>
        </div>
        {(client.contacts || []).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>אין אנשי קשר</p>
        ) : (
          <div className="space-y-2">
            {client.contacts.map((ct, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <input placeholder="שם" value={ct.name || ''} onChange={e => updateContact(i, { name: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
                <input placeholder="תפקיד" value={ct.role || ''} onChange={e => updateContact(i, { role: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
                <input placeholder="אימייל" dir="ltr" value={ct.email || ''} onChange={e => updateContact(i, { email: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
                <div className="flex items-center gap-1.5">
                  <input placeholder="טלפון" dir="ltr" value={ct.phone || ''} onChange={e => updateContact(i, { phone: e.target.value })} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle} />
                  <button onClick={() => removeContact(i)} className="p-2 rounded-lg" style={{ color: 'var(--admin-text-muted)' }} aria-label="הסר איש קשר"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Positioning document */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--admin-text-primary)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} /> מסמך מיצוב
          </h3>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)', opacity: distilling ? 0.5 : 1, pointerEvents: distilling ? 'none' : 'auto' }}>
            {distilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {distilling ? 'מנתח...' : client.positioning_pdf_path ? 'החלף PDF' : 'העלה PDF'}
            <input type="file" accept="application/pdf" className="hidden" disabled={distilling}
              onChange={e => { if (e.target.files?.[0]) handlePositioningUpload(e.target.files[0]); e.target.value = '' }} />
          </label>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--admin-text-muted)' }}>
          העלה את מסמך המיצוב (PDF) — ה-AI ינתח ויזקק את עיקרי המותג. הטקסט המזוקק משמש ליצירת טקסט אוטומטי בקמפיינים.
        </p>
        {client.positioning_pdf_path && !distilling && (
          <div className="inline-flex items-center gap-1.5 text-xs mb-3 px-2.5 py-1 rounded-md" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)' }}>
            <FileCheck2 className="w-3.5 h-3.5" style={{ color: 'var(--admin-accent)' }} /> מסמך מקור הועלה
          </div>
        )}
        <textarea
          value={client.positioning || ''}
          onChange={e => updateField('positioning', e.target.value)}
          rows={distilling ? 4 : 10}
          disabled={distilling}
          placeholder={distilling ? 'מנתח את המסמך...' : 'המיצוב המזוקק יופיע כאן לאחר העלאת PDF — ניתן גם לערוך ידנית.'}
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none leading-relaxed resize-y"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', direction: 'rtl' }}
        />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium mb-6 transition-opacity disabled:opacity-40"
        style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
        <Save className="w-4 h-4" /> {saving ? 'שומר...' : 'שמירת שינויים'}
      </button>

      {/* Linked work */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--admin-text-primary)' }}>
              <Megaphone className="w-4 h-4" /> קמפיינים ({campaigns.length})
            </h3>
            {campaigns.length > 0 && (
              <button
                onClick={handleDuplicateLatest}
                disabled={dupLoading}
                className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--admin-accent)' }}
                title="יוצר קמפיין חדש כהעתק של האחרון"
              >
                {dupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Files className="w-3.5 h-3.5" />}
                שכפל את האחרון
              </button>
            )}
          </div>
          {campaigns.length === 0 ? <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>אין קמפיינים</p> : (
            <div className="space-y-1">
              {campaigns.map(c => (
                <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="block text-sm py-1 truncate" style={{ color: 'var(--admin-text-secondary)' }}>{c.campaign_name}</Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--admin-text-primary)' }}>
            <FileText className="w-4 h-4" /> דפים ({pages.length})
          </h3>
          {pages.length === 0 ? <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>אין דפים</p> : (
            <div className="space-y-1">
              {pages.map(p => (
                <Link key={p.id} href={`/admin/pages/${p.id}`} className="block text-sm py-1 truncate" style={{ color: 'var(--admin-text-secondary)' }}>{p.title}</Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-bg)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
}
