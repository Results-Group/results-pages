'use client'

import type { BrandLanguageSection } from '@/lib/strategy/types'
import { Field, TextInput, TextArea, RepeaterCard, AddButton, uid } from './controls'
import type { FieldProps } from './index'

export default function BrandLanguageFields({ section, onChange }: FieldProps<BrandLanguageSection>) {
  const set = (positives: BrandLanguageSection['positives']) => onChange({ positives })

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>

      {section.positives.map((item, i) => (
        <RepeaterCard
          key={item.id}
          title={`מינוח ${i + 1}`}
          onRemove={section.positives.length > 1 ? () => set(section.positives.filter(p => p.id !== item.id)) : undefined}
        >
          {/* The slide renders this as: איך המותג אומר "<phrase>"? */}
          <div className="mb-2">
            <TextInput value={item.phrase} placeholder="המילה שמחליפים" onChange={v => set(section.positives.map(p => (p.id === item.id ? { ...p, phrase: v } : p)))} />
          </div>
          <TextArea value={item.description} placeholder="איך המותג אומר את זה" rows={2} onChange={v => set(section.positives.map(p => (p.id === item.id ? { ...p, description: v } : p)))} />
        </RepeaterCard>
      ))}

      <div className="mb-3">
        <AddButton onClick={() => set([...section.positives, { id: uid(), phrase: '', description: '' }])}>מינוח</AddButton>
      </div>

      <Field label="מינוחים לא נכונים">
        <TextArea
          value={section.negative.description}
          placeholder="מילים שהמותג נמנע מהן"
          onChange={v => onChange({ negative: { ...section.negative, description: v } })}
        />
      </Field>
    </>
  )
}
