'use client'

import { Plus, Trash2 } from 'lucide-react'
import { uid } from '@/lib/strategy/registry'

/**
 * The small form controls every field editor is built from.
 *
 * Styling matches the campaign Inspector so the two editors feel like one
 * product; the shapes are generic because a strategy section's payload is a
 * discriminated union rather than a flat set of asset fields.
 */

export const inputStyle: React.CSSProperties = {
  background: 'var(--admin-bg-elevated)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

export function TextInput({
  value, onChange, placeholder, dir,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <input
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={inputStyle}
      value={value}
      dir={dir}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

export function TextArea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
      style={inputStyle}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

/** A list of free-text lines with add/remove — bullets, pros, cons. */
export function StringList({
  values, onChange, placeholder, addLabel,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel: string
}) {
  return (
    <div className="space-y-1.5">
      {values.map((value, i) => (
        <div className="flex gap-1.5 items-center" key={i}>
          <input
            className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
            style={inputStyle}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button
            type="button"
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
            style={{ color: 'var(--admin-danger, #ef4444)' }}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            aria-label="הסר"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...values, ''])}>{addLabel}</AddButton>
    </div>
  )
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
      style={{ background: 'var(--admin-bg-elevated)', border: '1px dashed var(--admin-border)', color: 'var(--admin-text-muted)' }}
    >
      <Plus className="w-3.5 h-3.5" />
      {children}
    </button>
  )
}

/** A bordered group with a title and an optional remove button. */
export function RepeaterCard({
  title, onRemove, children,
}: {
  title: string
  onRemove?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-3 mb-2.5" style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--admin-text-muted)' }}>{title}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded opacity-60 hover:opacity-100" style={{ color: '#ef4444' }} aria-label="הסר">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

export { uid }
