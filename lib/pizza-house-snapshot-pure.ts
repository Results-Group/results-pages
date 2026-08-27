/**
 * The pure half of the daily-stats snapshot (node-testable, no supabase/mysql).
 */
export interface DailyStatRow {
  day: string
  orders: number
  revenue: number
}

/**
 * Rows ready for upsert: today's still-open trading day is excluded (a partial
 * day frozen by a later outage would read as a real slump), and malformed
 * day strings are dropped rather than corrupting the table.
 */
export function rowsForUpsert(branchId: string, stats: DailyStatRow[], todayIso: string) {
  return stats
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.day) && s.day < todayIso)
    .map(s => ({
      branch_id: branchId,
      day: s.day,
      orders: s.orders,
      revenue: s.revenue,
      captured_at: new Date().toISOString(),
    }))
}
