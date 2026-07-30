/**
 * Distribution-plan slide: types + pure helpers.
 *
 * Client-safe (no `server-only`, no supabase/sharp imports) — both the admin
 * editor and the public presentation import this module, same as lib/copies.ts.
 *
 * The plan holds exactly two inputs — bullets and channels. The budget chart
 * and the timeline are *derived* from the channels, so the operator never types
 * the same number twice and the table can't disagree with the chart.
 */

export interface DistributionChannel {
  id: string
  /** "Meta", "Google Search", "TikTok" */
  name: string
  /** Monthly spend in ₪. */
  budget?: number
  /** Manual override. Left empty, the share is derived from `budget`. */
  percent?: number
  /** "פוסטים, סטוריז, רילס" */
  formats?: string
  /** "נשים 25-45, מרכז" */
  audience?: string
  /** ISO date (YYYY-MM-DD). Free-text labels are deliberately not accepted —
   *  a proportional timeline needs dates that parse. */
  start?: string
  end?: string
}

export type BudgetDisplay = 'amount' | 'percent' | 'both'

export interface DistributionBlocks {
  bullets: boolean
  channels: boolean
  budget: boolean
  timeline: boolean
}

export interface DistributionPlan {
  bullets: string[]
  channels: DistributionChannel[]
  budgetDisplay: BudgetDisplay
  /** Which blocks the client sees. Not every plan needs all four. */
  show: DistributionBlocks
  totalLabel?: string
}

export const DEFAULT_TOTAL_LABEL = 'סה"כ חודשי'

export function newDistributionPlan(): DistributionPlan {
  return {
    bullets: [],
    channels: [],
    budgetDisplay: 'both',
    show: { bullets: true, channels: true, budget: true, timeline: false },
    totalLabel: DEFAULT_TOTAL_LABEL,
  }
}

export function newDistributionChannel(): DistributionChannel {
  return { id: crypto.randomUUID(), name: '' }
}

/** Tolerates rows loaded from JSONB that predate a field, or were hand-edited. */
export function normalizePlan(plan?: DistributionPlan | null): DistributionPlan {
  const base = newDistributionPlan()
  if (!plan || typeof plan !== 'object') return base
  return {
    bullets: Array.isArray(plan.bullets) ? plan.bullets.filter(b => typeof b === 'string') : [],
    channels: Array.isArray(plan.channels) ? plan.channels.filter(c => c && typeof c.id === 'string') : [],
    budgetDisplay: plan.budgetDisplay === 'amount' || plan.budgetDisplay === 'percent' ? plan.budgetDisplay : 'both',
    show: { ...base.show, ...(plan.show || {}) },
    totalLabel: typeof plan.totalLabel === 'string' ? plan.totalLabel : DEFAULT_TOTAL_LABEL,
  }
}

function isPositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

export function totalBudget(channels: DistributionChannel[]): number {
  return channels.reduce((sum, c) => sum + (isPositive(c.budget) ? c.budget : 0), 0)
}

/**
 * Share of spend per channel id, in percent.
 * A manually entered `percent` wins; otherwise it's derived from `budget`.
 * Channels with neither return 0 — they still belong in the table, just not in
 * the chart.
 */
export function resolvePercents(channels: DistributionChannel[]): Map<string, number> {
  const total = totalBudget(channels)
  const out = new Map<string, number>()
  for (const c of channels) {
    if (isPositive(c.percent)) out.set(c.id, c.percent)
    else if (total > 0 && isPositive(c.budget)) out.set(c.id, (c.budget / total) * 100)
    else out.set(c.id, 0)
  }
  return out
}

const namedChannels = (channels: DistributionChannel[]) =>
  channels.filter(c => (c.name || '').trim().length > 0)

/** A channel appears on the timeline only with two dates that parse, in order. */
export function hasTimelineDates(c: DistributionChannel): boolean {
  const s = parseDate(c.start)
  const e = parseDate(c.end)
  return s !== null && e !== null && e >= s
}

function parseDate(value?: string): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export interface TimelineLane {
  id: string
  name: string
  /** Percent offsets within the timeline's full span. */
  offset: number
  width: number
}

export interface Timeline {
  lanes: TimelineLane[]
  /** Month labels across the span, evenly spaced by date. */
  ticks: { label: string; offset: number }[]
}

// Formatted from a fixed table rather than toLocaleDateString: this component
// renders on the server and hydrates in the browser, and the two ICU builds
// don't always produce the same Hebrew month abbreviation — which React reports
// as a hydration mismatch.
const HE_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

export function buildTimeline(channels: DistributionChannel[]): Timeline | null {
  const dated = namedChannels(channels).filter(hasTimelineDates)
  if (dated.length === 0) return null

  const starts = dated.map(c => parseDate(c.start) as number)
  const ends = dated.map(c => parseDate(c.end) as number)
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  const span = max - min

  const lanes: TimelineLane[] = dated.map((c, i) => ({
    id: c.id,
    name: c.name.trim(),
    // A plan where every channel runs the identical window has zero span —
    // show full-width bars rather than dividing by zero.
    offset: span > 0 ? ((starts[i] - min) / span) * 100 : 0,
    width: span > 0 ? Math.max(((ends[i] - starts[i]) / span) * 100, 2) : 100,
  }))

  const ticks: { label: string; offset: number }[] = []
  const cursor = new Date(min)
  cursor.setDate(1)
  for (let guard = 0; guard < 36; guard++) {
    const t = cursor.getTime()
    if (t > max) break
    if (t >= min) {
      ticks.push({
        label: HE_MONTHS[cursor.getMonth()],
        offset: span > 0 ? ((t - min) / span) * 100 : 0,
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return { lanes, ticks }
}

/** Which blocks actually have something to render. */
export function visibleBlocks(plan: DistributionPlan): DistributionBlocks {
  const named = namedChannels(plan.channels)
  const percents = resolvePercents(plan.channels)
  return {
    bullets: plan.show.bullets && plan.bullets.some(b => b.trim().length > 0),
    channels: plan.show.channels && named.length > 0,
    budget: plan.show.budget && named.some(c => (percents.get(c.id) || 0) > 0),
    timeline: plan.show.timeline && named.some(hasTimelineDates),
  }
}

/**
 * Whether the slide produces anything at all. An empty distribution section
 * renders zero slides — the client never lands on a blank screen, and the
 * editor's slide counter says the same number.
 */
export function hasVisibleContent(plan?: DistributionPlan | null): boolean {
  if (!plan) return false
  const v = visibleBlocks(normalizePlan(plan))
  return v.bullets || v.channels || v.budget || v.timeline
}

/**
 * Editor-only soft warning. Not a block: a plan that allocates 90% and keeps a
 * reserve is legitimate.
 */
export function percentWarning(channels: DistributionChannel[]): string | null {
  const named = namedChannels(channels)
  if (named.length === 0) return null
  const percents = resolvePercents(channels)
  const sum = named.reduce((s, c) => s + (percents.get(c.id) || 0), 0)
  if (sum === 0) return null
  const rounded = Math.round(sum)
  if (rounded === 100) return null
  return `האחוזים מסתכמים ל-${rounded}%`
}

/** ₪ with thousands separators, no decimals. */
export function formatBudget(amount: number): string {
  return `₪${Math.round(amount).toLocaleString('en-US')}`
}

export function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`
}
