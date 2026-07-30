'use client'

import { Plus, X, GripVertical, AlertTriangle } from 'lucide-react'
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
        <textarea
          value={p.paragraph ?? ''}
          dir="auto"
          rows={12}
          placeholder={'הדבק כאן תוכנית שלמה.\n\nMeta\n* קהל חדש: פנייה לאנשים שלא מכירים את המותג.\n   * החרגות: מי שכבר ביצע מעורבות.\n\nחלוקת תקציב\nבשבועיים הראשונים 50% Meta ו-50% Google.'}
          onChange={e => patch({ paragraph: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y leading-relaxed"
          style={fieldStyle}
        />
        <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
          שורה שמתחילה ב-* היא בולט, והזחה של רווחים לפניה יוצרת תת-בולט.
          שורה קצרה בלי נקודה בסוף הופכת לכותרת (אפשר גם ## לכפות). **טקסט** = מודגש.
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
