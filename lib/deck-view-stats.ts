/**
 * Pure aggregation of deck_views rows — separate from lib/deck-views.ts, which
 * is server-only (service-role client); this module is safe for client
 * components and node tests, per the lib/report-template.ts split convention.
 */
export interface ViewStats {
  count: number
  last_viewed: string
}

export function summarizeDeckViews(rows: { content_id: string; viewed_at: string }[]): Record<string, ViewStats> {
  const out: Record<string, ViewStats> = {}
  for (const r of rows) {
    const cur = out[r.content_id]
    if (!cur) {
      out[r.content_id] = { count: 1, last_viewed: r.viewed_at }
    } else {
      cur.count++
      if (r.viewed_at > cur.last_viewed) cur.last_viewed = r.viewed_at
    }
  }
  return out
}
