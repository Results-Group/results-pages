'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowRight, Copy, Check, ExternalLink, Eye, EyeOff, Monitor, Smartphone,
  Undo2, Redo2, Save, Send, Loader2, CheckCircle2, MessageSquare, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import { compressImageClient, isImageFile, MAX_FILE_BYTES } from '@/lib/image-compress'
import { buildCampaignSlides } from '@/lib/slides'
import type { CampaignSection } from '@/lib/campaigns'
import { useCampaignDocument } from './useCampaignDocument'
import SlideFilmstrip from './SlideFilmstrip'
import SlideCanvas from './SlideCanvas'
import Inspector from './Inspector'
import SmartUploadModal from './SmartUploadModal'
import type { CampaignDocument, EditorAsset, EditorSection, MockupType } from './types'

const CampaignPresentation = dynamic(() => import('@/app/c/[slug]/presentation'), { ssr: false })

/** Minimum campaign lifetime before it auto-archives. */
const MIN_CAMPAIGN_MS = 28 * 24 * 60 * 60 * 1000 // 4 weeks

/** Date → local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface EditorInitial {
  campaignId?: string | null
  doc: CampaignDocument
  slug?: string | null
  status?: 'draft' | 'published' | 'archived'
  updatedAt?: string | null
}

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' }

export default function CampaignEditor({ mode, initial }: { mode: 'new' | 'edit'; initial: EditorInitial }) {
  const router = useRouter()
  const { doc, canUndo, canRedo, setMeta, addSection, addSections, duplicateSection, removeSection, updateSection, moveSection, addAsset, updateAsset, removeAsset, moveAsset, undo, redo } = useCampaignDocument(initial.doc)

  const [campaignId, setCampaignId] = useState<string | null>(initial.campaignId ?? null)
  const [slug, setSlug] = useState<string | null>(initial.slug ?? null)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(initial.status ?? 'draft')
  const [activeId, setActiveId] = useState<string | null>(initial.doc.sections[0]?.id ?? null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  // Per-section upload tracking: { sectionId: { total, done, failed } }
  const [uploadProgress, setUploadProgress] = useState<Record<string, { total: number; done: number; failed: number }>>({})
  // Derived scalar for SlideCanvas (total still in flight)
  const uploadCounts = Object.fromEntries(
    Object.entries(uploadProgress).map(([k, v]) => [k, Math.max(0, v.total - v.done - v.failed)])
  )
  const [passwordDirty, setPasswordDirty] = useState(false)
  const [activeCopyIdx, setActiveCopyIdx] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [conflict, setConflict] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [feedback, setFeedback] = useState<Record<string, { status: 'approved' | 'rejected' | 'pending'; comment: string | null; author: string | null }>>({})
  const [showApprovals, setShowApprovals] = useState(false)
  const [smartOpen, setSmartOpen] = useState(false)

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

  // Last server-known updated_at, for optimistic-concurrency conflict detection
  const updatedAtRef = useRef<string | null>(initial.updatedAt ?? null)
  const conflictRef = useRef(false)

  const buildBody = useCallback((newStatus?: 'draft' | 'published' | 'archived') => ({
    client: doc.meta.client.trim(),
    client_id: doc.meta.clientId,
    campaign_name: doc.meta.campaignName.trim(),
    concept: doc.meta.concept.trim(),
    copies: doc.meta.copies,
    // Only send the password when the user actually edited it — omitting the
    // key means "untouched" server-side (null would clear the stored hash).
    ...(passwordDirty ? { password: doc.meta.password.trim() || null } : {}),
    logo_path: doc.meta.logoPath,
    publish_at: doc.meta.publishAt ? new Date(doc.meta.publishAt).toISOString() : null,
    expires_at: doc.meta.expiresAt ? new Date(doc.meta.expiresAt).toISOString() : null,
    status: newStatus ?? status,
    workspace_id: doc.meta.workspaceId,
    base_updated_at: updatedAtRef.current ?? undefined,
    sections: doc.sections.map(s => ({
      id: s.id,
      title: s.title,
      mockup_type: s.mockup_type,
      description: s.description,
      useCopies: s.useCopies ?? false,
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
    // Stop writing once a conflict is detected — the user must reload first
    if (conflictRef.current) {
      if (!opts.silent) toast('הקמפיין עודכן במקום אחר. רעננו את הדף לפני שמירה.', 'error')
      return null
    }
    // A manual save/publish supersedes any pending autosave
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null }
    if (!doc.meta.client.trim() || !doc.meta.campaignName.trim()) {
      if (!opts.silent) toast('יש למלא שם לקוח ושם קמפיין', 'error')
      return null
    }
    // Publishing requires an end date at least 4 weeks out; the campaign
    // auto-archives once it passes. Auto-fill a valid default and block so the
    // user reviews it, rather than publishing with no end date.
    if (newStatus === 'published') {
      const base = doc.meta.publishAt ? new Date(doc.meta.publishAt).getTime() : Date.now()
      const minExpiry = base + MIN_CAMPAIGN_MS
      const exp = doc.meta.expiresAt ? new Date(doc.meta.expiresAt).getTime() : NaN
      if (!doc.meta.expiresAt || Number.isNaN(exp) || exp < minExpiry) {
        setMeta({ expiresAt: toDatetimeLocal(minExpiry) })
        toast('חובה תאריך סיום של לפחות 4 שבועות (הקמפיין יעבור לארכיון אחריו). קבענו ברירת מחדל — בדקו ולחצו פרסום שוב.', 'error')
        return null
      }
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
        if (res.status === 409) {
          // Another tab/editor saved since we loaded — stop autosaving so we
          // don't clobber their changes, and tell the user to reload.
          conflictRef.current = true
          setConflict(true)
          setSaveState('error')
          toast(data.error || 'הקמפיין עודכן במקום אחר. רעננו את הדף.', 'error')
          return null
        }
        if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')
        if (data.id) setCampaignId(data.id)
        if (data.updated_at) updatedAtRef.current = data.updated_at
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
    if (conflictRef.current) return
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

  const initProgress = useCallback((sectionId: string, count: number) => {
    setUploadProgress(m => ({
      ...m,
      [sectionId]: { total: (m[sectionId]?.total ?? 0) + count, done: m[sectionId]?.done ?? 0, failed: m[sectionId]?.failed ?? 0 },
    }))
  }, [])

  const tickProgress = useCallback((sectionId: string, outcome: 'done' | 'failed') => {
    setUploadProgress(m => {
      const prev = m[sectionId] ?? { total: 0, done: 0, failed: 0 }
      const next = { ...prev, [outcome]: prev[outcome] + 1 }
      // Clear entry once all files are settled
      if (next.done + next.failed >= next.total) {
        const { [sectionId]: _removed, ...rest } = m
        return rest
      }
      return { ...m, [sectionId]: next }
    })
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

  /** Upload a single file (with client-side compression). Returns the server response or null on failure. */
  const uploadOneFile = useCallback(async (file: File, campaignId: string): Promise<{ file_path: string; public_url: string } | null> => {
    let uploadBlob: Blob = file
    let uploadName = file.name

    try {
      const compressed = await compressImageClient(file)
      uploadBlob = compressed.blob
      uploadName = compressed.filename
    } catch {
      // If canvas compression fails (unlikely), fall back to raw file
    }

    const uploadFile = new File([uploadBlob], uploadName, { type: uploadBlob.type || 'image/jpeg' })
    const fd = new FormData()
    fd.append('file', uploadFile)
    fd.append('type', 'image')

    const res = await fetch(`/api/campaigns/${campaignId}/assets`, { method: 'POST', body: fd })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `HTTP ${res.status}`)
    }
    return await res.json()
  }, [])

  const MAX_ASSETS_PER_SLIDE = 4

  /** Smart bulk upload: drop N files → auto-split into slides of 4, all with the chosen mockup type. */
  const smartUpload = useCallback(async (files: File[], mockupType: MockupType) => {
    const valid = files.filter(f => isImageFile(f) && f.size <= MAX_FILE_BYTES)
    if (!valid.length) { toast('לא נבחרו קבצים תקינים', 'error'); return }

    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים', 'error'); return }

    // Split into groups of MAX_ASSETS_PER_SLIDE and create one section per group
    const groups: File[][] = []
    for (let i = 0; i < valid.length; i += MAX_ASSETS_PER_SLIDE) groups.push(valid.slice(i, i + MAX_ASSETS_PER_SLIDE))
    const sections: EditorSection[] = groups.map(() => ({
      id: crypto.randomUUID(), title: '', mockup_type: mockupType, description: '', useCopies: false, assets: [],
    }))
    addSections(sections)
    setActiveId(sections[0].id)

    // Upload each group's files into its section (parallel across all files)
    await Promise.all(groups.map(async (group, gi) => {
      const sectionId = sections[gi].id
      initProgress(sectionId, group.length)
      await Promise.allSettled(group.map(async file => {
        try {
          const data = await uploadOneFile(file, id)
          if (!data) throw new Error('empty response')
          addAsset(sectionId, { id: crypto.randomUUID(), type: 'image', file_path: data.file_path, public_url: data.public_url || '', url: '', caption: '' })
          tickProgress(sectionId, 'done')
        } catch (err) {
          tickProgress(sectionId, 'failed')
          const msg = err instanceof Error ? err.message : ''
          toast(`שגיאה בהעלאת ${file.name}${msg ? ` — ${msg}` : ''}`, 'error')
        }
      }))
    }))
    toast(`נוצרו ${sections.length} שקפים מ-${valid.length} קבצים`, 'success')
  }, [ensureCampaignExists, addSections, initProgress, tickProgress, uploadOneFile, addAsset, toast])

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!activeSection) return
    const sectionId = activeSection.id

    // Client-side validation
    const arr = Array.from(files)
    const valid: File[] = []
    for (const f of arr) {
      if (!isImageFile(f)) { toast(`${f.name} — סוג קובץ לא נתמך`, 'error'); continue }
      if (f.size > MAX_FILE_BYTES) { toast(`${f.name} — הקובץ גדול מדי`, 'error'); continue }
      valid.push(f)
    }
    if (!valid.length) return

    // More than one slide's worth in a single drop → auto-route to smart upload,
    // which splits them into slides of 4 (keeps the current slide's mockup type)
    // instead of hitting the 4-per-slide wall.
    if (valid.length > MAX_ASSETS_PER_SLIDE) {
      toast(`התקבלו ${valid.length} תמונות — עוברים להעלאה חכמה (${MAX_ASSETS_PER_SLIDE} לשקף)`, 'info')
      await smartUpload(valid, activeSection.mockup_type)
      return
    }

    // 4-image limit
    const existing = activeSection.assets.length
    const available = Math.max(0, MAX_ASSETS_PER_SLIDE - existing)
    if (available === 0) { toast('הגעת למגבלת 4 תמונות לשקף. הוסף שקף חדש כדי להמשיך.', 'error'); return }
    const limited = valid.slice(0, available)
    if (valid.length > available) {
      toast(`ניתן להוסיף רק ${available} תמונה נוספת לשקף זה (מגבלה: ${MAX_ASSETS_PER_SLIDE}).`, 'error')
    }

    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים', 'error'); return }

    initProgress(sectionId, limited.length)

    // Upload all files in parallel
    await Promise.allSettled(
      limited.map(async file => {
        try {
          const data = await uploadOneFile(file, id)
          if (data) {
            addAsset(sectionId, { id: crypto.randomUUID(), type: 'image', file_path: data.file_path, public_url: data.public_url || '', url: '', caption: '' })
          } else {
            throw new Error('empty response')
          }
          tickProgress(sectionId, 'done')
        } catch (err) {
          tickProgress(sectionId, 'failed')
          const msg = err instanceof Error ? err.message : ''
          toast(`שגיאה בהעלאת ${file.name}${msg ? ` — ${msg}` : ''}`, 'error')
        }
      })
    )
  }, [activeSection, ensureCampaignExists, addAsset, initProgress, tickProgress, uploadOneFile, toast, smartUpload])

  /** Generate AI copy suggestions for a slide, grounded in the client's positioning. */
  const generateCopy = useCallback(async (section: EditorSection): Promise<{ captions: string[]; titles: string[]; grounded: boolean } | null> => {
    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני יצירת קופי', 'error'); return null }
    try {
      const res = await fetch(`/api/campaigns/${id}/generate-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideTitle: section.title, slideDescription: section.description, mockupType: section.mockup_type }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || `HTTP ${res.status}`) }
      const data = await res.json()
      if (!data.grounded) toast('ללקוח אין מסמך מיצוב — הקופי נוצר ללא ביסוס. הוסף PDF מיצוב בעמוד הלקוח.', 'info')
      return { captions: Array.isArray(data.captions) ? data.captions : [], titles: Array.isArray(data.titles) ? data.titles : [], grounded: !!data.grounded }
    } catch (err) {
      toast(`שגיאה ביצירת קופי${err instanceof Error && err.message ? ` — ${err.message}` : ''}`, 'error')
      return null
    }
  }, [ensureCampaignExists, toast])

  /** Copy the active slide's title + description onto every other slide. */
  const applyContentToAll = useCallback(() => {
    if (!activeSection) return
    const others = doc.sections.filter(s => s.id !== activeSection.id)
    if (!others.length) { toast('אין שקפים נוספים להחיל עליהם', 'info'); return }
    if (!window.confirm(`להחיל את הכותרת והתיאור של השקף הזה על עוד ${others.length} שקפים? התוכן הקיים בהם יוחלף.`)) return
    const { title, description } = activeSection
    for (const s of others) updateSection(s.id, { title, description })
    toast(`הוחל על ${others.length} שקפים`, 'success')
  }, [activeSection, doc.sections, updateSection, toast])

  const replaceAsset = useCallback(async (assetId: string, file: File) => {
    if (!activeSection) return
    const sectionId = activeSection.id
    const oldPath = activeSection.assets.find(a => a.id === assetId)?.file_path || ''
    const id = await ensureCampaignExists()
    if (!id) { toast('יש למלא שם לקוח ושם קמפיין לפני העלאת קבצים', 'error'); return }
    initProgress(sectionId, 1)
    try {
      const data = await uploadOneFile(file, id)
      if (data) {
        updateAsset(sectionId, assetId, { file_path: data.file_path, public_url: data.public_url || '' })
        if (oldPath && oldPath !== data.file_path) deleteStoredAsset(id, oldPath)
      } else {
        throw new Error('empty response')
      }
      tickProgress(sectionId, 'done')
    } catch {
      tickProgress(sectionId, 'failed')
      toast('שגיאה בהחלפת התמונה', 'error')
    }
  }, [activeSection, ensureCampaignExists, updateAsset, initProgress, tickProgress, uploadOneFile, deleteStoredAsset, toast])

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
      let uploadBlob: Blob = file
      let uploadName = file.name
      try {
        const compressed = await compressImageClient(file)
        uploadBlob = compressed.blob
        uploadName = compressed.filename
      } catch { /* fallback to raw */ }
      const uploadFile = new File([uploadBlob], uploadName, { type: uploadBlob.type || 'image/jpeg' })
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('type', 'logo')
      const res = await fetch(`/api/campaigns/${id}/assets`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setMeta({ logoPath: data.file_path, logoUrl: data.public_url })
      } else {
        const body = await res.json().catch(() => ({}))
        toast(body?.error || 'שגיאה בהעלאת הלוגו', 'error')
      }
    } catch {
      toast('שגיאה בהעלאת הלוגו', 'error')
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
    copies: doc.meta.copies,
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
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#40e1d3' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          <ArrowRight className="w-4 h-4" /> חזרה
        </Link>

        <div className="h-5 w-px mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />

        <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg disabled:opacity-20 transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#40e1d3' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          title="בטל (Cmd+Z)">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg disabled:opacity-20 transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#40e1d3' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          title="בצע שוב (Cmd+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Device toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <button onClick={() => setDevice('desktop')} className="p-1.5 rounded-md transition-all duration-200"
            style={device === 'desktop' ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' } : { color: 'rgba(255,255,255,0.35)' }} title="דסקטופ">
            <Monitor className="w-4 h-4" />
          </button>
          <button onClick={() => setDevice('mobile')} className="p-1.5 rounded-md transition-all duration-200"
            style={device === 'mobile' ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3' } : { color: 'rgba(255,255,255,0.35)' }} title="מובייל">
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => setShowFullPreview(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
          style={showFullPreview
            ? { color: '#40e1d3', background: 'rgba(64,225,211,0.1)', border: '1px solid rgba(64,225,211,0.3)' }
            : { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
          }>
          {showFullPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          תצוגת מצגת מלאה
        </button>

        {feedbackCount > 0 && (
          <button onClick={() => setShowApprovals(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
            style={{ background: 'rgba(64,225,211,0.08)', border: '1px solid rgba(64,225,211,0.2)', color: '#40e1d3' }}>
            <MessageSquare className="w-3.5 h-3.5" /> אישורים {approvedCount}/{feedbackCount}
          </button>
        )}

        <div className="flex-1" />

        {/* Conflict banner — shown when another editor saved over us */}
        {conflict && (
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
            עודכן במקום אחר — רענן
          </button>
        )}

        {/* Save state */}
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {saveState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#40e1d3' }} /> שומר...</>}
          {saveState === 'saved' && <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#40e1d3' }} /> נשמר</>}
          {saveState === 'error' && !conflict && <span style={{ color: '#ef4444' }}>שגיאת שמירה</span>}
        </span>

        {slug && (
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
            style={{ background: copied ? 'rgba(64,225,211,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(64,225,211,0.3)' : 'rgba(255,255,255,0.08)'}`, color: copied ? '#40e1d3' : 'rgba(255,255,255,0.5)' }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'הועתק' : 'העתק לינק'}
          </button>
        )}
        {slug && (
          <a href={`/c/${slug}?preview=1`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#40e1d3' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            title="פתח בטאב חדש">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <button onClick={() => save('draft')} disabled={saveState === 'saving'} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
          <Save className="w-3.5 h-3.5" /> טיוטה
        </button>
        <button onClick={() => save('published', { redirect: true })} disabled={saveState === 'saving'} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all duration-200"
          style={{ background: 'rgba(64,225,211,0.15)', border: '1px solid rgba(64,225,211,0.4)', color: '#40e1d3' }}>
          <Send className="w-3.5 h-3.5" /> {status === 'published' ? 'עדכן ופרסם' : 'פרסום'}
        </button>
      </div>

      {/* Body: filmstrip | canvas | inspector */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 overflow-y-auto p-3 hidden md:block" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#050505' }}>
          <SlideFilmstrip
            sections={doc.sections}
            activeId={activeId}
            feedback={feedbackStatusMap}
            meta={doc.meta}
            onSelect={setActiveId}
            onAdd={() => { addSection(); }}
            onSmartUpload={() => setSmartOpen(true)}
            onDuplicate={duplicateSection}
            onRemove={removeSection}
            onMove={moveSection}
            onClearConcept={() => { if (confirm('למחוק את שקף הקונספט? תוכן הקונספט יימחק.')) setMeta({ concept: '' }) }}
          />
        </aside>

        <main className="flex-1 min-w-0 relative flex flex-col">
          {/* Always-available slide navigation — works even when the filmstrip is
              hidden (narrow screens) so you can always move between slides. */}
          {!showFullPreview && activeSection && doc.sections.length > 1 && (() => {
            const idx = doc.sections.findIndex(s => s.id === activeId)
            return (
              <div className="flex items-center justify-between gap-2 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,10,0.6)' }}>
                <button
                  type="button"
                  disabled={idx <= 0}
                  onClick={() => idx > 0 && setActiveId(doc.sections[idx - 1].id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <ChevronRight className="w-3.5 h-3.5" /> הקודם
                </button>
                <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>שקף {idx + 1} מתוך {doc.sections.length}</span>
                <button
                  type="button"
                  disabled={idx >= doc.sections.length - 1}
                  onClick={() => idx < doc.sections.length - 1 && setActiveId(doc.sections[idx + 1].id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
                >
                  הבא <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })()}
          <div className="flex-1 min-h-0 relative">
          {showFullPreview ? (
            <div className="fixed inset-0 z-[60] overflow-auto" style={{ background: '#090c0e' }}>
              <button
                onClick={() => setShowFullPreview(false)}
                className="fixed top-4 left-4 z-[61] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }}
              >
                <X className="w-4 h-4" /> סגור תצוגה
              </button>
              <CampaignPresentation slides={previewSlides} clientName={doc.meta.client || 'שם לקוח'} campaignName={doc.meta.campaignName || 'שם קמפיין'} />
            </div>
          ) : (
            <SlideCanvas
              section={activeSection}
              clientName={doc.meta.client}
              clientLogoUrl={clientLogoUrl}
              device={device}
              uploading={activeSection ? (uploadCounts[activeSection.id] ?? 0) : 0}
              uploadProgress={activeSection ? uploadProgress[activeSection.id] : undefined}
              copies={doc.meta.copies}
              activeCopyIdx={activeCopyIdx}
              onActiveCopyChange={setActiveCopyIdx}
              onUpdateSection={patch => activeSection && updateSection(activeSection.id, patch)}
              onUpdateAsset={(assetId, patch) => activeSection && updateAsset(activeSection.id, assetId, patch)}
              onRemoveAsset={handleRemoveAsset}
              onMoveAsset={(from, to) => activeSection && moveAsset(activeSection.id, from, to)}
              onUploadFiles={uploadFiles}
              onReplaceAsset={replaceAsset}
              onAddVideo={addVideo}
            />
          )}
          </div>
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto p-4 hidden lg:block" style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,10,0.95)' }}>
          <Inspector
            section={activeSection}
            meta={doc.meta}
            onUpdateSection={patch => activeSection && updateSection(activeSection.id, patch)}
            onUpdateMeta={setMeta}
            onUploadLogo={uploadLogo}
            uploadingLogo={uploadingLogo}
            passwordDirty={passwordDirty}
            onPasswordDirty={setPasswordDirty}
            onGenerateCopy={generateCopy}
            onApplyContentToAll={applyContentToAll}
          />
        </aside>
      </div>

      {/* Approvals panel */}
      {showApprovals && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowApprovals(false)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6" style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: '#40e1d3', boxShadow: '0 0 8px rgba(64,225,211,0.5)' }} />
                <h3 className="text-base font-bold" style={{ color: '#fff' }}>אישורי לקוח ({approvedCount}/{feedbackCount})</h3>
              </div>
              <button onClick={() => setShowApprovals(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
                aria-label="סגור">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {doc.sections.filter(s => feedback[s.id]).map(s => {
                const fb = feedback[s.id]
                const color = fb.status === 'approved' ? '#40e1d3' : fb.status === 'rejected' ? '#ef4444' : '#64748b'
                const label = fb.status === 'approved' ? 'אושר' : fb.status === 'rejected' ? 'נדרש שינוי' : 'ממתין'
                return (
                  <div key={s.id} className="rounded-xl p-3.5 transition-all duration-200" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />
                      <span className="text-sm font-bold flex-1 truncate" style={{ color: '#fff' }}>{s.title || 'שקף ללא כותרת'}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ color, background: `${color}15` }}>{label}</span>
                    </div>
                    {fb.comment && <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{fb.comment}</p>}
                    {fb.author && <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>— {fb.author}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Smart bulk upload */}
      <SmartUploadModal open={smartOpen} onClose={() => setSmartOpen(false)} onConfirm={smartUpload} />

      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map(t => (
          <div key={t.id} className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-2xl"
            style={{
              background: t.kind === 'error' ? 'rgba(239,68,68,0.9)' : t.kind === 'success' ? 'rgba(64,225,211,0.15)' : 'rgba(10,10,10,0.95)',
              color: t.kind === 'error' ? '#fff' : t.kind === 'success' ? '#40e1d3' : '#fff',
              border: `1px solid ${t.kind === 'error' ? 'rgba(239,68,68,0.5)' : t.kind === 'success' ? 'rgba(64,225,211,0.3)' : 'rgba(255,255,255,0.1)'}`,
              backdropFilter: 'blur(12px)',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
