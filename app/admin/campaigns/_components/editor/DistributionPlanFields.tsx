'use client'

import { useRef } from 'react'
import { Plus, X, GripVertical, AlertTriangle, Bold, Heading1, Heading2, Heading3, List, ListTree, Pilcrow, Type } from 'lucide-react'
import {
  normalizePlan,
  newDistributionChannel,
  percentWarning,
  DEFAULT_TOTAL_LABEL,
  type DistributionPlan,
  type DistributionChannel,
  type BudgetDisplay,
} from '@/lib/distribution'

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-hover-bg)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
  colorScheme: 'var(--color-scheme)',
}

const BLOCK_LABELS: { key: keyof DistributionPlan['show']; label: string }[] = [
  { key: 'bullets', label: 'אסטרטגיה (בולטים)' },
  { key: 'channels', label: 'טבלת ערוצים' },
  { key: 'budget', label: 'חלוקת תקציב' },
  { key: 'timeline', label: 'ציר זמן' },
  { key: 'paragraph', label: 'פסקת טקסט' },
]

const BUDGET_MODES: { value: BudgetDisplay; label: string }[] = [
  { value: 'both', label: 'שקלים ואחוזים' },
  { value: 'amount', label: 'שקלים בלבד' },
  { value: 'percent', label: 'אחוזים בלבד' },
]

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
      {children}
    </label>
  )
}

/**
 * Inspector panel for a 'distribution' slide. The operator enters bullets and
 * channels once; the budget chart and timeline on the slide are derived from
 * the same channel rows, so there is nothing to keep in sync by hand.
 */
export default function DistributionPlanFields({
  plan,
  onChange,
}: {
  plan?: DistributionPlan | null
  onChange: (plan: DistributionPlan) => void
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const p = normalizePlan(plan)
  const warning = percentWarning(p.channels)

  const patch = (next: Partial<DistributionPlan>) => onChange({ ...p, ...next })

  function updateChannel(id: string, next: Partial<DistributionChannel>) {
    patch({ channels: p.channels.map(c => (c.id === id ? { ...c, ...next } : c)) })
  }

  /** '' clears the field rather than storing NaN. */
  function numberOrUndefined(value: string): number | undefined {
    if (value.trim() === '') return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  return (
    <div className="space-y-5">
      {/* Which blocks the client sees */}
      <div>
        <Label>מה להציג בשקף</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {BLOCK_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => patch({ show: { ...p.show, [key]: !p.show[key] } })}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-bold text-right transition-all duration-200"
              style={p.show[key]
                ? { background: 'rgba(64,225,211,0.12)', color: '#40e1d3', border: '1px solid rgba(64,225,211,0.3)' }
                : { background: 'var(--admin-hover-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }
              }
            >
              <span
                className="w-3.5 h-3.5 rounded shrink-0"
                style={p.show[key]
                  ? { background: '#40e1d3' }
                  : { border: '1px solid var(--admin-border)' }
                }
              />
              <span className="flex-1 min-w-0">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bullets */}
      <div>
        <Label>בולטים — אסטרטגיה</Label>
        <div className="space-y-1.5">
          {p.bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={b}
                dir="auto"
                placeholder="לדוגמה: דגש על וידאו קצר בחודש הראשון"
                onChange={e => patch({ bullets: p.bullets.map((x, j) => (j === i ? e.target.value : x)) })}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs outline-none transition-all duration-200"
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={() => patch({ bullets: p.bullets.filter((_, j) => j !== i) })}
                className="p-1.5 rounded-lg shrink-0"
                style={{ color: 'var(--admin-text-muted)' }}
                aria-label="מחיקת בולט"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch({ bullets: [...p.bullets, ''] })}
          className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
          style={{ color: 'var(--admin-text-secondary)', background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}
        >
          <Plus className="w-3.5 h-3.5" /> הוספת בולט
        </button>
      </div>

      {/* Channels */}
      <div>
        <Label>ערוצי הפצה</Label>
        <div className="space-y-2.5">
          {p.channels.map((c, i) => (
            <div key={c.id} className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--admin-text-muted)' }} />
                <input
                  type="text"
                  value={c.name}
                  dir="auto"
                  placeholder="שם הערוץ (Meta, Google...)"
                  onChange={e => updateChannel(c.id, { name: e.target.value })}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-xs font-bold outline-none"
                  style={fieldStyle}
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => { if (i > 0) patch({ channels: reorder(p.channels, i, i - 1) }) }}
                    disabled={i === 0}
                    className="px-1.5 py-1 rounded text-[11px] font-bold disabled:opacity-25"
                    style={{ color: 'var(--admin-text-muted)' }}
                    aria-label="הזזה למעלה"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => { if (i < p.channels.length - 1) patch({ channels: reorder(p.channels, i, i + 1) }) }}
                    disabled={i === p.channels.length - 1}
                    className="px-1.5 py-1 rounded text-[11px] font-bold disabled:opacity-25"
                    style={{ color: 'var(--admin-text-muted)' }}
                    aria-label="הזזה למטה"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => patch({ channels: p.channels.filter(x => x.id !== c.id) })}
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--admin-text-muted)' }}
                    aria-label="מחיקת ערוץ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number" min={0} inputMode="numeric"
                  value={c.budget ?? ''}
                  placeholder="תקציב ₪"
                  onChange={e => updateChannel(c.id, { budget: numberOrUndefined(e.target.value) })}
                  className="px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
                />
                <input
                  type="number" min={0} max={100} inputMode="numeric"
                  value={c.percent ?? ''}
                  placeholder="% (אוטומטי)"
                  title="ריק = מחושב אוטומטית מהתקציב"
                  onChange={e => updateChannel(c.id, { percent: numberOrUndefined(e.target.value) })}
                  className="px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
                />
              </div>

              <input
                type="text" value={c.formats ?? ''} dir="auto" placeholder="פורמטים (פוסטים, סטוריז...)"
                onChange={e => updateChannel(c.id, { formats: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
              />
              <input
                type="text" value={c.audience ?? ''} dir="auto" placeholder="קהל יעד"
                onChange={e => updateChannel(c.id, { audience: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
              />

              {p.show.timeline && (
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date" value={c.start ?? ''}
                    onChange={e => updateChannel(c.id, { start: e.target.value })}
                    className="px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
                  />
                  <input
                    type="date" value={c.end ?? ''}
                    onChange={e => updateChannel(c.id, { end: e.target.value })}
                    className="px-2.5 py-2 rounded-lg text-xs outline-none" style={fieldStyle}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => patch({ channels: [...p.channels, newDistributionChannel()] })}
          className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
          style={{ color: 'var(--admin-text-secondary)', background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}
        >
          <Plus className="w-3.5 h-3.5" /> הוספת ערוץ
        </button>

        {/* Soft warning only — 90% allocated plus a reserve is a real plan. */}
        {warning && (
          <p className="flex items-center gap-1.5 mt-2 text-[11px] font-bold" style={{ color: '#F3D56D' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {warning}
          </p>
        )}
      </div>

      {/* Budget display */}
      <div>
        <Label>תצוגת תקציב</Label>
        <select
          value={p.budgetDisplay}
          onChange={e => patch({ budgetDisplay: e.target.value as BudgetDisplay })}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={fieldStyle}
        >
          {BUDGET_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <Label>טקסט חופשי</Label>
        <TextStyleToolbar
          textareaRef={textRef}
          value={p.paragraph ?? ''}
          onChange={next => patch({ paragraph: next })}
        />
        <textarea
          ref={textRef}
          value={p.paragraph ?? ''}
          dir="auto"
          rows={14}
          placeholder={'הדבק כאן תוכנית שלמה, ואז סמן שורות והחל סגנון מהכפתורים למעלה.'}
          onChange={e => patch({ paragraph: e.target.value })}
          className="w-full px-3 py-2.5 rounded-b-lg text-sm outline-none resize-y leading-relaxed"
          style={{ ...fieldStyle, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}
        />
        <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
          הכפתורים פועלים על השורה שהסמן עליה, או על כל השורות שסימנת.
        </p>
      </div>

      <div>
        <Label>תווית סה&quot;כ</Label>
        <input
          type="text"
          value={p.totalLabel ?? ''}
          dir="auto"
          placeholder={DEFAULT_TOTAL_LABEL}
          onChange={e => patch({ totalLabel: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>
    </div>
  )
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// ── Text style toolbar ──

/** Every line-level prefix the parser understands, so a restyle replaces
 *  cleanly instead of stacking "## * " on top of what was already there. */
const LINE_PREFIX_RE = /^(\s*)(?:#{1,3}\s+|>\s+|(?:[*\-•]|\d+[.)])\s+)?/

const LINE_STYLES: { label: string; title: string; icon: React.ReactNode; prefix: string }[] = [
  { label: 'כותרת', title: 'כותרת גדולה', icon: <Heading1 className="w-3.5 h-3.5" />, prefix: '# ' },
  { label: 'משנה', title: 'כותרת משנה', icon: <Heading2 className="w-3.5 h-3.5" />, prefix: '## ' },
  { label: 'קטנה', title: 'כותרת קטנה', icon: <Heading3 className="w-3.5 h-3.5" />, prefix: '### ' },
  { label: 'רגיל', title: 'טקסט רגיל', icon: <Pilcrow className="w-3.5 h-3.5" />, prefix: '' },
  { label: 'קטן', title: 'טקסט קטן ומעומעם', icon: <Type className="w-3 h-3" />, prefix: '> ' },
  { label: 'בולט', title: 'בולט', icon: <List className="w-3.5 h-3.5" />, prefix: '* ' },
  { label: 'תת-בולט', title: 'תת-בולט', icon: <ListTree className="w-3.5 h-3.5" />, prefix: '   * ' },
]

function TextStyleToolbar({ textareaRef, value, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
}) {
  /** Applies a prefix to every line the selection touches. */
  function applyPrefix(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    const lines = value.split('\n')

    // Map the caret offsets onto line indexes.
    let offset = 0
    let firstLine = 0
    let lastLine = 0
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = offset + lines[i].length
      if (offset <= start && start <= lineEnd) firstLine = i
      if (offset <= end && end <= lineEnd) { lastLine = i; break }
      lastLine = i
      offset = lineEnd + 1
    }

    const next = lines.map((line, i) => {
      if (i < firstLine || i > lastLine) return line
      if (!line.trim()) return line
      // Strip whatever prefix is there, then apply the new one. Without the
      // strip, restyling a bullet as a heading produced "## * ...".
      return line.replace(LINE_PREFIX_RE, '') === '' ? line : prefix + line.replace(LINE_PREFIX_RE, '')
    }).join('\n')

    onChange(next)
    requestAnimationFrame(() => el.focus())
  }

  /** Wraps the selected words in ** **, or unwraps them if already bold. */
  function toggleBold() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    if (start === end) { el.focus(); return }
    const selected = value.slice(start, end)
    const isBold = selected.startsWith('**') && selected.endsWith('**') && selected.length > 4
    const replacement = isBold ? selected.slice(2, -2) : `**${selected}**`
    onChange(value.slice(0, start) + replacement + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, start + replacement.length)
    })
  }

  const btnStyle: React.CSSProperties = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-secondary)',
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 p-1.5 rounded-t-lg"
      style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)', borderBottom: 'none' }}
    >
      {LINE_STYLES.map(s => (
        <button
          key={s.label}
          type="button"
          title={s.title}
          onMouseDown={e => e.preventDefault()} // keep the textarea selection alive
          onClick={() => applyPrefix(s.prefix)}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-colors"
          style={btnStyle}
        >
          {s.icon}{s.label}
        </button>
      ))}
      <span className="w-px h-5 mx-0.5" style={{ background: 'var(--admin-border)' }} />
      <button
        type="button"
        title="מודגש — סמן מילים ולחץ"
        onMouseDown={e => e.preventDefault()}
        onClick={toggleBold}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-colors"
        style={btnStyle}
      >
        <Bold className="w-3.5 h-3.5" />מודגש
      </button>
    </div>
  )
}
