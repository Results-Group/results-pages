'use client'

import type { InfoSection } from '@/lib/strategy/types'
import { INFO_TITLE_PRESETS } from '@/lib/strategy/registry'
import { Field, TextInput, TextArea, StringList, RepeaterCard, AddButton, uid } from './controls'
import type { FieldProps } from './index'

export default function InfoFields({ section, onChange }: FieldProps<InfoSection>) {
  const setGroups = (groups: InfoSection['groups']) => onChange({ groups })

  return (
    <>
      <Field label="כותרת">
        <TextInput value={section.title} onChange={v => onChange({ title: v })} />
        {/* The nine titles from the spec, offered rather than enforced. */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {INFO_TITLE_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ title: preset })}
              className="px-2 py-0.5 rounded-md text-[11px]"
              style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}
            >
              {preset}
            </button>
          ))}
        </div>
      </Field>

      <Field label="תיאור">
        <TextArea value={section.description} onChange={v => onChange({ description: v })} />
      </Field>

      <div className="mt-4">
        <span className="block text-xs mb-2" style={{ color: 'var(--admin-text-muted)' }}>בולטים וכותרות משנה</span>
        {section.groups.map((group, i) => (
          <RepeaterCard
            key={group.id}
            title={`קבוצה ${i + 1}`}
            onRemove={section.groups.length > 1 ? () => setGroups(section.groups.filter(g => g.id !== group.id)) : undefined}
          >
            <div className="mb-2">
              <TextInput
                value={group.heading}
                placeholder="כותרת משנה (אופציונלי)"
                onChange={v => setGroups(section.groups.map(g => (g.id === group.id ? { ...g, heading: v } : g)))}
              />
            </div>
            <StringList
              values={group.bullets}
              addLabel="בולט"
              placeholder="שורה"
              onChange={bullets => setGroups(section.groups.map(g => (g.id === group.id ? { ...g, bullets } : g)))}
            />
          </RepeaterCard>
        ))}
        <AddButton onClick={() => setGroups([...section.groups, { id: uid(), heading: '', bullets: [''] }])}>
          קבוצה
        </AddButton>
      </div>
    </>
  )
}
