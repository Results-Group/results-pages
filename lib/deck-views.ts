import 'server-only'
import { supabase } from './supabase'

/**
 * View tracking for public decks/reports/strategy docs. Inserts are
 * fire-and-forget from the public server pages (never awaited into TTFB, and a
 * failure must never break a client-facing render) — same pattern as
 * createPageView for landing pages.
 */
export type DeckContentType = 'campaign' | 'report' | 'strategy'

export async function recordDeckView(data: {
  content_type: DeckContentType
  content_id: string
  ip?: string
  user_agent?: string
}) {
  await supabase.from('deck_views').insert(data)
}

export interface DeckViewRow {
  content_id: string
  viewed_at: string
}

export async function getDeckViewRows(contentType: DeckContentType, ids: string[]): Promise<DeckViewRow[]> {
  if (!ids.length) return []
  const { data } = await supabase
    .from('deck_views')
    .select('content_id, viewed_at')
    .eq('content_type', contentType)
    .in('content_id', ids)
  return (data as DeckViewRow[]) || []
}
