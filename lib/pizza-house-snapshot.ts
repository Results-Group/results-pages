import 'server-only'
import { supabase } from './supabase'
import { pizzaHouseQuery } from './pizza-house-db'
import { rowsForUpsert, type DailyStatRow } from './pizza-house-snapshot-pure'

/**
 * Daily sales snapshots — our memory of the POS's deal totals.
 *
 * The POS keeps a rolling ~5-week window (see pizza-house-ledger.ts). Every
 * night we re-upsert the ENTIRE window it still holds: one query per branch,
 * idempotent by (branch, day), so gaps self-heal on the next run and the very
 * first run doubles as the backfill. Today's open trading day is excluded —
 * a partial day frozen by a later cron outage would read as a real slump.
 */

/** Every day the POS still holds, aggregated. Must run inside runWithBranch(). */
export async function fetchDailyStats(): Promise<DailyStatRow[]> {
  const rows = await pizzaHouseQuery<{ day: string; orders: number; revenue: number | null }>(
    `SELECT DATE(tm_open) as day, COUNT(*) as orders, ROUND(SUM(sum), 2) as revenue
     FROM deals
     WHERE sum > 0
     GROUP BY day
     ORDER BY day`
  )
  return rows.map(r => ({ day: String(r.day), orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0 }))
}

/**
 * Stored till totals for one branch, days in [fromDay, toDay] — what the
 * dashboard uses for the days the POS has already purged. 'pos' only: the
 * 'online' channel series is a different population and must never be summed
 * into it (see migration-pizza-daily-stats-source.sql).
 */
export async function fetchStoredDailyTotals(branchId: string, fromDay: string, toDay: string) {
  const { data, error } = await supabase
    .from('pizza_daily_stats')
    .select('day,orders,revenue')
    .eq('branch_id', branchId)
    .eq('source', 'pos')
    .gte('day', fromDay)
    .lte('day', toDay)
    .order('day')
  if (error) throw new Error(`pizza_daily_stats read failed: ${error.message}`)
  return (data || []).map(r => ({ day: String(r.day), orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0 }))
}

/** The first stored till day for a branch — where even orders/revenue stop. */
export async function fetchStoredFirstDay(branchId: string): Promise<string | null> {
  const { data } = await supabase
    .from('pizza_daily_stats')
    .select('day')
    .eq('branch_id', branchId)
    .eq('source', 'pos')
    .order('day')
    .limit(1)
  return data?.[0]?.day ? String(data[0].day) : null
}

export async function snapshotDailyStats(branchId: string, stats: DailyStatRow[], todayIso: string) {
  const rows = rowsForUpsert(branchId, stats, todayIso)
  if (!rows.length) return { days: 0 }
  const { error } = await supabase
    .from('pizza_daily_stats')
    .upsert(rows, { onConflict: 'branch_id,day,source' })
  // Loud, not swallowed — the backup manifest taught us what silent nightly
  // failures cost.
  if (error) throw new Error(`pizza_daily_stats upsert failed: ${error.message}`)
  return { days: rows.length }
}
