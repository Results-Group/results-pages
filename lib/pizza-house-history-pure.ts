/**
 * Completing the till's totals with our stored daily history. Pure,
 * node-testable. See pizza-house-snapshot.ts for how the history is kept.
 *
 * The POS purges deals after ~5 weeks, so any range reaching further back —
 * "previous month", "30 days" compared with the 30 before it — used to sum
 * only the part the till still held: August 2026 read as 18–31.8, and every
 * "vs previous period" delta on a 30-day view was inflated by comparing a
 * full month with half of one. pizza_daily_stats has kept every closed day's
 * orders and revenue since 22.7.2026.
 *
 * The rule is a strict split at the till's oldest held day: days before it
 * come from the stored history, that day onward from the till exactly as
 * today. The till purges whole days (its oldest day on 26.9.2026 started at
 * a normal 11:42 opening and matched the stored count), so nothing is
 * counted twice or lost at the seam.
 *
 * Only orders, revenue and average basket can be completed — that is all the
 * history holds. Delivery split, customers, products stay till-only, and the
 * coverage block tells the UI to say so.
 */

export interface DayTotal { day: string; orders: number; revenue: number }

export interface Totals { orders: number; revenue: number }

/**
 * Stored totals for the range's days that precede the till window: [from, to]
 * AND before posFirstDay. Both bounds matter — a period that ends before the
 * till window (July, as the comparison for August) must not borrow the
 * August days between its end and the till's first day. It did, once: July
 * read as 948 orders when 317 were stored.
 */
export function historicalTotals(stored: DayTotal[], from: string, to: string, posFirstDay: string): Totals {
  let orders = 0
  let revenue = 0
  for (const d of stored) {
    if (d.day >= from && d.day <= to && d.day < posFirstDay) { orders += d.orders; revenue += d.revenue }
  }
  return { orders, revenue: Math.round(revenue * 100) / 100 }
}

/** The till's summary with the stored days added; avg_order recomputed. Never mutates. */
export function withHistory<S extends Record<string, unknown>>(summary: S, extra: Totals): S {
  if (!extra.orders && !extra.revenue) return summary
  const orders = Number(summary.orders ?? 0) + extra.orders
  const revenue = Math.round((Number(summary.revenue ?? 0) + extra.revenue) * 100) / 100
  return { ...summary, orders, revenue, avg_order: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0 }
}

/** Monday of the day's week — the bucket the till's weekly series uses (WEEKDAY() = 0 on Monday). */
export function weekBucket(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export interface Point { bucket: string; revenue: number; orders: number }

/**
 * The till's chart points plus the stored days in [from, to] before the till
 * window, in the same buckets. Hourly charts are left alone: the history is
 * per day.
 */
export function mergeTimeseries(
  points: Point[],
  stored: DayTotal[],
  from: string,
  to: string,
  posFirstDay: string,
  granularity: string,
): Point[] {
  if (granularity !== 'day' && granularity !== 'week') return points
  const merged = new Map(points.map(p => [p.bucket, { ...p, revenue: Number(p.revenue), orders: Number(p.orders) }]))
  for (const d of stored) {
    if (d.day < from || d.day > to || d.day >= posFirstDay) continue
    const bucket = granularity === 'week' ? weekBucket(d.day) : d.day
    const cur = merged.get(bucket) ?? { bucket, revenue: 0, orders: 0 }
    cur.revenue = Math.round((cur.revenue + d.revenue) * 100) / 100
    cur.orders += d.orders
    merged.set(bucket, cur)
  }
  return [...merged.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
}

export interface Coverage {
  /** First day the till holds — detail (delivery, customers, products) starts here. */
  detail_from: string | null
  /** First day orders/revenue are known at all (stored history, else the till). */
  totals_from: string | null
  /** The requested range starts before the till's detail. */
  range_detail_partial: boolean
  /** The previous period starts before the till's detail — its detail deltas are not comparable. */
  prev_detail_partial: boolean
  /** Even orders/revenue do not reach the start of the range. */
  range_totals_partial: boolean
  /** Even orders/revenue do not reach the start of the previous period — its revenue/orders deltas are not comparable. */
  prev_totals_partial: boolean
}

export function coverageFor(from: string, prevFrom: string, posFirstDay: string | null, storedFirstDay: string | null): Coverage {
  const totalsFrom = [storedFirstDay, posFirstDay].filter((d): d is string => !!d).sort()[0] ?? null
  return {
    detail_from: posFirstDay,
    totals_from: totalsFrom,
    range_detail_partial: !!posFirstDay && from < posFirstDay,
    prev_detail_partial: !!posFirstDay && prevFrom < posFirstDay,
    range_totals_partial: !!totalsFrom && from < totalsFrom,
    prev_totals_partial: !!totalsFrom && prevFrom < totalsFrom,
  }
}

/** The all-branches view is only as covered as its least-covered branch. */
export function combineCoverage(list: Coverage[]): Coverage {
  const latest = (ds: (string | null)[]) => (ds.every(Boolean) ? (ds as string[]).sort().slice(-1)[0] : null)
  return {
    detail_from: latest(list.map(c => c.detail_from)),
    totals_from: latest(list.map(c => c.totals_from)),
    range_detail_partial: list.some(c => c.range_detail_partial),
    prev_detail_partial: list.some(c => c.prev_detail_partial),
    range_totals_partial: list.some(c => c.range_totals_partial),
    prev_totals_partial: list.some(c => c.prev_totals_partial),
  }
}
