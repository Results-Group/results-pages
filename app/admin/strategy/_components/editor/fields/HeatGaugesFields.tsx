'use client'

import type { HeatGaugesSection } from '@/lib/strategy/types'
import { Field, TextInput, RepeaterCard, AddButton, uid } from './controls'
import type { FieldProps } from './index'

/**
 * The gauge values are dragged on the slide itself — that is the whole point of
 * a heat gauge. This panel owns the labels, and gives a numeric field per gauge
 * so a value can be set exactly (and by keyboard).
 */
export default function HeatGaugesFields({ section, onChange }: FieldProps<HeatGaugesSection>) {
  const set = (gauges: HeatGaugesSection['gauges']) => onChange({ gauges })

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>

      {section.gauges.map((gauge, i) => (
        <RepeaterCard
          key={gauge.id}
          title={`מדד ${i + 1}`}
          onRemove={section.gauges.length > 1 ? () => set(section.gauges.filter(g => g.id !== gauge.id)) : undefined}
        >
          <div className="mb-2">
            <TextInput value={gauge.heading} placeholder="שם המדד" onChange={v => set(section.gauges.map(g => (g.id === gauge.id ? { ...g, heading: v } : g)))} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <TextInput value={gauge.minLabel} placeholder="0" onChange={v => set(section.gauges.map(g => (g.id === gauge.id ? { ...g, minLabel: v } : g)))} />
            <TextInput value={gauge.maxLabel} placeholder="10" onChange={v => set(section.gauges.map(g => (g.id === gauge.id ? { ...g, maxLabel: v } : g)))} />
            <input
              type="number" min={0} max={10} step={0.5} value={gauge.value}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
              onChange={e => {
                const v = Math.min(10, Math.max(0, Number(e.target.value) || 0))
                set(section.gauges.map(g => (g.id === gauge.id ? { ...g, value: v } : g)))
              }}
            />
          </div>
        </RepeaterCard>
      ))}

      <AddButton onClick={() => set([...section.gauges, { id: uid(), heading: '', minLabel: '', maxLabel: '', value: 5 }])}>
        מדד
      </AddButton>
    </>
  )
}
