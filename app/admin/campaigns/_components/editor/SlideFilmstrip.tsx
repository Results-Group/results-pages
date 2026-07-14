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
  Star, BookOpen, CheckCircle2, Sparkles,
} from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import type { EditorSection, MockupType, CampaignMeta } from './types'

function typeIcon(type: MockupType) {
  if (type === 'video') return <Film className="w-3 h-3" />
  if (type === 'divider') return <LayoutTemplate className="w-3 h-3" />
  return <ImageIcon className="w-3 h-3" />
}

const STATUS_DOT: Record<string, string> = {
  approved: '#40e1d3',
  rejected: '#ef4444',
  pending: '#64748b',
}

/** Non-interactive chip for cover / concept / closing slides. When `onDelete`
 * is supplied (concept slide), a hover ✕ lets the user remove that slide. */
function SystemSlideChip({ label, icon, dim, onDelete }: { label: string; icon: React.ReactNode; dim?: boolean; onDelete?: () => void }) {
  return (
    <div
      className="group relative flex items-center gap-2 rounded-xl px-2 py-2"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        opacity: dim ? 0.5 : 0.7,
      }}
    >
      {/* spacer to align with drag handle */}
      <span className="w-3.5 h-3.5 shrink-0" />

      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
        {icon}
      </div>

      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>אוטומטי</p>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-1 left-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          aria-label={`מחק ${label}`}
          title={`מחק ${label}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function SortableItem({ section, index, active, status, onSelect, onDuplicate, onRemove }: {
  section: EditorSection
  index: number
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
        className="group relative rounded-xl p-2 cursor-pointer transition-all duration-200"
        style={{
          background: active ? 'rgba(64,225,211,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${active ? 'rgba(64,225,211,0.35)' : 'rgba(255,255,255,0.06)'}`,
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
            style={{ color: 'rgba(255,255,255,0.2)' }}
            aria-label="גרור לשינוי סדר"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <span className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0"
            style={{ background: active ? 'rgba(64,225,211,0.15)' : 'rgba(255,255,255,0.06)', color: active ? '#40e1d3' : 'rgba(255,255,255,0.4)' }}>
            {index + 1}
          </span>

          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {firstImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetProxyUrl(firstImage.file_path)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>{typeIcon(section.mockup_type)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate flex items-center gap-1.5" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}>
              {status && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[status], boxShadow: `0 0 5px ${STATUS_DOT[status]}50` }} title={status} />}
              {section.title || 'שקף ללא כותרת'}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {typeIcon(section.mockup_type)}
              {section.mockup_type === 'divider' ? 'חוצץ' : `${section.assets.length} פריטים`}
            </span>
          </div>
        </div>

        <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className="p-1 rounded-md transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }} aria-label="שכפל">
            <Copy className="w-3 h-3" />
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onRemove() }} className="p-1 rounded-md transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} aria-label="מחק">
            <Trash2 className="w-3 h-3" />
          </button>
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
  const systemCount = 2 + (meta.concept ? 1 : 0) // cover + optional concept + closing
  const total = systemCount + sections.length

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full" style={{ background: '#40e1d3' }} />
          <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>שקפים</span>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#40e1d3', background: 'rgba(64,225,211,0.1)' }}>{total}</span>
      </div>

      {/* Cover — always first */}
      <SystemSlideChip label="שקף שער" icon={<Star className="w-3 h-3" />} />

      {/* Concept — only when filled; deletable (clears the concept text) */}
      {meta.concept && (
        <SystemSlideChip label="קונספט" icon={<BookOpen className="w-3 h-3" />} onDelete={onClearConcept} />
      )}

      {/* Thin divider */}
      <div className="mx-2 my-0.5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Sortable user sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {sections.map((section, i) => (
              <SortableItem
                key={section.id}
                section={section}
                index={i}
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
      <div className="mx-2 mt-0.5" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Closing — always last */}
      <SystemSlideChip label="שקף סיום" icon={<CheckCircle2 className="w-3 h-3" />} />
    </div>
  )
}
