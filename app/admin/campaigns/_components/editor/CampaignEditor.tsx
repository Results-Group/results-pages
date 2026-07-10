'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowRight, Copy, Check, ExternalLink, Eye, EyeOff, Monitor, Smartphone,
  Undo2, Redo2, Save, Send, Loader2, CheckCircle2, MessageSquare, X,
} from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import { buildCampaignSlides } from '@/lib/slides'
import type { CampaignSection } from '@/lib/campaigns'
import { useCampaignDocument } from './useCampaignDocument'
import SlideFilmstrip from './SlideFilmstrip'
import SlideCanvas from './SlideCanvas'
import Inspector from './Inspector'
import type { CampaignDocument, EditorAsset } from './types'

const CampaignPresentation = dynamic(() => import('@/app/c/[slug]/presentation'), { ssr: false })

export interface EditorInitial {
  campaignId?: string | null
  doc: CampaignDocument
  slug?: string | null
  status?: 'draft' | 'published' | 'archived'
}

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' }

export default function CampaignEditor({ mode, initial }: { mode: 'new' | 'edit'; initial: EditorInitial }) {
  const router = useRouter()
  const { doc, canUndo, canRedo, setMeta, addSection, duplicateSection, removeSection, updateSection, moveSection, addAsset, updateAsset, removeAsset, moveAsset, undo, redo } = useCampaignDocument(initial.doc)

  const [campaignId, setCampaignId] = useState<string | null>(initial.campaignId ?? null)
  const [slug, setSlug] = useState<string | null>(initial.slug ?? null)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(initial.status ?? 'draft')
  const [activeId, setActiveId] = useState<string | null>(initial.doc.sections[0]?.id ?? null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadCounts, setUploadCounts] = useState<Record<string, number>>({})
  const [passwordDirty, setPasswordDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [feedback, setFeedback] = useState<Record<string, { status: 'approved' | 'rejected' | 'pending'; comment: string | null; author: string | null }>>({})
  const [showApprovals, setShowApprovals] = useState(false)

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const activeSection = doc.sections.find(s => s.id === activeId) || null
  const clientLogoUrl = doc.meta.logoPath ? assetProxyUrl(doc.meta.logoPath) : null

  // Load client approval feedback (edit mode only)
  useEffect(() => {
    if (!campaignId) return
    fetch(`/api/campaigns/${campaignId}/feedback`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: { slide_key: string; status: 'approved' | 'rejected' | 'pending'; comment: string | null; author: string | null }[]) => {
        const map: typeof feedback = {}
        for (const r of rows) map[r.slide_key] = { status: r.status, comment: r.comment, author: r.author }
        setFeedback(map)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const feedbackStatusMap = useMemo(() => {
    const m: Record<string, 'approved' | 'rejected' | 'pending'> = {}
    for (const [k, v] of Object.entries(feedback)) m[k] = v.status
    return m
  }, [feedback])

  // Count only feedback for sections that still exist (matches the approvals modal list)
  const feedbackCount = doc.sections.filter(s => feedback[s.id]).length
  const approvedCount = doc.sections.filter(s => feedback[s.id]?.status === 'approved').length

  // Keep an active slide selected as sections change
  useEffect(() => {
    if (!activeId && doc.sections.length > 0) setActiveId(doc.sections[0].id)
    if (activeId && !doc.sections.some(s => s.id === activeId)) {
      setActiveId(doc.sections[0]?.id ?? null)
    }
  }, [doc.sections, activeId])

  // ── Persistence ──

  const docRef = useRef(doc)
  useEffect(() => { docRef.current = doc })

  const buildBody = useCallback((newStatus?: 'draft' | 'published' | 'archived') => ({
    client: doc.meta.client.trim(),
    client_id: doc.meta.clientId,
    campaign_name: doc.meta.campaignName.trim(),
    concept: doc.meta.concept.trim(),
    // Only send the password when the user actually edited it — omitting the
    // key means "untouched" server-side (null would clear the stored hash).
    ...(passwordDirty ? { password: doc.meta.password.trim() || null } : {}),
    logo_path: doc.meta.logoPath,
    publish_at: doc.meta.publishAt ? new Date(doc.meta.publishAt).toISOString() : null,
    status: newStatus ?? status,
    workspace_id: doc.meta.workspaceId,
    sections: doc.sections.map(s => ({
      id: s.id,
      title: s.title,
      mockup_type: s.mockup_type,
      description: s.description,
      assets: s.assets.map(a => ({ id: a.id, type: a.type, file_path: a.file_path, url: a.url, caption: a.caption })),
    })),
  }), [doc, status, passwordDirty])

  // Sync server-resolved fields (slug, client_id) back into local state.
  // clientId is compared against the latest doc before dispatch so an
  // identical value doesn't dirty the document and re-trigger the autosave.
  const syncFromServer = useCallback((data: { slug?: string | null; client_id?: string | null }) => {
    if (data.slug) setSlug(data.slug)
    const serverClientId = data.client_id ?? null
    if (serverClientId && serverClientId !== docRef.current.meta.clientId) {
      setMeta({ clientId: serverClientId })
    }
  }, [setMeta])

  // Single in-flight create promise so concurrent callers (uploads + Cmd+S)
  // never create the campaign twice.
  const createPromise = useRef<Promise<{ id: string; slug?: string | null; client_id?: string | null } | null> | null>(null)

  const ensureCampaignExists = useCallback(async (): Promise<string | null> => {
    if (campaignId) return campaignId
    if (!doc.meta.client.trim() || !doc.meta.campaignName.trim()) return null
    if (!createPromise.current) {
      createPromise.current = (async () => {
        try {
          const res = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: doc.meta.client.trim(),
              client_id: doc.meta.clientId,
              campaign_name: doc.meta.campaignName.trim(),
              concept: doc.meta.concept.trim(),
              status: 'draft',
              workspace_id: doc.meta.workspaceId,
              sections: [],
            }),
          })
          if (!res.ok) return null
          const data = await res.json()
          setCampaignId(data.id)
          syncFromServer(data)
          return data
        } catch {
          return null
        }
      })()
    }
    const data = await createPromise.current
    if (!data) createPromise.current = null // allow retry after a failed create
    return data?.id ?? null
  }, [campaignId, doc.meta, syncFromServer])

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Serialize saves so a slow/stale request can never land after a newer one
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())

  const save = useCallback(async (newStatus?: 'draft' | 'published', opts: { redirect?: boolean; silent?: boolean } = {}) => {
    // A manual save/publish supersedes any pending autosave
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }
    if (!doc.meta.client.trim() || !doc.meta.campaignName.trim()) {
      if (!opts.silent) toast('יש למלא שם לקוח ושם קמפיין', 'error')
      return null
    }
    const run = async () => {
      setSaveState('saving')
      try {
        let id = campaignId
        if (!id) {
          id = await ensureCampaignExists()
          if (!id) throw new Error('שגיאה בשמירה')
        }
        const res = await fetch(`/api/campaigns/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody(newStatus)),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')
        if (data.id) setCampaignId(data.id)
        syncFromServer(data)
        if (newStatus) setStatus(newStatus)
        setSaveState('saved')
        if (!opts.silent) toast(newStatus === 'published' ? 'הקמפיין פורסם' : 'נשמר בהצלחה', 'success')
        if (newStatus === 'published' && opts.redirect) router.push('/admin/campaigns')
        return data
      } catch (err) {
        setSaveState('error')
        if (!opts.silent) toast(err instanceof Error ? err.message : 'שגיאה בשמירה', 'error')
        return null
      }
    }
    const result = saveQueue.current.then(run, run)
    saveQueue.current = result
    return result
  }, [doc.meta, campaignId, buildBody, ensureCampaignExists, syncFromServer, router, toast])

  // Latest save in a ref so the debounced autosave never fires a stale closure
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })

  // ── Debounced autosave (only after the campaign exists) ──
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (!campaignId) return
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null
      saveRef.current(undefined, { silent: true })
    }, 1500)
    return () => {
      if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  // ── Uploads ──

  const bumpUpload = useCallback((sectionId: string, delta: number) => {
    setUploadCounts(m => ({ ...m, [sectionId]: Math.max(0, (m[sectionId] || 0) + delta) }))
  }, [])

  // Best-effort storage cleanup when an asset is removed/replaced — never blocks the UI
  const deleteStoredAsset = useCallback((cid: string, filePath?: string | null) => {
    if (!cid || !filePath) return
    try {
      fetch(`/api/campaigns/${cid}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      }).catch(() => {})
    } catch { /* best-effort */ }
  }, [])

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!activeSection) return
    const sectionId = activeSection.id
    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים', 'error'); return }
    const arr = Array.from(files)
    bumpUpload(sectionId, arr.length)
    for (const file of arr) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', 'image')
        const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          const asset: EditorAsset = { id: crypto.randomUUID(), type: 'image', file_path: data.file_path, public_url: data.public_url || '', url: '', caption: '' }
          addAsset(sectionId, asset)
        } else {
          toast(`שגיאה בהעלאת ${file.name}`, 'error')
        }
      } catch {
        toast(`שגיאה בהעלאת ${file.name}`, 'error')
      } finally {
        bumpUpload(sectionId, -1)
      }
    }
  }, [activeSection, ensureCampaignExists, addAsset, bumpUpload, toast])

  const replaceAsset = useCallback(async (assetId: string, file: File) => {
    if (!activeSection) return
    const sectionId = activeSection.id
    const oldPath = activeSection.assets.find(a => a.id === assetId)?.file_path || ''
    const id = await ensureCampaignExists()
    if (!id) return
    bumpUpload(sectionId, 1)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'image')
      const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        updateAsset(sectionId, assetId, { file_path: data.file_path, public_url: data.public_url || '' })
        if (oldPath && oldPath !== data.file_path) deleteStoredAsset(id, oldPath)
      } else toast('שגיאה בהחלפת התמונה', 'error')
    } catch {
      toast('שגיאה בהחלפת התמונה', 'error')
    } finally {
      bumpUpload(sectionId, -1)
    }
  }, [activeSection, ensureCampaignExists, updateAsset, bumpUpload, deleteStoredAsset, toast])

  const handleRemoveAsset = useCallback((assetId: string) => {
    if (!activeSection) return
    const asset = activeSection.assets.find(a => a.id === assetId)
    removeAsset(activeSection.id, assetId)
    if (campaignId && asset?.file_path) deleteStoredAsset(campaignId, asset.file_path)
  }, [activeSection, removeAsset, campaignId, deleteStoredAsset])

  const uploadLogo = useCallback(async (file: File) => {
    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני העלאת לוגו', 'error'); return }
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'logo')
      const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setMeta({ logoPath: data.file_path, logoUrl: data.public_url })
      } else toast('שגיאה בהעלאת הלוגו', 'error')
    } finally {
      setUploadingLogo(false)
    }
  }, [ensureCampaignExists, setMeta, toast])

  const addVideo = useCallback(() => {
    if (!activeSection) return
    addAsset(activeSection.id, { id: crypto.randomUUID(), type: 'video', file_path: '', public_url: '', url: '', caption: '' })
  }, [activeSection, addAsset])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      // Don't hijack undo/redo while typing — let the field handle its own history
      const target = e.target as HTMLElement | null
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (mod && e.key.toLowerCase() === 'z') {
        if (isEditable) return
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save(undefined)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save])

  async function copyLink() {
    if (!slug) return
    await navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Full-deck preview slides ──
  const previewSlides = useMemo(() => buildCampaignSlides({
    client: doc.meta.client || 'שם לקוח',
    campaignName: doc.meta.campaignName || 'שם קמפיין',
    concept: doc.meta.concept || null,
    clientLogoUrl,
    date: new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' }),
    sections: doc.sections.map(s => ({
      ...s,
      mockup_type: s.mockup_type,
      assets: s.assets.map(a => ({ ...a })),
    })) as unknown as CampaignSection[],
  }), [doc, clientLogoUrl])

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)] -m-4 sm:-m-5 lg:-m-7">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap shrink-0" style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-bg-elevated)' }}>
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--admin-text-muted)' }}>
          <ArrowRight className="w-4 h-4" /> חזרה
        </Link>

        <div className="h-5 w-px mx-1" style={{ background: 'var(--admin-border)' }} />

        <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg disabled:opacity-30" style={{ color: 'var(--admin-text-secondary)' }} title="בטל (Cmd+Z)">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg disabled:opacity-30" style={{ color: 'var(--admin-text-secondary)' }} title="בצע שוב (Cmd+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px mx-1" style={{ background: 'var(--admin-border)' }} />

        {/* Device toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--admin-bg)' }}>
          <button onClick={() => setDevice('desktop')} className="p-1.5 rounded-md" style={device === 'desktop' ? { background: 'var(--admin-bg-elevated)', color: 'var(--admin-accent)' } : { color: 'var(--admin-text-muted)' }} title="דסקטופ">
            <Monitor className="w-4 h-4" />
          </button>
          <button onClick={() => setDevice('mobile')} className="p-1.5 rounded-md" style={device === 'mobile' ? { background: 'var(--admin-bg-elevated)', color: 'var(--admin-accent)' } : { color: 'var(--admin-text-muted)' }} title="מובייל">
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => setShowFullPreview(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: showFullPreview ? 'var(--admin-accent)' : 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)' }}>
          {showFullPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          תצוגת מצגת מלאה
        </button>

        {feedbackCount > 0 && (
          <button onClick={() => setShowApprovals(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
            <MessageSquare className="w-3.5 h-3.5" /> אישורים {approvedCount}/{feedbackCount}
          </button>
        )}

        <div className="flex-1" />

        {/* Save state */}
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          {saveState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> שומר...</>}
          {saveState === 'saved' && <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--admin-accent)' }} /> נשמר</>}
          {saveState === 'error' && <span style={{ color: 'var(--admin-danger)' }}>שגיאת שמירה</span>}
        </span>

        {slug && (
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: copied ? 'var(--admin-accent)' : 'var(--admin-text-secondary)' }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'הועתק' : 'העתק לינק'}
          </button>
        )}
        {slug && (
          <a href={`/c/${slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg" style={{ color: 'var(--admin-text-secondary)' }} title="פתח בטאב חדש">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <button onClick={() => save('draft')} disabled={saveState === 'saving'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
          <Save className="w-3.5 h-3.5" /> טיוטה
        </button>
        <button onClick={() => save('published', { redirect: true })} disabled={saveState === 'saving'} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
          <Send className="w-3.5 h-3.5" /> {status === 'published' ? 'עדכן ופרסם' : 'פרסום'}
        </button>
      </div>

      {/* Body: filmstrip | canvas | inspector */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 overflow-y-auto p-3 hidden md:block" style={{ borderLeft: '1px solid var(--admin-border)', background: 'var(--admin-bg)' }}>
          <SlideFilmstrip
            sections={doc.sections}
            activeId={activeId}
            feedback={feedbackStatusMap}
            onSelect={setActiveId}
            onAdd={() => { addSection(); }}
            onDuplicate={duplicateSection}
            onRemove={removeSection}
            onMove={moveSection}
          />
        </aside>

        <main className="flex-1 min-w-0 relative">
          {showFullPreview ? (
            <div className="h-full overflow-auto" style={{ background: '#090c0e' }}>
              <CampaignPresentation slides={previewSlides} clientName={doc.meta.client || 'שם לקוח'} campaignName={doc.meta.campaignName || 'שם קמפיין'} />
            </div>
          ) : (
            <SlideCanvas
              section={activeSection}
              clientName={doc.meta.client}
              clientLogoUrl={clientLogoUrl}
              device={device}
              uploading={activeSection ? (uploadCounts[activeSection.id] ?? 0) : 0}
              onUpdateSection={patch => activeSection && updateSection(activeSection.id, patch)}
              onUpdateAsset={(assetId, patch) => activeSection && updateAsset(activeSection.id, assetId, patch)}
              onRemoveAsset={handleRemoveAsset}
              onMoveAsset={(from, to) => activeSection && moveAsset(activeSection.id, from, to)}
              onUploadFiles={uploadFiles}
              onReplaceAsset={replaceAsset}
              onAddVideo={addVideo}
            />
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto p-4 hidden lg:block" style={{ borderRight: '1px solid var(--admin-border)', background: 'var(--admin-bg-elevated)' }}>
          <Inspector
            section={activeSection}
            meta={doc.meta}
            onUpdateSection={patch => activeSection && updateSection(activeSection.id, patch)}
            onUpdateMeta={setMeta}
            onUploadLogo={uploadLogo}
            uploadingLogo={uploadingLogo}
            passwordDirty={passwordDirty}
            onPasswordDirty={setPasswordDirty}
          />
        </aside>
      </div>

      {/* Approvals panel */}
      {showApprovals && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowApprovals(false)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl p-5" style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>אישורי לקוח ({approvedCount}/{feedbackCount})</h3>
              <button onClick={() => setShowApprovals(false)} style={{ color: 'var(--admin-text-muted)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {doc.sections.filter(s => feedback[s.id]).map(s => {
                const fb = feedback[s.id]
                const color = fb.status === 'approved' ? '#2EC4B6' : fb.status === 'rejected' ? '#ef4444' : '#94a3b8'
                const label = fb.status === 'approved' ? 'אושר' : fb.status === 'rejected' ? 'נדרש שינוי' : 'ממתין'
                return (
                  <div key={s.id} className="rounded-lg p-3" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--admin-text-primary)' }}>{s.title || 'שקף ללא כותרת'}</span>
                      <span className="text-xs font-medium" style={{ color }}>{label}</span>
                    </div>
                    {fb.comment && <p className="text-xs mt-1" style={{ color: 'var(--admin-text-secondary)' }}>{fb.comment}</p>}
                    {fb.author && <p className="text-[11px] mt-1" style={{ color: 'var(--admin-text-muted)' }}>— {fb.author}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map(t => (
          <div key={t.id} className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
            style={{
              background: t.kind === 'error' ? 'var(--admin-danger)' : t.kind === 'success' ? 'var(--admin-accent)' : 'var(--admin-bg-elevated)',
              color: t.kind === 'info' ? 'var(--admin-text-primary)' : '#fff',
              border: t.kind === 'info' ? '1px solid var(--admin-border)' : 'none',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
