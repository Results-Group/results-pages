/**
 * Ordering and filtering for the admin campaigns list. Client-safe, pure —
 * shared by the list page and its tests.
 *
 * The list used to be grouped by client name only, with the API's
 * newest-first order preserved inside each group. That buried the campaign
 * someone created a minute ago under whichever letter their client starts
 * with; the default is now a flat newest-first list, and grouping by client
 * is one of the sort choices rather than the only view.
 */

export type CampaignSort = 'created' | 'updated' | 'client'
/** 'active' = everything that is not archived — the default view. */
export type CampaignStatusFilter = 'active' | 'draft' | 'published' | 'archived' | 'all'

export interface ListableCampaign {
  client: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at?: string
}

export function matchesStatus(status: ListableCampaign['status'], filter: CampaignStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return status !== 'archived'
  return status === filter
}

const clientKey = (c: ListableCampaign) => c.client?.trim() || ''

/** Never mutates its input. Dates newest first; client A→Z, newest first inside. */
export function sortCampaigns<T extends ListableCampaign>(list: T[], sort: CampaignSort, locale = 'he'): T[] {
  const byCreated = (a: T, b: T) => b.created_at.localeCompare(a.created_at)
  const out = [...list]
  if (sort === 'created') return out.sort(byCreated)
  if (sort === 'updated') {
    return out.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at) || byCreated(a, b))
  }
  return out.sort((a, b) => clientKey(a).localeCompare(clientKey(b), locale) || byCreated(a, b))
}

/** Groups in order of first appearance, so a client-sorted list groups A→Z. */
export function groupByClient<T extends ListableCampaign>(list: T[], noClientLabel: string): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const c of list) {
    const key = clientKey(c) || noClientLabel
    const bucket = groups.get(key)
    if (bucket) bucket.push(c); else groups.set(key, [c])
  }
  return [...groups.entries()]
}

/** Distinct client names, A→Z, for the client filter. */
export function clientNames(list: ListableCampaign[], locale = 'he'): string[] {
  return [...new Set(list.map(clientKey).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale))
}

/** How long a published campaign may go unopened before the list flags it. */
export const UNOPENED_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Published over a day ago and never opened outside the team (deck_views only
 * records viewers without an admin session). Half of all campaigns are opened
 * within six minutes of publishing, so a day of silence usually means the
 * link never reached the client. `publish_at` when scheduled, else created_at:
 * the median campaign is published a minute after it is created.
 */
export function awaitingFirstView(
  c: { status: string; created_at: string; publish_at?: string | null; view_stats?: { count: number } | null },
  now: number,
): boolean {
  if (c.status !== 'published') return false
  if (c.view_stats && c.view_stats.count > 0) return false
  const since = new Date(c.publish_at || c.created_at).getTime()
  return Number.isFinite(since) && now - since > UNOPENED_AFTER_MS
}
