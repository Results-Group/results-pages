/**
 * Aggregation for Google Business Profile metrics.
 *
 * Pure and dependency-free so it can be unit tested against the numbers the
 * Business Profile UI itself reports — which is how the two headline figures
 * below were pinned down before we had API access at all.
 *
 * Google stores one row per location per metric per day, sparsely: a day with
 * no activity is simply absent. Nothing here may assume a dense range.
 */

export interface MetricRow {
  metric: string
  day: string
  value: number
}

export const IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
] as const

export const ACTION_METRICS = [
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'WEBSITE_CLICKS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_BOOKINGS',
  'BUSINESS_FOOD_ORDERS',
  'BUSINESS_FOOD_MENU_CLICKS',
] as const

/** Hebrew labels for the dashboard, matching Business Profile's own wording. */
export const METRIC_LABELS: Record<string, string> = {
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'חיפוש Google — נייד',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'מפות Google — נייד',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'חיפוש Google — מחשב',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'מפות Google — מחשב',
  CALL_CLICKS: 'שיחות',
  BUSINESS_DIRECTION_REQUESTS: 'בקשות מסלול',
  WEBSITE_CLICKS: 'קליקים לאתר',
  BUSINESS_CONVERSATIONS: 'הודעות',
  BUSINESS_BOOKINGS: 'הזמנות',
  BUSINESS_FOOD_ORDERS: 'הזמנות אוכל',
  BUSINESS_FOOD_MENU_CLICKS: 'צפיות בתפריט',
}

const sumOf = (rows: MetricRow[], metrics: readonly string[]): number => {
  const wanted = new Set<string>(metrics)
  return rows.reduce((total, r) => (wanted.has(r.metric) ? total + (Number(r.value) || 0) : total), 0)
}

export interface GbpSummary {
  /** Business Profile's "אנשים צפו בפרופיל" — the sum of the four impressions. */
  views: number
  /** Business Profile's "אינטראקציות" — the sum of every action metric. */
  interactions: number
  calls: number
  directions: number
  websiteClicks: number
  conversations: number
  bookings: number
  menuViews: number
  /** Impressions split by surface, for the platform doughnut. */
  bySurface: { metric: string; label: string; value: number; pct: number }[]
}

export function summarize(rows: MetricRow[]): GbpSummary {
  const views = sumOf(rows, IMPRESSION_METRICS)
  const metric = (m: string) => sumOf(rows, [m])

  return {
    views,
    interactions: sumOf(rows, ACTION_METRICS),
    calls: metric('CALL_CLICKS'),
    directions: metric('BUSINESS_DIRECTION_REQUESTS'),
    websiteClicks: metric('WEBSITE_CLICKS'),
    conversations: metric('BUSINESS_CONVERSATIONS'),
    bookings: metric('BUSINESS_BOOKINGS'),
    // Food orders and menu clicks are one idea to a restaurant owner.
    menuViews: metric('BUSINESS_FOOD_MENU_CLICKS') + metric('BUSINESS_FOOD_ORDERS'),
    bySurface: IMPRESSION_METRICS.map(m => {
      const value = metric(m)
      return {
        metric: m,
        label: METRIC_LABELS[m] ?? m,
        value,
        // Rounded for display; callers charting these should use `value`.
        pct: views > 0 ? Math.round((value / views) * 100) : 0,
      }
    })
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value),
  }
}

/** Percentage change against a previous period. Null when there's no baseline. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const HE_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

/**
 * Monthly totals — the granularity these metrics are actually read at.
 *
 * Profile views and calls move slowly; a daily line is noise dressed as
 * information, and Google's own interface reports them by month. Storage stays
 * daily because that is what the API serves and it lets any date range be cut,
 * but nothing above this function should think in days.
 *
 * Months with no rows are omitted rather than zero-filled: unlike a missing day
 * inside a synced range, a missing month usually means we had not synced yet,
 * and drawing it as zero would invent a collapse that never happened.
 */
export function monthlySeries(
  rows: MetricRow[],
  metrics: readonly string[]
): { month: string; label: string; value: number }[] {
  const wanted = new Set<string>(metrics)
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    if (!wanted.has(r.metric)) continue
    const month = r.day.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + (Number(r.value) || 0))
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const monthIndex = Number(month.slice(5, 7)) - 1
      return { month, label: HE_MONTHS[monthIndex] ?? month, value }
    })
}

/**
 * Daily totals for a chart line. Fills absent days with zero so the series is
 * dense — a gap in Google's response means "no activity", not "unknown", and a
 * chart that skips those days misreads a quiet week as a short one.
 */
export function dailySeries(
  rows: MetricRow[],
  metrics: readonly string[],
  from: string,
  to: string
): { day: string; value: number }[] {
  const wanted = new Set<string>(metrics)
  const byDay = new Map<string, number>()
  for (const r of rows) {
    if (!wanted.has(r.metric)) continue
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + (Number(r.value) || 0))
  }

  const out: { day: string; value: number }[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  // Guard against an inverted range rather than looping forever.
  if (cursor > end) return out
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ day: key, value: byDay.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}
