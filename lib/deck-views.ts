import 'server-only'
import { supabase } from './supabase'
import { isLikelyPerson } from './deck-view-stats'

/**
 * View tracking for public decks/reports/strategy docs. Inserts are
 * fire-and-forget from the public server pages (never awaited into TTFB, and a
 * failure must never break a client-facing render) — same pattern as
 * createPageView for landing pages.
 */
export type DeckContentType = 'campaign' | 'report' | 'strategy'

/**
 * `ip` is accepted and deliberately dropped. Nothing has ever read the column
 * back — the only reads are getDeckViewRows (content_id, viewed_at) and a
 * head count — so it was write-only personal data accumulating forever, and
 * riding into every nightly backup. Callers keep passing it so the signature
 * stays honest about what they hold; it just stops being stored.
 */
export async function recordDeckView(data: {
  content_type: DeckContentType
  content_id: string
  ip?: string
  user_agent?: string
}) {
  // Local development runs against the production database, so every deck
  // opened on `npm run dev` was stored as a client view — testing a mockup
  // on localhost inflated that client's numbers. Only production counts.
  if (process.env.NODE_ENV !== 'production') return
  // A link preview or a script is not a client opening the deck.
  if (!isLikelyPerson(data.user_agent)) return
  const { ip: _ip, ...row } = data
  void _ip
  await supabase.from('deck_views').insert(row)
}

export interface DeckViewRow {
  content_id: string
  viewed_at: string
}

/**
 * Every view row for these ids, page by page. PostgREST returns at most 1,000
 * rows per request; this read had no paging, so once campaign views passed
 * 1,000 (1,602 by 2026-09-27) the list's view counts were silently cut short
 * and campaigns the client had opened showed as never opened.
 */
const PAGE = 1000

export async function getDeckViewRows(contentType: DeckContentType, ids: string[]): Promise<DeckViewRow[]> {
  if (!ids.length) return []
  const rows: DeckViewRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('deck_views')
      .select('content_id, viewed_at, user_agent')
      .eq('content_type', contentType)
      .in('content_id', ids)
      // A stable order, or pages can overlap and skip rows.
      .order('id')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    // Rows recorded before bots were filtered at write time are dropped here.
    for (const r of data as (DeckViewRow & { user_agent: string | null })[]) {
      if (isLikelyPerson(r.user_agent)) rows.push({ content_id: r.content_id, viewed_at: r.viewed_at })
    }
    if (data.length < PAGE) break
  }
  return rows
}
