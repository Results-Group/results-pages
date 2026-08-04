'use client'

import { useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'

/**
 * The body field for a copy variation.
 *
 * Ad copy runs long — the versions in real campaigns are ten to twenty lines —
 * and a fixed three-row box with resize disabled meant the operator was reading
 * their own text through a slot. Three ways out, in increasing order of
 * commitment: it grows with its content, it can be dragged taller, and it opens
 * full screen for actual writing (the same escape hatch the media plan has,
 * because a 288px inspector column is not where you compose a paragraph).
 */

/** Grown to fit, but never past this — beyond it the panel becomes the problem. */
const MAX_AUTO_HEIGHT = 340
const MIN_HEIGHT = 78

export default function CopyTextArea({
  value,
  onChange,
  placeholder,
  label,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Shown in the full-screen overlay's header. */
  label: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)

  // Auto-size on every change, and on mount for text that was already there.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight + 2, MIN_HEIGHT), MAX_AUTO_HEIGHT)}px`
  }, [value])

  return (
    <>
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          dir="auto"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y transition-all duration-200"
          style={{ ...style, minHeight: MIN_HEIGHT, paddingInlineEnd: 30 }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(64,225,211,0.3)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute top-1.5 p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
          style={{ insetInlineEnd: 6, color: 'var(--admin-text-muted)' }}
          aria-label="הגדלה למסך מלא"
          title="הגדלה למסך מלא"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full rounded-2xl overflow-hidden flex flex-col"
            style={{ maxWidth: 860, maxHeight: '86vh', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{label}</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--admin-text-muted)' }}
                aria-label="סגירה"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              dir="auto"
              autoFocus
              className="flex-1 w-full px-5 py-4 text-base outline-none resize-none"
              style={{ background: 'transparent', color: 'var(--admin-text-primary)', minHeight: '58vh', lineHeight: 1.9 }}
            />
            <div className="px-4 py-2.5 text-[11px]" style={{ borderTop: '1px solid var(--admin-border)', color: 'var(--admin-text-muted)' }}>
              {value.length} תווים · {value.split('\n').length} שורות
            </div>
          </div>
        </div>
      )}
    </>
  )
}
