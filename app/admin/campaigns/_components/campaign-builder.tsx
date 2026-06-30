'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight, Plus, Trash2, Upload, Link2, Eye, EyeOff, ExternalLink,
  Check, Copy, GripVertical, Image as ImageIcon, Film, LayoutTemplate,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ──

export interface Asset {
  id: string
  type: 'image' | 'video'
  file_path: string
  public_url: string
  url: string
  caption: string
}

export interface Section {
  id: string
  title: string
  mockup_type: string
  description: string
  assets: Asset[]
}

export interface BuilderInitial {
  campaignId?: string | null
  client?: string
  campaignName?: string
  concept?: string
  password?: string
  logoPath?: string | null
  logoUrl?: string | null
  slug?: string | null
  status?: 'draft' | 'published' | 'archived'
  sections?: Section[]
}

const MOCKUP_TYPES: Record<string, string> = {
  instagram_feed: 'פיד אינסטגרם',
  instagram_story: 'סטוריז אינסטגרם',
  facebook_feed: 'פיד פייסבוק',
  video: 'סרטונים',
  general: 'כללי',
  divider: 'חוצץ / שקף ביניים',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

function buildAssetUrl(filePath: string): string {
  if (!filePath) return ''
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/campaign-assets/${encoded}`
}

const inputStyle = {
  background: 'var(--admin-bg-elevated)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
} as const

// ── Resilient thumbnail (tries public_url, falls back to constructed URL) ──

function Thumb({ asset, className, style }: { asset: Asset; className?: string; style?: React.CSSProperties }) {
  const primary = asset.public_url || buildAssetUrl(asset.file_path)
  const fallback = buildAssetUrl(asset.file_path)
  const [src, setSrc] = useState(primary)
  const [failed, setFailed] = useState(false)

  if (failed && !src) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ImageIcon className="w-6 h-6" style={{ color: 'var(--admin-text-muted)' }} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={asset.caption || ''}
      className={className}
      style={style}
      onError={() => {
        if (src !== fallback && fallback) setSrc(fallback)
        else setFailed(true)
      }}
    />
  )
}

// ── Sortable wrapper for a slide ──

function SortableSlide({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  const handle = (
    <button
      type="button"
      ref={setNodeRef as never}
      {...attributes}
      {...listeners}
      className="p-2 rounded-lg cursor-grab active:cursor-grabbing touch-none"
      style={{ color: 'var(--admin-text-muted)' }}
      aria-label="גרור לשינוי סדר"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  )
}

// ── Sortable wrapper for an image asset ──

function SortableAsset({ id, children }: { id: string; children: (handleProps: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

export default function CampaignBuilder({ mode, initial }: { mode: 'new' | 'edit'; initial?: BuilderInitial }) {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(initial?.campaignId ?? null)
  const [client, setClient] = useState(initial?.client ?? '')
  const [campaignName, setCampaignName] = useState(initial?.campaignName ?? '')
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [logoPath, setLogoPath] = useState<string | null>(initial?.logoPath ?? null)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null)
  const [slug, setSlug] = useState<string | null>(initial?.slug ?? null)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(initial?.status ?? 'draft')
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? [])
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSections, setUploadingSections] = useState<Record<string, number>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Persistence ──

  async function ensureCampaignExists(): Promise<string | null> {
    if (campaignId) return campaignId
    if (!client.trim() || !campaignName.trim()) return null
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: client.trim(),
          campaign_name: campaignName.trim(),
          concept: concept.trim(),
          status: 'draft',
          sections: [],
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      setCampaignId(data.id)
      if (data.slug) setSlug(data.slug)
      return data.id
    } catch {
      return null
    }
  }

  function buildBody(newStatus: 'draft' | 'published') {
    return {
      client: client.trim(),
      campaign_name: campaignName.trim(),
      concept: concept.trim(),
      password: password.trim() || null,
      logo_path: logoPath,
      status: newStatus,
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        mockup_type: s.mockup_type,
        description: s.description,
        assets: s.assets.map(a => ({
          id: a.id,
          type: a.type,
          file_path: a.file_path,
          url: a.url,
          caption: a.caption,
        })),
      })),
    }
  }

  async function saveCampaign(newStatus: 'draft' | 'published', { redirect = true }: { redirect?: boolean } = {}) {
    if (!client.trim() || !campaignName.trim()) {
      setError('יש למלא שם לקוח ושם קמפיין')
      return null
    }
    setError('')
    setSaving(true)
    try {
      const method = campaignId ? 'PUT' : 'POST'
      const url = campaignId ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(newStatus)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')

      if (data.id) setCampaignId(data.id)
      if (data.slug) setSlug(data.slug)
      setStatus(newStatus)

      if (newStatus === 'published' && redirect) {
        router.push('/admin/campaigns')
      }
      return data
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
      return null
    } finally {
      setSaving(false)
    }
  }

  // ── Uploads ──

  async function handleLogoUpload(file: File) {
    const id = await ensureCampaignExists()
    if (!id) { setError('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים'); return }
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')
      const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setLogoPath(data.file_path)
        setLogoUrl(data.public_url)
      } else {
        setError('שגיאה בהעלאת הלוגו')
      }
    } catch {
      setError('שגיאה בהעלאת הלוגו')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleAssetUpload(sectionId: string, files: FileList) {
    const id = await ensureCampaignExists()
    if (!id) { setError('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים'); return }
    const fileArr = Array.from(files)
    setUploadingSections(prev => ({ ...prev, [sectionId]: fileArr.length }))

    let completed = 0
    for (const file of fileArr) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'image')
        formData.append('section_id', sectionId)
        const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          const newAsset: Asset = {
            id: crypto.randomUUID(),
            type: 'image',
            file_path: data.file_path,
            public_url: data.public_url || '',
            url: '',
            caption: '',
          }
          setSections(prev => prev.map(s => s.id === sectionId ? { ...s, assets: [...s.assets, newAsset] } : s))
        } else {
          setError(`שגיאה בהעלאת ${file.name}`)
        }
      } catch {
        setError(`שגיאה בהעלאת ${file.name}`)
      }
      completed++
      setUploadingSections(prev => ({ ...prev, [sectionId]: fileArr.length - completed }))
    }
    setUploadingSections(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
  }

  // ── Slide / asset mutations ──

  function addSection() {
    setSections(prev => [...prev, { id: crypto.randomUUID(), title: '', mockup_type: 'general', description: '', assets: [] }])
  }
  function removeSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id))
  }
  function updateSection(id: string, updates: Partial<Section>) {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }
  function removeAsset(sectionId: string, assetId: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, assets: s.assets.filter(a => a.id !== assetId) } : s))
  }
  function updateAssetCaption(sectionId: string, assetId: string, caption: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, assets: s.assets.map(a => a.id === assetId ? { ...a, caption } : a) } : s))
  }
  function addVideoLink(sectionId: string) {
    const newAsset: Asset = { id: crypto.randomUUID(), type: 'video', file_path: '', public_url: '', url: '', caption: '' }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, assets: [...s.assets, newAsset] } : s))
  }
  function updateVideoAsset(sectionId: string, assetId: string, updates: Partial<Asset>) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, assets: s.assets.map(a => a.id === assetId ? { ...a, ...updates } : a) } : s))
  }

  function handleSlideDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id)
      const newIndex = prev.findIndex(s => s.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function handleAssetDragEnd(sectionId: string, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const oldIndex = s.assets.findIndex(a => a.id === active.id)
      const newIndex = s.assets.findIndex(a => a.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return s
      return { ...s, assets: arrayMove(s.assets, oldIndex, newIndex) }
    }))
  }

  async function copyLink() {
    if (!slug) return
    const url = `${window.location.origin}/c/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function togglePreview() {
    if (!showPreview) {
      await saveCampaign('draft', { redirect: false })
      setPreviewKey(k => k + 1)
    }
    setShowPreview(p => !p)
  }

  const focusBorder = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--admin-accent)')
  const blurBorder = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--admin-border)')

  function slideTypeIcon(type: string) {
    if (type === 'video') return <Film className="w-3.5 h-3.5" />
    if (type === 'divider') return <LayoutTemplate className="w-3.5 h-3.5" />
    return <ImageIcon className="w-3.5 h-3.5" />
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-4 transition-colors"
          style={{ color: 'var(--admin-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--admin-accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--admin-text-muted)')}
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לקמפיינים
        </Link>
        <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text-primary)' }}>
          {mode === 'new' ? 'קמפיין חדש' : 'עריכת קמפיין'}
        </h2>
      </div>

      {/* Share link */}
      {slug && (
        <div
          className="rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>לינק לשיתוף:</span>
          <code className="text-xs px-2 py-1 rounded-lg flex-1 min-w-[200px] truncate" dir="ltr" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-secondary)' }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/c/{slug}
          </code>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: copied ? 'var(--admin-accent)' : 'var(--admin-text-secondary)' }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'הועתק' : 'העתק'}
          </button>
        </div>
      )}

      {/* Campaign Details */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
        <h3 className="text-lg font-black mb-5" style={{ color: 'var(--admin-text-primary)' }}>פרטי קמפיין</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>שם לקוח *</label>
            <input type="text" value={client} onChange={e => setClient(e.target.value)} placeholder="שם הלקוח"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>שם קמפיין *</label>
            <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="שם הקמפיין"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>קונספט הקמפיין</label>
          <textarea value={concept} onChange={e => setConcept(e.target.value)} placeholder="תיאור קצר של הקונספט..." rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>סיסמת הגנה (אופציונלי)</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="השאירו ריק לקמפיין ציבורי" dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
          <p className="text-xs mt-1.5" style={{ color: 'var(--admin-text-muted)' }}>אם תגדירו סיסמה, הלקוח יידרש להזין אותה לפני הצפייה בקמפיין</p>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--admin-text-secondary)' }}>לוגו לקוח</label>
          {uploadingLogo ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }} />
              <span className="text-sm" style={{ color: 'var(--admin-accent)' }}>מעלה לוגו...</span>
            </div>
          ) : logoPath ? (
            <div className="flex items-center gap-3">
              <Thumb asset={{ id: 'logo', type: 'image', file_path: logoPath, public_url: logoUrl || '', url: '', caption: '' }}
                className="w-16 h-16 rounded-lg object-contain" style={{ background: 'var(--admin-bg)' }} />
              <button onClick={() => { setLogoPath(null); setLogoUrl(null) }} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--admin-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
              <Upload className="w-4 h-4" />
              העלה לוגו
              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]) }} />
            </label>
          )}
        </div>
      </div>

      {/* Slides */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-black" style={{ color: 'var(--admin-text-primary)' }}>שקפי המצגת</h3>
          <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{sections.length} שקפים</span>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--admin-text-muted)' }}>
          גררו את השקפים כדי לשנות את סדר המצגת. בתוך כל שקף ניתן לגרור תמונות כדי לסדר אותן.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlideDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {sections.map((section, idx) => (
                <SortableSlide key={section.id} id={section.id}>
                  {(handle) => (
                    <div className="rounded-2xl p-5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
                      {/* Slide header */}
                      <div className="flex items-center gap-2 mb-4">
                        {handle}
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black shrink-0"
                          style={{ background: 'var(--admin-bg)', color: 'var(--admin-accent)', border: '1px solid var(--admin-border)' }}>
                          {idx + 1}
                        </span>
                        <input type="text" value={section.title} onChange={e => updateSection(section.id, { title: e.target.value })} placeholder="כותרת השקף"
                          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                        <select value={section.mockup_type} onChange={e => updateSection(section.id, { mockup_type: e.target.value })}
                          className="px-3 py-2.5 rounded-xl text-sm outline-none transition-colors cursor-pointer" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}>
                          {Object.entries(MOCKUP_TYPES).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                        <button onClick={() => removeSection(section.id)} className="p-2.5 rounded-lg transition-colors" style={{ color: 'var(--admin-text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Slide text — available for every slide type */}
                      <textarea
                        value={section.description || ''}
                        onChange={e => updateSection(section.id, { description: e.target.value })}
                        placeholder={section.mockup_type === 'divider' ? 'טקסט שיופיע על שקף הביניים...' : 'טקסט / הסבר שיופיע בשקף (אופציונלי)...'}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none mb-4"
                        style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
                      />

                      {/* Content by type */}
                      {section.mockup_type === 'divider' ? (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--admin-text-muted)' }}>
                          {slideTypeIcon(section.mockup_type)} שקף ביניים — מציג כותרת וטקסט בלבד, ללא תמונות
                        </p>
                      ) : section.mockup_type === 'video' ? (
                        <div className="space-y-3">
                          {section.assets.map(asset => (
                            <div key={asset.id} className="flex items-start gap-3">
                              <div className="flex-1 space-y-2">
                                <input type="url" value={asset.url} onChange={e => updateVideoAsset(section.id, asset.id, { url: e.target.value })}
                                  placeholder="קישור לסרטון (YouTube, Vimeo...)" dir="ltr"
                                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                                <input type="text" value={asset.caption} onChange={e => updateVideoAsset(section.id, asset.id, { caption: e.target.value })}
                                  placeholder="כיתוב" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                              </div>
                              <button onClick={() => removeAsset(section.id, asset.id)} className="p-2.5 rounded-lg transition-colors mt-1" style={{ color: 'var(--admin-text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-danger)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-text-muted)' }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button onClick={() => addVideoLink(section.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
                            style={{ color: 'var(--admin-accent)', border: '1px dashed var(--admin-border)' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}>
                            <Link2 className="w-4 h-4" /> הוסף לינק לסרטון
                          </button>
                        </div>
                      ) : (
                        <div>
                          {section.assets.length > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleAssetDragEnd(section.id, e)}>
                              <SortableContext items={section.assets.map(a => a.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                                  {section.assets.map((asset, aIdx) => (
                                    <SortableAsset key={asset.id} id={asset.id}>
                                      {(handleProps) => (
                                        <div className="relative group">
                                          <Thumb asset={asset} className="w-full h-[120px] object-cover rounded-lg" style={{ background: 'var(--admin-bg)' }} />
                                          <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded text-[10px] font-black"
                                            style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{aIdx + 1}</span>
                                          <button {...handleProps as Record<string, unknown>} type="button" aria-label="גרור תמונה"
                                            className="absolute bottom-1.5 right-1.5 p-1 rounded-lg cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => removeAsset(section.id, asset.id)}
                                            className="absolute top-1.5 left-1.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: 'rgba(0,0,0,0.7)', color: '#ef4444' }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                          <textarea value={asset.caption} onChange={e => updateAssetCaption(section.id, asset.id, e.target.value)} placeholder="כיתוב..." rows={2}
                                            className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg text-xs outline-none resize-none transition-colors" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                                        </div>
                                      )}
                                    </SortableAsset>
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}

                          {/* Upload zone */}
                          {uploadingSections[section.id] ? (
                            <div className="rounded-xl p-6 text-center" style={{ border: '2px dashed var(--admin-accent)', background: 'rgba(243,213,109,0.04)' }}>
                              <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }} />
                              <p className="text-sm font-bold" style={{ color: 'var(--admin-accent)' }}>מעלה {uploadingSections[section.id]} קבצים...</p>
                              <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>הקבצים עוברים דחיסה ואופטימיזציה</p>
                            </div>
                          ) : (
                            <label className="block rounded-xl p-6 text-center cursor-pointer transition-all duration-200"
                              style={{ border: '2px dashed var(--admin-border)', background: 'var(--admin-bg)' }}
                              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--admin-accent)'; e.currentTarget.style.background = 'rgba(243,213,109,0.04)' }}
                              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.background = 'var(--admin-bg)' }}
                              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.background = 'var(--admin-bg)'; if (e.dataTransfer.files.length) handleAssetUpload(section.id, e.dataTransfer.files) }}>
                              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--admin-text-muted)' }} />
                              <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>גררו קבצים לכאן או לחצו לבחירה</p>
                              <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) handleAssetUpload(section.id, e.target.files) }} />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SortableSlide>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button onClick={addSection} className="flex items-center gap-2 mt-4 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200"
          style={{ color: 'var(--admin-accent)', border: '1px dashed var(--admin-border)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--admin-accent)'; e.currentTarget.style.background = 'var(--admin-bg-elevated)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)'; e.currentTarget.style.background = 'transparent' }}>
          <Plus className="w-4 h-4" /> הוסף שקף
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: 'var(--admin-danger)' }}>{error}</p>}

      {/* Preview */}
      {campaignId && slug && (
        <div className="mb-6">
          <button onClick={togglePreview} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 w-full justify-center"
            style={{ background: showPreview ? 'rgba(64,225,211,0.08)' : 'var(--admin-bg-elevated)', border: `1px solid ${showPreview ? 'rgba(64,225,211,0.3)' : 'var(--admin-border)'}`, color: showPreview ? 'var(--admin-accent)' : 'var(--admin-text-primary)' }}>
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
          </button>

          {showPreview && (
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>תצוגה מקדימה – כך הלקוח יראה את הקמפיין</span>
                <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/${slug}?preview=1`} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 transition-colors" style={{ color: 'var(--admin-accent)' }}>
                  <ExternalLink className="w-3 h-3" /> פתח בחלון חדש
                </a>
              </div>
              <iframe key={previewKey} src={`/c/${slug}?preview=1`} className="w-full bg-[#0d1112]" style={{ height: '700px', border: 'none' }} />
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center flex-wrap gap-3 pt-4 pb-8" style={{ borderTop: '1px solid var(--admin-border)' }}>
        <button onClick={() => saveCampaign('draft', { redirect: false })} disabled={saving}
          className="px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--admin-accent)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--admin-border)')}>
          {saving ? 'שומר...' : 'שמור טיוטה'}
        </button>
        <button onClick={() => saveCampaign('published')} disabled={saving}
          className="px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
          {saving ? 'שומר...' : (status === 'published' ? 'עדכן ופרסם' : 'פרסום וקבלת לינק')}
        </button>
      </div>
    </div>
  )
}
