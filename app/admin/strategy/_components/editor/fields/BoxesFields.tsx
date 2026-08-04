'use client'

import type { BoxesSection } from '@/lib/strategy/types'
import { Field, TextInput, TextArea, StringList, RepeaterCard, AddButton, uid } from './controls'
import type { FieldProps } from './index'

export default function BoxesFields({ section, onChange }: FieldProps<BoxesSection>) {
  const set = (boxes: BoxesSection['boxes']) => onChange({ boxes })
  const patch = (id: string, p: Partial<BoxesSection['boxes'][number]>) =>
    set(section.boxes.map(b => (b.id === id ? { ...b, ...p } : b)))

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>
      <Field label="סוג התיבות">
        <select
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          value={section.variant}
          onChange={e => onChange({ variant: e.target.value })}
        >
          <option value="plain">כותרת ותיאור</option>
          <option value="proscons">יתרונות וחסרונות</option>
        </select>
      </Field>

      {section.boxes.map((box, i) => (
        <RepeaterCard
          key={box.id}
          title={`תיבה ${i + 1}`}
          onRemove={section.boxes.length > 1 ? () => set(section.boxes.filter(b => b.id !== box.id)) : undefined}
        >
          <div className="mb-2"><TextInput value={box.title} placeholder="כותרת" onChange={v => patch(box.id, { title: v })} /></div>
          <div className="mb-2"><TextInput value={box.subtitle || ''} placeholder="תת כותרת" onChange={v => patch(box.id, { subtitle: v })} /></div>

          {section.variant === 'proscons' ? (
            <>
              <span className="block text-[11px] mb-1" style={{ color: 'var(--admin-text-muted)' }}>יתרונות</span>
              <div className="mb-2">
                <StringList values={box.pros || []} addLabel="יתרון" onChange={pros => patch(box.id, { pros })} />
              </div>
              <span className="block text-[11px] mb-1" style={{ color: 'var(--admin-text-muted)' }}>חסרונות</span>
              <StringList values={box.cons || []} addLabel="חיסרון" onChange={cons => patch(box.id, { cons })} />
            </>
          ) : (
            <TextArea value={box.description || ''} placeholder="תיאור" onChange={v => patch(box.id, { description: v })} />
          )}
        </RepeaterCard>
      ))}

      <AddButton onClick={() => set([...section.boxes, { id: uid(), title: '', description: '' }])}>תיבה</AddButton>
    </>
  )
}
