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

/**
 * Whether a recorded view came from a person rather than something fetching
 * the link. By 2026-09-27 a fifth of all deck "views" were not people: 224
 * WhatsApp link previews (WhatsApp fetches the page the moment the team
 * sends the link), 71 Facebook/Meta previews, 26 scripts and uptime checks —
 * and 9 campaigns showed as opened when only a preview bot had ever loaded
 * them. Used both when recording and when counting, so history is filtered
 * too without deleting anything.
 */
const NOT_A_PERSON = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|TelegramBot|Slackbot|Discordbot|LinkedInBot|Twitterbot|Googlebot|bingbot|Applebot|bot\b|crawler|spider|preview|curl|wget|python-requests|node-fetch|axios|Go-http|HeadlessChrome|vercel/i

export function isLikelyPerson(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  return !NOT_A_PERSON.test(userAgent)
}
