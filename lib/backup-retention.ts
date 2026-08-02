/**
 * Retention policy for database snapshots. Kept out of lib/backup.ts — that
 * module is `server-only` and cannot be imported by tests. Same split as
 * lib/client-name.ts.
 */

/** Snapshots kept day by day. */
const DAILY_DAYS = 30

/**
 * Decides which snapshot files may be deleted.
 *
 * Keeps every snapshot from the last 30 days, then the first of each month for
 * a year. Slow corruption is only recoverable if the backups reach back past
 * the point where someone noticed it — a 30-day window alone would not.
 *
 * Files whose names don't look like snapshots are never returned: a delete path
 * must not guess.
 */
export function snapshotsToPrune(names: string[], now: Date): string[] {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - DAILY_DAYS)
  const yearAgo = new Date(now)
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1)

  return names
    .map(name => ({ name, day: name.replace('.json.gz', '') }))
    .filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.day))
    .filter(f => {
      const d = new Date(`${f.day}T00:00:00Z`)
      if (d >= cutoff) return false // inside the daily window
      if (d < yearAgo) return true // older than a year, monthly or not
      return !f.day.endsWith('-01') // between: keep the monthlies
    })
    .map(f => f.name)
}
