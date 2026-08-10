'use client'

import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Copy, Trash2, Image as ImageIcon, Film, LayoutTemplate,
  Star, BookOpen, CheckCircle2, Sparkles, BarChart3, TrendingUp, Layers,
} from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import { countClientSlides, slidesPerSection } from '@/lib/slides'
import type { EditorSection, MockupType, CampaignMeta } from './types'

/** The slide numbers a chip stands for, as the client will count them.
 *  `null` when the section produces no slide at all (no assets yet). */
type SlideRange = { from: number; to: number } | null

/** The number badge on a chip. A section with four creatives is two client
 *  screens, so it shows "8–9": numbering the chips 1..n while the total badge
 *  counted real slides made the sidebar contradict itself, and the operator
 *  trusted the smaller number. */
function SlideNum({ range, active, dim }: { range: SlideRange; active?: boolean; dim?: boolean }) {
  return (
    <span
      className="flex items-center justify-center min-w-5 px-1 h-5 rounded text-[10px] font-bold shrink-0 tabular-nums"
      style={{
        background: active ? 'rgba(64,225,211,0.15)' : 'var(--admin-bg-elevated)',
        color: active ? '#40e1d3' : 'var(--admin-text-muted)',
        opacity: dim ? 0.6 : 1,
      }}
      title={range && range.to > range.from ? `שקפים ${range.from}–${range.to}` : undefined}
    >
      {!range ? '–' : range.from === range.to ? range.from : `${range.from}–${range.to}`}
    </span>
  )
}

function typeIcon(type: MockupType) {
  if (type === 'video') return <Film className="w-3 h-3" />
  if (type === 'divider') return <LayoutTemplate className="w-3 h-3" />
  if (type === 'distribution') return <BarChart3 className="w-3 h-3" />
  if (type === 'stats') return <TrendingUp className="w-3 h-3" />
  if (type === 'facebook_cover' || type === 'youtube_cover') return <Layers className="w-3 h-3" />
  return <ImageIcon className="w-3 h-3" />
}

const STATUS_DOT: Record<string, string> = {
  approved: '#40e1d3',
  rejected: '#ef4444',
  pending: '#64748b',
}

/** Non-interactive chip for cover / concept / closing slides. When `onDelete`
 * is supplied (concept slide), a hover ✕ lets the user remove that slide. */
function SystemSlideChip({ label, icon, num, dim, onDelete }: { label: string; icon: React.ReactNode; num: number; dim?: boolean; onDelete?: () => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-2 py-2"
      style={{
        background: 'var(--admin-hover-bg)',
        border: '1px solid var(--admin-border)',
        opacity: dim ? 0.5 : 0.7,
      }}
    >
      {/* spacer to align with drag handle */}
      <span className="w-3.5 h-3.5 shrink-0" />

      <SlideNum range={{ from: num, to: num }} />

      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
        <span style={{ color: 'var(--admin-text-muted)' }}>{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--admin-text-muted)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>אוטומטי</p>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded-md shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          aria-label={`מחק ${label}`}
          title={`מחק ${label}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function SortableItem({ section, range, active, status, onSelect, onDuplicate, onRemove }: {
  section: EditorSection
  range: SlideRange
  active: boolean
  status?: 'approved' | 'rejected' | 'pending'
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const firstImage = section.assets.find(a => a.file_path)

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={onSelect}
        className="group rounded-xl p-2 cursor-pointer transition-all duration-200"
        style={{
          background: active ? 'rgba(64,225,211,0.08)' : 'var(--admin-hover-bg)',
          border: `1px solid ${active ? 'rgba(64,225,211,0.35)' : 'var(--admin-border)'}`,
          boxShadow: active ? '0 0 0 1px rgba(64,225,211,0.1)' : 'none',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5 transition-colors"
            style={{ color: 'var(--admin-text-muted)' }}
            aria-label="גרור לשינוי סדר"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <SlideNum range={range} active={active} />

          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
            {firstImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetProxyUrl(firstImage.file_path)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: 'var(--admin-text-muted)' }}>{typeIcon(section.mockup_type)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate flex items-center gap-1.5" style={{ color: active ? '#fff' : 'var(--admin-text-secondary)' }}>
              {status && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[status], boxShadow: `0 0 5px ${STATUS_DOT[status]}50` }} title={status} />}
              {section.title || 'שקף ללא כותרת'}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
              {typeIcon(section.mockup_type)}
              {section.mockup_type === 'divider'
                ? 'חוצץ'
                : section.mockup_type === 'distribution'
                  ? `${(section.plan?.channels ?? []).length} ערוצים`
                  : section.mockup_type === 'stats'
                    ? `${(section.stats?.kpis ?? []).length + (section.stats?.groups ?? []).reduce((n, g) => n + (g.kpis ?? []).length, 0)} מדדים`
                    : `${section.assets.length} פריטים`}
            </span>
          </div>

          {/* Actions — inline (reserved space) so they never cover the title, and visible without hover */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className="p-1 rounded-md transition-opacity opacity-60 hover:opacity-100"
              style={{ background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-secondary)' }} aria-label="שכפל" title="שכפל">
              <Copy className="w-3 h-3" />
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); onRemove() }} className="p-1 rounded-md transition-opacity opacity-70 hover:opacity-100"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }} aria-label="מחק" title="מחק">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SlideFilmstrip({ sections, activeId, feedback, meta, onSelect, onAdd, onSmartUpload, onDuplicate, onRemove, onMove, onClearConcept }: {
  sections: EditorSection[]
  activeId: string | null
  feedback?: Record<string, 'approved' | 'rejected' | 'pending'>
  meta: Pick<CampaignMeta, 'concept'>
  onSelect: (id: string) => void
  onAdd: () => void
  onSmartUpload?: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
  onClearConcept?: () => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = sections.findIndex(s => s.id === active.id)
    const to = sections.findIndex(s => s.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }

  // Total slides in the final deck for the counter
  // Total = real number of client-facing slides, matching the deck the client
  // scrolls through. A section with 4 creatives counts as 2 (the split), a
  // carousel counts as 1, an empty section counts as 0. This keeps the badge
  // consistent with the "שקף X מתוך Y" divider inside the editor preview.
  const total = countClientSlides(sections, { hasConcept: !!meta.concept })

  // Walk the deck once and hand each chip the slide numbers it produces, so
  // the sidebar reads top to bottom as 1 … total with no gaps.
  let cursor = 1 + (meta.concept ? 1 : 0) // cover, and the concept slide if set
  const ranges: SlideRange[] = sections.map(s => {
    const n = slidesPerSection(s)
    const range = n === 0 ? null : { from: cursor + 1, to: cursor + n }
    cursor += n
    return range
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full" style={{ background: '#40e1d3' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--admin-text-secondary)' }}>שקפים</span>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#40e1d3', background: 'rgba(64,225,211,0.1)' }}>{total}</span>
      </div>

      {/* Cover — always first */}
      <SystemSlideChip label="שקף שער" num={1} icon={<Star className="w-3 h-3" />} />

      {/* Concept — only when filled; deletable (clears the concept text) */}
      {meta.concept && (
        <SystemSlideChip label="קונספט" num={2} icon={<BookOpen className="w-3 h-3" />} onDelete={onClearConcept} />
      )}

      {/* Thin divider */}
      <div className="mx-2 my-0.5" style={{ height: 1, background: 'var(--admin-hover-bg)' }} />

      {/* Sortable user sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {sections.map((section, i) => (
              <SortableItem
                key={section.id}
                section={section}
                range={ranges[i]}
                active={section.id === activeId}
                status={feedback?.[section.id]}
                onSelect={() => onSelect(section.id)}
                onDuplicate={() => onDuplicate(section.id)}
                onRemove={() => onRemove(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={onAdd}
        className="flex items-center justify-center gap-1.5 mt-0.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
        style={{ color: '#40e1d3', border: '1px dashed rgba(64,225,211,0.25)', background: 'rgba(64,225,211,0.03)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.08)'; e.currentTarget.style.borderColor = 'rgba(64,225,211,0.4)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.03)'; e.currentTarget.style.borderColor = 'rgba(64,225,211,0.25)' }}
      >
        <Plus className="w-3.5 h-3.5" /> הוסף שקף
      </button>

      {onSmartUpload && (
        <button
          onClick={onSmartUpload}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
          style={{ color: '#04211d', background: 'rgba(64,225,211,0.9)' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#40e1d3' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,225,211,0.9)' }}
        >
          <Sparkles className="w-3.5 h-3.5" /> העלאה חכמה
        </button>
      )}

      {/* Thin divider */}
      <div className="mx-2 mt-0.5" style={{ height: 1, background: 'var(--admin-hover-bg)' }} />

      {/* Closing — always last */}
      <SystemSlideChip label="שקף סיום" num={total} icon={<CheckCircle2 className="w-3 h-3" />} />
    </div>
  )
}
