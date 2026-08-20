'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Eye, Save, Undo2, Redo2, RotateCw, Loader2, X, ExternalLink } from 'lucide-react'
import { useStrategyDocument } from './useStrategyDocument'
import { useAutosaveDocument } from '@/app/admin/_components/editor/useAutosaveDocument'
import SlideFilmstrip from './SlideFilmstrip'
import AddSectionMenu from './AddSectionMenu'
import { SectionFields } from './fields'
import SlideCanvas from './SlideCanvas'
import { countStrategySlides } from '@/lib/strategy/slides'
import { useToast } from '@/app/admin/_components/toast'
import { useRegisterUnsavedChanges } from '@/app/admin/_components/unsaved-changes'
import type { StrategyDocument } from '@/lib/strategy/types'

/**
 * The strategy document editor.
 *
 * Three panes: the slide list, a live canvas, and the field panel. The canvas
 * renders the *same* components the client's deck uses, so what the operator
 * sees is what gets delivered — the campaign builder's split rendering drifted
 * twice, and this is the fix.
 */

const StrategyPresentation = dynamic(() => import('@/app/s/[slug]/presentation'), { ssr: false })

export interface StrategyEditorInitial {
  id: string | null
  updatedAt: string | null
  slug: string | null
  status: 'draft' | 'published' | 'archived'
  doc: StrategyDocument
}

export default function StrategyEditor({ initial }: { initial: StrategyEditorInitial }) {
  const router = useRouter()
  const { showToast } = useToast()
  const {
    doc, canUndo, canRedo, setMeta, addSection, duplicateSection,
    removeSection, updateSection, moveSection, undo, redo,
  } = useStrategyDocument(initial.doc)

  const [activeId, setActiveId] = useState<string | null>(doc.sections[0]?.id ?? null)
  const [status, setStatus] = useState(initial.status)
  const [slug, setSlug] = useState(initial.slug)
  const [preview, setPreview] = useState(false)
  // Below lg the three-pane grid can't fit — a segmented control shows one
  // pane at a time. CSS `hidden` (not unmount) so field state survives switching.
  const [pane, setPane] = useState<'slides' | 'canvas' | 'fields'>('canvas')

  const buildBody = useCallback((d: StrategyDocument) => ({
    client: d.meta.client,
    client_id: d.meta.clientId,
    doc_name: d.meta.docName,
    // Verbatim. There is no field list to forget a field from — the reason the
    // campaign builder's equivalent lost distribution plans.
    sections: d.sections,
  }), [])

  const { docId, saveState, conflict, save, ensureExists } = useAutosaveDocument<StrategyDocument>({
    doc,
    id: initial.id,
    initialUpdatedAt: initial.updatedAt,
    createUrl: '/api/strategy-docs',
    itemUrl: id => `/api/strategy-docs/${id}`,
    buildBody,
    buildCreateBody: d => ({ client: d.meta.client, doc_name: d.meta.docName, from_template: false }),
    validate: d => (d.meta.client.trim() && d.meta.docName.trim() ? null : 'יש למלא שם לקוח ושם מסמך'),
    onCreated: created => {
      setSlug(created.slug ?? null)
      // Replace rather than push: the operator is already "in" this document.
      router.replace(`/admin/strategy/${created.id}`)
    },
    onError: message => showToast(message, 'error'),
  })

  // New mode holds everything in memory until client+name exist; a save in
  // flight is the other window where leaving loses the newest edits.
  useRegisterUnsavedChanges(
    saveState === 'saving' || (!docId && (doc.sections.length > 0 || doc.meta.client.trim() !== '' || doc.meta.docName.trim() !== '')),
    'יש שינויים שעדיין לא נשמרו במסמך. לעזוב בכל זאת?'
  )

  // Keep the selection valid when the slide it points at is deleted.
  useEffect(() => {
    if (activeId && !doc.sections.some(s => s.id === activeId)) {
      setActiveId(doc.sections[0]?.id ?? null)
    }
  }, [doc.sections, activeId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
        return
      }
      // Undo/redo is left to the field itself while typing, so the browser's
      // own text history keeps working.
      if (inField) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
      if (e.key === 'Escape' && preview) setPreview(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, undo, redo, preview])

  const activeSection = doc.sections.find(s => s.id === activeId) ?? null
  const slideCount = useMemo(() => countStrategySlides(doc.sections), [doc.sections])

  const publish = async () => {
    const id = await ensureExists()
    if (!id) return
    await save()
    const res = await fetch(`/api/strategy-docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    })
    if (res.ok) {
      const data = await res.json()
      setStatus('published')
      setSlug(data.slug)
      showToast('המסמך פורסם', 'success')
    } else {
      showToast('שגיאה בפרסום', 'error')
    }
  }

  const panel: React.CSSProperties = { background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          className="px-3 py-2 rounded-lg text-sm outline-none font-semibold"
          style={{ ...panel, color: 'var(--admin-text-primary)', minWidth: 220 }}
          value={doc.meta.docName}
          placeholder="שם המסמך"
          onChange={e => setMeta({ docName: e.target.value })}
        />
        <input
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ ...panel, color: 'var(--admin-text-primary)', minWidth: 180 }}
          value={doc.meta.client}
          placeholder="לקוח"
          onChange={e => setMeta({ client: e.target.value })}
        />

        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg disabled:opacity-30" style={panel} aria-label="בטל"><Undo2 className="w-4 h-4" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg disabled:opacity-30" style={panel} aria-label="בצע שוב"><Redo2 className="w-4 h-4" /></button>
        </div>

        <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{slideCount} שקפים</span>

        <div className="flex-1" />

        {conflict ? (
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
            style={{ background: '#7f1d1d', color: '#fff' }}
          >
            <RotateCw className="w-4 h-4" />
            עודכן במקום אחר — רענן
          </button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            {saveState === 'saving' ? 'שומר…' : saveState === 'saved' ? 'נשמר' : saveState === 'error' ? 'שגיאה בשמירה' : ''}
          </span>
        )}

        <button onClick={() => setPreview(true)} className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5" style={panel}>
          <Eye className="w-4 h-4" /> תצוגה מלאה
        </button>
        {slug && status === 'published' && (
          <a href={`/s/${slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5" style={panel}>
            <ExternalLink className="w-4 h-4" /> פתח
          </a>
        )}
        <button onClick={() => save()} className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5" style={panel}>
          {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} שמור
        </button>
        <button
          onClick={publish}
          className="px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--admin-accent, #40e1d3)', color: '#06282a' }}
        >
          {status === 'published' ? 'עדכן פרסום' : 'פרסם'}
        </button>
      </div>

      {/* Pane switcher — only below lg */}
      <div className="lg:hidden flex gap-1 mb-2 p-1 rounded-xl" style={panel}>
        {([['slides', 'שקפים'], ['canvas', 'שקף'], ['fields', 'עריכה']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setPane(key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={pane === key
              ? { background: 'rgba(64,225,211,0.15)', color: '#40e1d3' }
              : { color: 'var(--admin-text-secondary)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Three panes (one at a time below lg) */}
      <div className="flex-1 grid gap-3 min-h-0 lg:[grid-template-columns:250px_minmax(0,1fr)_320px]">
        <div className={`rounded-xl overflow-hidden min-h-0 ${pane === 'slides' ? '' : 'hidden'} lg:block`} style={panel}>
          <SlideFilmstrip
            sections={doc.sections}
            activeId={activeId}
            onSelect={id => { setActiveId(id); setPane('canvas') }}
            onMove={moveSection}
            onRemove={removeSection}
            onDuplicate={duplicateSection}
            footer={<AddSectionMenu onAdd={kind => addSection(kind, activeId ?? undefined)} />}
          />
        </div>

        <div className={`rounded-xl overflow-y-auto min-h-0 ${pane === 'canvas' ? '' : 'hidden'} lg:block`} style={panel}>
          <SlideCanvas
            section={activeSection}
            onChange={patch => activeSection && updateSection(activeSection.id, patch)}
          />
        </div>

        <div className={`rounded-xl overflow-y-auto min-h-0 p-3 ${pane === 'fields' ? '' : 'hidden'} lg:block`} style={panel}>
          {activeSection ? (
            <SectionFields
              section={activeSection}
              onChange={patch => updateSection(activeSection.id, patch)}
              docId={docId}
              ensureDoc={ensureExists}
            />
          ) : null}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60]" style={{ background: '#090c0e' }}>
          <button
            onClick={() => setPreview(false)}
            className="fixed top-4 left-4 z-[61] px-3 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-1.5"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            <X className="w-4 h-4" /> יציאה
          </button>
          <StrategyPresentation
            slides={[
              { type: 'cover', clientName: doc.meta.client, docName: doc.meta.docName, logoUrl: doc.meta.logoUrl, date: '' },
              ...doc.sections.filter(s => s.kind !== '__unknown__').map(section => ({ type: 'section' as const, section })),
              { type: 'closing', clientName: doc.meta.client },
            ]}
            clientName={doc.meta.client}
            docName={doc.meta.docName}
          />
        </div>
      )}
    </div>
  )
}
