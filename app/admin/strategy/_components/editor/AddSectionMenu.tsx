'use client'

import { useState } from 'react'
import { Plus, Type, List, Table2, Boxes, ScatterChart, Quote, Image as ImageIcon, Languages, Gauge } from 'lucide-react'
import { SECTION_KINDS, ALL_SECTION_KINDS, type IconName } from '@/lib/strategy/registry'
import type { SectionKind } from '@/lib/strategy/types'
import { useT } from '@/lib/i18n'

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  Type, List, Table2, Boxes, ScatterChart, Quote, Image: ImageIcon, Languages, Gauge,
}

/** Driven entirely by the registry — a new kind appears here for free. */
export default function AddSectionMenu({ onAdd }: { onAdd: (kind: SectionKind) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const kinds = ALL_SECTION_KINDS.filter(k => SECTION_KINDS[k].repeatable)

  return (
    <div className="relative p-2" style={{ borderTop: '1px solid var(--admin-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 rounded-lg text-sm inline-flex items-center justify-center gap-1.5"
        style={{ background: 'var(--admin-bg-elevated)', border: '1px dashed var(--admin-border)', color: 'var(--admin-text-muted)' }}
      >
        <Plus className="w-4 h-4" />
        הוספת שקף
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full inset-x-2 mb-1 rounded-xl overflow-hidden z-50"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}
          >
            {kinds.map(kind => {
              const Icon = ICONS[SECTION_KINDS[kind].icon]
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => { onAdd(kind); setOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-start inline-flex items-center gap-2 hover:opacity-80"
                  style={{ color: 'var(--admin-text-primary)' }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(SECTION_KINDS[kind].labelKey as never)}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
