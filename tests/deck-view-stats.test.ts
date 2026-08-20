import { describe, it, expect } from 'vitest'
import { summarizeDeckViews } from '@/lib/deck-view-stats'

describe('summarizeDeckViews', () => {
  it('empty in, empty out', () => {
    expect(summarizeDeckViews([])).toEqual({})
  })

  it('counts per content id and keeps the latest timestamp', () => {
    const rows = [
      { content_id: 'a', viewed_at: '2026-08-01T10:00:00Z' },
      { content_id: 'a', viewed_at: '2026-08-19T08:00:00Z' },
      { content_id: 'a', viewed_at: '2026-08-05T12:00:00Z' },
      { content_id: 'b', viewed_at: '2026-08-02T09:00:00Z' },
    ]
    expect(summarizeDeckViews(rows)).toEqual({
      a: { count: 3, last_viewed: '2026-08-19T08:00:00Z' },
      b: { count: 1, last_viewed: '2026-08-02T09:00:00Z' },
    })
  })

  it('order of rows does not matter for last_viewed', () => {
    const asc = summarizeDeckViews([
      { content_id: 'x', viewed_at: '2026-01-01T00:00:00Z' },
      { content_id: 'x', viewed_at: '2026-02-01T00:00:00Z' },
    ])
    const desc = summarizeDeckViews([
      { content_id: 'x', viewed_at: '2026-02-01T00:00:00Z' },
      { content_id: 'x', viewed_at: '2026-01-01T00:00:00Z' },
    ])
    expect(asc).toEqual(desc)
  })
})
