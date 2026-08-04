'use client'

import { useState } from 'react'
import RichTextEditor from '@/app/admin/campaigns/_components/editor/PlanRichEditor'
import { emptyDoc } from '@/lib/rich-doc'
import type { StatementSection } from '@/lib/strategy/types'
import { Field, TextInput } from './controls'
import type { FieldProps } from './index'

const VARIANTS: { value: StatementSection['variant']; label: string }[] = [
  { value: 'plain', label: 'רגיל' },
  { value: 'transition', label: 'שקף מעבר' },
  { value: 'hero', label: 'מודגש (המיצוב)' },
]

export default function StatementFields({ section, onChange }: FieldProps<StatementSection>) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>
      <Field label="סוג התצוגה">
        <select
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
          value={section.variant}
          onChange={e => onChange({ variant: e.target.value })}
        >
          {VARIANTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </Field>

      <Field label="תוכן">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2 rounded-lg text-sm text-start"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        >
          פתיחת עורך הטקסט
        </button>
      </Field>

      {/* Full screen: writing the positioning statement in a 288px column
          doesn't work, the same reason the media plan opens this way. */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: 980, background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{section.title || 'תוכן השקף'}</span>
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--admin-bg-elevated)', color: 'var(--admin-text-primary)' }}>סגירה</button>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <RichTextEditor doc={section.body || emptyDoc()} onChange={doc => onChange({ body: doc })} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
