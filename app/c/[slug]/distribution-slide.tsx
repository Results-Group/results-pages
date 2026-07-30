'use client'

// Imported here as well as in presentation.tsx so the admin editor's canvas,
// which renders this component directly, gets the same styles. The bundler
// dedupes the second import.
import './presentation.css'
import {
  normalizePlan,
  visibleBlocks,
  resolvePercents,
  totalBudget,
  buildTimeline,
  formatBudget,
  formatPercent,
  parsePlanText,
  DEFAULT_TOTAL_LABEL,
  type DistributionPlan,
  type DistributionChannel,
} from '@/lib/distribution'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * The distribution-plan slide. Rendered by BOTH the public deck and the admin
 * editor's canvas — the editor must never grow its own copy of this layout, or
 * what the operator approves drifts from what the client receives.
 */
export default function DistributionSlide({
  plan,
  title,
  description,
  lang = 'he',
}: {
  plan?: DistributionPlan | null
  title?: string
  description?: string
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key

  const p = normalizePlan(plan)
  const blocks = visibleBlocks(p)
  const percents = resolvePercents(p.channels)
  const channels = p.channels.filter(c => (c.name || '').trim().length > 0)
  const total = totalBudget(p.channels)
  const timeline = blocks.timeline ? buildTimeline(p.channels) : null

  // When both blocks are on, the bar lives inside the table row — two separate
  // renderings of the same number stacked on one screen just read as noise.
  const barsInTable = blocks.channels && blocks.budget
  const hasFormats = channels.some(c => (c.formats || '').trim())
  const hasAudience = channels.some(c => (c.audience || '').trim())

  function budgetValue(c: DistributionChannel): string {
    const pct = percents.get(c.id) || 0
    const amount = typeof c.budget === 'number' && c.budget > 0 ? formatBudget(c.budget) : ''
    const pctText = pct > 0 ? formatPercent(pct) : ''
    if (p.budgetDisplay === 'amount') return amount
    if (p.budgetDisplay === 'percent') return pctText
    return [amount, pctText].filter(Boolean).join(' · ')
  }

  return (
    <div className="dist-slide">
      {title && <h2 className="slide-title rp-anim rp-in rp-d1">{title}</h2>}
      {description && <p className="dist-intro rp-anim rp-up rp-d1">{description}</p>}

      {blocks.bullets && (
        <ul className="dist-bullets rp-anim rp-up rp-d2">
          {p.bullets.filter(b => b.trim()).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {blocks.channels && (
        <div className="dist-table rp-anim rp-up rp-d2">
          <div className="dist-row dist-head">
            <span className="dist-cell dist-name">{t('public.dist.channel')}</span>
            {hasFormats && <span className="dist-cell">{t('public.dist.formats')}</span>}
            {hasAudience && <span className="dist-cell">{t('public.dist.audience')}</span>}
            {blocks.budget && <span className="dist-cell dist-budget-col">{t('public.dist.budget')}</span>}
          </div>

          {channels.map(c => (
            <div className="dist-row" key={c.id}>
              <span className="dist-cell dist-name">{c.name}</span>
              {hasFormats && (
                <span className="dist-cell" data-label={t('public.dist.formats')}>{c.formats || '—'}</span>
              )}
              {hasAudience && (
                <span className="dist-cell" data-label={t('public.dist.audience')}>{c.audience || '—'}</span>
              )}
              {blocks.budget && (
                <span className="dist-cell dist-budget-col" data-label={t('public.dist.budget')}>
                  {barsInTable && (
                    <span className="dist-bar-track">
                      <span className="dist-bar-fill" style={{ width: `${Math.min(percents.get(c.id) || 0, 100)}%` }} />
                    </span>
                  )}
                  <span className="dist-budget-value">{budgetValue(c) || '—'}</span>
                </span>
              )}
            </div>
          ))}

          {blocks.budget && total > 0 && p.budgetDisplay !== 'percent' && (
            <div className="dist-row dist-total">
              <span className="dist-cell dist-name">{p.totalLabel || DEFAULT_TOTAL_LABEL}</span>
              {hasFormats && <span className="dist-cell" />}
              {hasAudience && <span className="dist-cell" />}
              <span className="dist-cell dist-budget-col">
                <span className="dist-budget-value">{formatBudget(total)}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Budget on its own: the table is hidden, so the bars carry the names. */}
      {blocks.budget && !blocks.channels && (
        <div className="dist-bars rp-anim rp-up rp-d2">
          <h3 className="dist-block-title">{t('public.dist.budgetSplit')}</h3>
          {channels.map(c => (
            <div className="dist-bar-row" key={c.id}>
              <span className="dist-bar-name">{c.name}</span>
              <span className="dist-bar-track">
                <span className="dist-bar-fill" style={{ width: `${Math.min(percents.get(c.id) || 0, 100)}%` }} />
              </span>
              <span className="dist-budget-value">{budgetValue(c)}</span>
            </div>
          ))}
          {total > 0 && p.budgetDisplay !== 'percent' && (
            <p className="dist-total-line">
              {p.totalLabel || DEFAULT_TOTAL_LABEL}: <strong>{formatBudget(total)}</strong>
            </p>
          )}
        </div>
      )}

      {timeline && timeline.lanes.length > 0 && (
        <div className="dist-timeline rp-anim rp-up rp-d3">
          <h3 className="dist-block-title">{t('public.dist.timeline')}</h3>
          <div className="dist-ticks">
            {timeline.ticks.map((tick, i) => (
              // RTL slide, left-to-right time axis: position from the left edge
              // so the earliest month sits where a reader of a Gantt expects it.
              <span key={i} className="dist-tick" style={{ left: `${tick.offset}%` }}>{tick.label}</span>
            ))}
          </div>
          {timeline.lanes.map(lane => (
            <div className="dist-lane" key={lane.id}>
              <span className="dist-lane-name">{lane.name}</span>
              <span className="dist-lane-track">
                <span
                  className="dist-lane-fill"
                  style={{ left: `${lane.offset}%`, width: `${lane.width}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Free text — a plan pasted in whole: headings, nested bullets, prose.
          Closes the slide, since the section description sits above the table. */}
      {blocks.paragraph && <PlanText source={p.paragraph || ''} />}
    </div>
  )
}

/** Renders **bold** runs; everything else stays plain text. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  )
}

/**
 * The free-text block: a whole plan pasted in, rendered as headings, nested
 * bullets and prose. Centred on the slide with the text itself right-aligned.
 */
function PlanText({ source }: { source: string }) {
  const nodes = parsePlanText(source)
  if (nodes.length === 0) return null
  return (
    <div className="dist-text rp-anim rp-up rp-d3" dir="rtl">
      {nodes.map((node, i) => {
        if (node.kind === 'heading') return <h3 key={i} className="dist-text-h">{inline(node.text)}</h3>
        if (node.kind === 'paragraph') return <p key={i} className="dist-text-p">{inline(node.text)}</p>
        return (
          <ul key={i} className="dist-text-list">
            {node.items.map((item, j) => (
              <li key={j} className={item.depth > 0 ? 'is-nested' : undefined}>{inline(item.text)}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
