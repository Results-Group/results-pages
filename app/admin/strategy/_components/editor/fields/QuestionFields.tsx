'use client'

import type { QuestionSection } from '@/lib/strategy/types'
import { Field, TextInput, TextArea, StringList } from './controls'
import type { FieldProps } from './index'

export default function QuestionFields({ section, onChange }: FieldProps<QuestionSection>) {
  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
      </Field>
      <Field label="תת כותרת">
        <TextInput value={section.subtitle || ''} onChange={v => onChange({ subtitle: v })} />
      </Field>
      <Field label="השאלה">
        <TextArea value={section.quote} onChange={v => onChange({ quote: v })} rows={3} />
      </Field>
      <Field label="שורת מעבר">
        <TextArea value={section.leadIn} onChange={v => onChange({ leadIn: v })} rows={2} />
      </Field>
      <Field label="יתרונות תחרותיים">
        <StringList values={section.bullets} addLabel="בולט" onChange={bullets => onChange({ bullets })} />
      </Field>
    </>
  )
}
