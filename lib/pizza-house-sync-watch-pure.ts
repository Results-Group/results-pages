/**
 * "A branch that normally trades on this weekday recorded (almost) nothing."
 * Pure, so the rule can be tested and replayed against history.
 *
 * Mevaseret's till showed nothing for 10, 14 and 15 September 2026 — ordinary
 * working days, Giv'at Ze'ev open as usual — and nobody noticed for a week.
 * The POS purges after ~5 weeks, so a gap that is not caught while the till
 * still holds the day is a gap forever.
 */

export interface DayCount { day: string; orders: number }

/** A weekday counts as "normally open" when it carried at least this many orders. */
export const USUAL_MIN_ORDERS = 10
/**
 * A day at or below this is "nothing recorded". Not 0: an order rung up just
 * after midnight lands on the next calendar day, so a day the branch never
 * traded can still show one or two.
 */
export const QUIET_MAX_ORDERS = 2
/** Look back this many same weekdays; this many of them must have been open. */
export const LOOKBACK_WEEKS = 4
export const OPEN_WEEKS_NEEDED = 2

export interface QuietDay {
  day: string
  orders: number
  /** Average orders on the open same-weekdays that made the day look abnormal. */
  usualOrders: number
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Null when the day looks normal — or when there is not enough history to
 * say it is not (a new branch, a weekday the branch is usually closed on,
 * a holiday season where the prior weeks were also closed).
 */
export function quietDay(counts: DayCount[], day: string): QuietDay | null {
  const byDay = new Map(counts.map(c => [c.day, c.orders]))
  const orders = byDay.get(day) ?? 0
  if (orders > QUIET_MAX_ORDERS) return null

  const openWeeks: number[] = []
  for (let w = 1; w <= LOOKBACK_WEEKS; w++) {
    const n = byDay.get(shiftDay(day, -7 * w)) ?? 0
    if (n >= USUAL_MIN_ORDERS) openWeeks.push(n)
  }
  if (openWeeks.length < OPEN_WEEKS_NEEDED) return null

  return {
    day,
    orders,
    usualOrders: Math.round(openWeeks.reduce((a, b) => a + b, 0) / openWeeks.length),
  }
}

/** Every quiet day among `days`, oldest first. */
export function quietDays(counts: DayCount[], days: string[]): QuietDay[] {
  return [...days].sort().map(d => quietDay(counts, d)).filter((q): q is QuietDay => q !== null)
}

export interface SyncAlert {
  branch_id: string
  day: string
  /**
   * 'branch' — this branch was quiet while another branch traded: the strong
   * signal that its till stopped sending. 'all' — every branch was quiet the
   * same day, which is almost always a holiday (Rosh Hashanah, 12.9.2026);
   * recorded and shown, but not emailed.
   */
  kind: 'branch' | 'all'
  orders: number
  usual_orders: number
  /** What the other branches recorded that day, for the message. */
  others: { branch_id: string; orders: number }[]
}

/** Every quiet branch-day among `days`, classified. Oldest first. */
export function syncAlerts(countsByBranch: Record<string, DayCount[]>, days: string[]): SyncAlert[] {
  const branches = Object.keys(countsByBranch)
  const lookup = new Map(branches.map(b => [b, new Map(countsByBranch[b].map(c => [c.day, c.orders]))]))
  const out: SyncAlert[] = []
  for (const day of [...days].sort()) {
    const quiet = branches
      .map(b => ({ b, q: quietDay(countsByBranch[b], day) }))
      .filter((x): x is { b: string; q: QuietDay } => x.q !== null)
    if (!quiet.length) continue
    // With a single branch there is nothing to compare against — treat it as
    // a branch-level signal rather than never alerting at all.
    const kind: SyncAlert['kind'] = branches.length > 1 && quiet.length === branches.length ? 'all' : 'branch'
    for (const { b, q } of quiet) {
      out.push({
        branch_id: b, day, kind, orders: q.orders, usual_orders: q.usualOrders,
        others: branches.filter(o => o !== b).map(o => ({ branch_id: o, orders: lookup.get(o)!.get(day) ?? 0 })),
      })
    }
  }
  return out
}
