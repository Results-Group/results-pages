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
  paragraph: boolean
}

export interface DistributionPlan {
  bullets: string[]
  channels: DistributionChannel[]
  /**
   * Legacy free text (the markup-prefix format). Still read so older slides
   * keep rendering, and converted to `doc` the first time one is opened.
   */
  paragraph?: string
  /** Rich text as a structured document — see PlanDoc. */
  doc?: PlanDoc
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
    paragraph: '',
    budgetDisplay: 'both',
    show: { bullets: true, channels: true, budget: true, timeline: false, paragraph: true },
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
    paragraph: typeof plan.paragraph === 'string' ? plan.paragraph : '',
    ...(plan.doc && plan.doc.type === 'doc' ? { doc: plan.doc } : {}),
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
    paragraph: plan.show.paragraph && resolvePlanDoc(plan) !== null,
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
  return v.bullets || v.channels || v.budget || v.timeline || v.paragraph
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

// ── Rich text document ──

/**
 * A ProseMirror/TipTap document, typed structurally so nothing outside the
 * admin editor has to depend on TipTap — the client's deck renders this with a
 * plain React function and never loads the library.
 *
 * The renderer walks these nodes and emits text only. Storing the document
 * rather than HTML is what keeps that guarantee: there is no markup to inject,
 * whatever gets pasted into the editor.
 */
export interface PlanDocNode {
  type: string
  attrs?: { level?: number }
  content?: PlanDocNode[]
  text?: string
  marks?: { type: string }[]
}

export interface PlanDoc {
  type: 'doc'
  content?: PlanDocNode[]
}

const textNode = (text: string, bold = false): PlanDocNode => ({
  type: 'text',
  text,
  ...(bold ? { marks: [{ type: 'bold' }] } : {}),
})

/** Splits `**bold**` runs out of a legacy line into marked text nodes. */
function inlineNodes(text: string): PlanDocNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  if (parts.length === 0) return []
  return parts.map(part =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? textNode(part.slice(2, -2), true)
      : textNode(part),
  )
}

const listItem = (text: string): PlanDocNode => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content: inlineNodes(text) }],
})

/**
 * Converts the legacy prefix-markup text into a document. Runs once, the first
 * time a slide written in the old format is opened in the editor, so nobody has
 * to retype a plan.
 */
export function planTextToDoc(src: string): PlanDoc {
  const content: PlanDocNode[] = []

  for (const node of parsePlanText(src)) {
    if (node.kind === 'heading') {
      content.push({ type: 'heading', attrs: { level: node.level }, content: inlineNodes(node.text) })
      continue
    }
    if (node.kind === 'paragraph') {
      // One block per line. The legacy parser merged consecutive prose lines
      // into a single paragraph, which in a WYSIWYG means styling one line
      // silently restyles its neighbours — and the text ran together, since a
      // document node has no notion of a newline inside it.
      for (const line of node.text.split('\n')) {
        if (line.trim()) content.push({ type: 'paragraph', content: inlineNodes(line) })
      }
      continue
    }
    // A depth-1 item belongs to a nested list inside the item above it.
    const items: PlanDocNode[] = []
    for (const item of node.items) {
      if (item.depth > 0 && items.length > 0) {
        const parent = items[items.length - 1]
        const nested = parent.content?.find(c => c.type === 'bulletList')
        if (nested) nested.content?.push(listItem(item.text))
        else parent.content?.push({ type: 'bulletList', content: [listItem(item.text)] })
      } else {
        items.push(listItem(item.text))
      }
    }
    content.push({ type: 'bulletList', content: items })
  }

  return { type: 'doc', content }
}

/** True when the document holds no visible text. */
export function docIsEmpty(doc?: PlanDoc | null): boolean {
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) return true
  const hasText = (nodes: PlanDocNode[]): boolean =>
    nodes.some(n => (typeof n.text === 'string' && n.text.trim().length > 0) || (n.content ? hasText(n.content) : false))
  return !hasText(doc.content)
}

/** Flattens a document to plain text — used for previews and summaries. */
export function docPlainText(doc?: PlanDoc | null): string {
  if (!doc?.content) return ''
  const walk = (nodes: PlanDocNode[]): string =>
    nodes.map(n => (typeof n.text === 'string' ? n.text : '') + (n.content ? ` ${walk(n.content)}` : '')).join(' ')
  return walk(doc.content).replace(/\s+/g, ' ').trim()
}

/** The document to render: the rich one if present, else the legacy text. */
export function resolvePlanDoc(plan: Pick<DistributionPlan, 'doc' | 'paragraph'>): PlanDoc | null {
  if (!docIsEmpty(plan.doc)) return plan.doc as PlanDoc
  const legacy = (plan.paragraph || '').trim()
  return legacy ? planTextToDoc(legacy) : null
}

// ── Free-text block ──

export type PlanTextNode =
  | { kind: 'heading'; text: string; level: 1 | 2 | 3 }
  | { kind: 'paragraph'; text: string; small?: boolean }
  | { kind: 'list'; items: { text: string; depth: number }[] }

const BULLET_RE = /^(\s*)(?:[*\-•]|\d+[.)])\s+(.*)$/
const HASH_RE = /^(#{1,3})\s+(.*)$/
const SMALL_RE = /^>\s+(.*)$/
/** A line ending in one of these is prose, never a heading. */
const SENTENCE_END = /[.:,;!?%₪)]$/
/** Auto-heading only applies below this length. */
const AUTO_HEADING_MAX = 32
/** How many non-empty lines to scan for the bullet list that confirms a heading. */
const AUTO_HEADING_LOOKAHEAD = 2

/**
 * Parses a pasted media plan into headings, lists and paragraphs.
 *
 * Deliberately a tiny subset, not a markdown library: operators paste plans out
 * of a doc or a chat, where the only structure that survives is "* " bullets,
 * indentation, and short standalone lines acting as section headings. Pulling in
 * a full markdown parser would also mean sanitising raw HTML — this renders
 * text only, so nothing pasted can inject markup.
 *
 * "# / ## / ###" always force a heading and "> " marks small print — the editor
 * has buttons for both, so the operator has the final say.
 *
 * Auto-detection is deliberately narrow: a short line becomes a heading ONLY
 * when a bullet follows it. An earlier version promoted any short line without
 * sentence-ending punctuation, which turned a plain list of KPIs ("עלות לליד",
 * "מעל 3.2%") into a wall of bold headings.
 */
export function parsePlanText(src: string): PlanTextNode[] {
  const lines = (src || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\t/g, '   '))
  const nodes: PlanTextNode[] = []
  let list: { text: string; depth: number }[] = []
  let para: string[] = []

  const flushList = () => { if (list.length) { nodes.push({ kind: 'list', items: list }); list = [] } }
  const flushPara = () => { if (para.length) { nodes.push({ kind: 'paragraph', text: para.join('\n') }); para = [] } }
  const flush = () => { flushList(); flushPara() }

  /**
   * Does a bullet list open just below this line? That's what marks a short
   * line as a section heading. The lookahead spans a few lines because a
   * heading is often followed by a lead-in ("חלוקה ל-3 סגמנטים:") before the
   * bullets start.
   */
  const bulletFollows = (from: number): boolean => {
    let seen = 0
    for (let i = from + 1; i < lines.length && seen < AUTO_HEADING_LOOKAHEAD; i++) {
      if (!lines[i].trim()) continue
      if (BULLET_RE.test(lines[i])) return true
      seen++
    }
    return false
  }

  lines.forEach((line, idx) => {
    if (!line.trim()) { flush(); return }

    const bullet = line.match(BULLET_RE)
    if (bullet) {
      flushPara()
      // One level of nesting is enough for a media plan, and guessing deeper
      // from ragged pasted indentation produces noise.
      list.push({ text: bullet[2].trim(), depth: bullet[1].length >= 2 ? 1 : 0 })
      return
    }

    const hash = line.match(HASH_RE)
    if (hash) {
      flush()
      nodes.push({ kind: 'heading', text: hash[2].trim(), level: hash[1].length as 1 | 2 | 3 })
      return
    }

    const small = line.trim().match(SMALL_RE)
    if (small) { flush(); nodes.push({ kind: 'paragraph', text: small[1].trim(), small: true }); return }

    const trimmed = line.trim()
    if (trimmed.length <= AUTO_HEADING_MAX && !SENTENCE_END.test(trimmed) && bulletFollows(idx)) {
      flush()
      nodes.push({ kind: 'heading', text: trimmed, level: 2 })
      return
    }

    flushList()
    para.push(trimmed)
  })

  flush()
  return nodes
}

/** ₪ with thousands separators, no decimals. */
export function formatBudget(amount: number): string {
  return `₪${Math.round(amount).toLocaleString('en-US')}`
}

export function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`
}
