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
} from 'lucide-react'
import { assetProxyUrl } from '@/lib/asset-url'
import type { EditorSection, MockupType } from './types'

function typeIcon(type: MockupType) {
  if (type === 'video') return <Film className="w-3 h-3" />
  if (type === 'divider') return <LayoutTemplate className="w-3 h-3" />
  return <ImageIcon className="w-3 h-3" />
}

const STATUS_DOT: Record<string, string> = {
  approved: '#2EC4B6',
  rejected: '#ef4444',
  pending: '#94a3b8',
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
    opacity: isDragging ? 0.6 : 1,
  }
  const firstImage = section.assets.find(a => a.file_path)

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={onSelect}
        className="group relative rounded-xl p-2 cursor-pointer transition-colors"
        style={{
          background: active ? 'rgba(64,225,211,0.08)' : 'var(--admin-bg-elevated)',
          border: `1px solid ${active ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5"
            style={{ color: 'var(--admin-text-muted)' }}
            aria-label="גרור לשינוי סדר"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <span className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold shrink-0"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-accent)' }}>
            {index + 1}
          </span>

          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--admin-bg)' }}>
            {firstImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetProxyUrl(firstImage.file_path)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: 'var(--admin-text-muted)' }}>{typeIcon(section.mockup_type)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--admin-text-primary)' }}>
              {status && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[status] }} title={status} />}
              {section.title || 'שקף ללא כותרת'}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
              {typeIcon(section.mockup_type)}
              {section.mockup_type === 'divider' ? 'חוצץ' : `${section.assets.length} פריטים`}
            </span>
          </div>
        </div>

        <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className="p-1 rounded" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-secondary)' }} aria-label="שכפל">
            <Copy className="w-3 h-3" />
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onRemove() }} className="p-1 rounded" style={{ background: 'var(--admin-bg)', color: 'var(--admin-danger)' }} aria-label="מחק">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SlideFilmstrip({ sections, activeId, feedback, onSelect, onAdd, onDuplicate, onRemove, onMove }: {
  sections: EditorSection[]
  activeId: string | null
  feedback?: Record<string, 'approved' | 'rejected' | 'pending'>
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--admin-text-secondary)' }}>שקפים</span>
        <span className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>{sections.length}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
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
        className="flex items-center justify-center gap-1.5 mt-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        style={{ color: 'var(--admin-accent)', border: '1px dashed var(--admin-border)' }}
      >
        <Plus className="w-3.5 h-3.5" /> הוסף שקף
      </button>
    </div>
  )
}
