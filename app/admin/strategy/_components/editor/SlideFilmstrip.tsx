'use client'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Copy, Type, List, Table2, Boxes, ScatterChart, Quote, Image as ImageIcon, Languages, Gauge, HelpCircle } from 'lucide-react'
import { SECTION_KINDS, type IconName } from '@/lib/strategy/registry'
import type { AnySection } from '@/lib/strategy/types'
import { useT } from '@/lib/i18n'

/** Icons are named in the registry so it stays free of React; resolved here. */
const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  Type, List, Table2, Boxes, ScatterChart, Quote, Image: ImageIcon, Languages, Gauge,
}

/** A component rather than a function returning one: the react-compiler lint
 *  rightly flags selecting a component type during render. */
function SectionIcon({ section }: { section: AnySection }) {
  const Icon = section.kind === '__unknown__' ? HelpCircle : (ICONS[SECTION_KINDS[section.kind].icon] ?? Type)
  return <Icon className="w-3.5 h-3.5 shrink-0" />
}

function Row({ section, index, active, onSelect, onRemove, onDuplicate, label }: {
  section: AnySection
  index: number
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onDuplicate: () => void
  label: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group flex items-center gap-1.5 px-2 py-2 rounded-lg mb-1 cursor-pointer"
      onClick={onSelect}
      role="button"
      aria-current={active ? 'true' : undefined}
    >
      <span
        className="absolute inset-0 rounded-lg -z-10"
        style={{ background: active ? 'var(--admin-bg-elevated)' : 'transparent', position: 'absolute' }}
      />
      <button {...attributes} {...listeners} className="p-0.5 opacity-40 group-hover:opacity-80 cursor-grab" aria-label="גרור">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="text-[11px] w-5 tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>{index + 2}</span>
      <SectionIcon section={section} />
      <span className="flex-1 text-xs truncate" style={{ color: active ? 'var(--admin-text-primary)' : 'var(--admin-text-muted)' }}>
        {label}
      </span>
      <button onClick={e => { e.stopPropagation(); onDuplicate() }} className="p-1 opacity-0 group-hover:opacity-70 hover:!opacity-100" aria-label="שכפל">
        <Copy className="w-3 h-3" />
      </button>
      <button onClick={e => { e.stopPropagation(); onRemove() }} className="p-1 opacity-0 group-hover:opacity-70 hover:!opacity-100" style={{ color: '#ef4444' }} aria-label="מחק">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function SlideFilmstrip({
  sections, activeId, onSelect, onMove, onRemove, onDuplicate, header, footer,
}: {
  sections: AnySection[]
  activeId: string | null
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  const t = useT()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = sections.findIndex(s => s.id === active.id)
    const to = sections.findIndex(s => s.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }

  const labelFor = (section: AnySection) => {
    if (section.kind === '__unknown__') return 'שקף לא מוכר'
    return section.title || t(SECTION_KINDS[section.kind].labelKey as never)
  }

  return (
    <div className="h-full flex flex-col">
      {header}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Cover and closing are derived from the document, so they show as
            context but can't be selected, moved or deleted. */}
        <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg mb-1 opacity-50">
          <span className="text-[11px] w-5" style={{ color: 'var(--admin-text-muted)' }}>1</span>
          <span className="text-xs">שער</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section, i) => (
              <Row
                key={section.id}
                section={section}
                index={i}
                active={section.id === activeId}
                label={labelFor(section)}
                onSelect={() => onSelect(section.id)}
                onRemove={() => onRemove(section.id)}
                onDuplicate={() => onDuplicate(section.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg opacity-50">
          <span className="text-[11px] w-5" style={{ color: 'var(--admin-text-muted)' }}>{sections.length + 2}</span>
          <span className="text-xs">סיום</span>
        </div>
      </div>
      {footer}
    </div>
  )
}
