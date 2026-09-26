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

import { isLikelyPerson } from '@/lib/deck-view-stats'

describe('isLikelyPerson', () => {
  it('counts real browsers — desktop and phone', () => {
    expect(isLikelyPerson('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(true)
    expect(isLikelyPerson('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe(true)
    expect(isLikelyPerson('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe(true)
  })

  it('does not count the link preview WhatsApp and Facebook fetch when a link is sent', () => {
    expect(isLikelyPerson('WhatsApp/2.23.20.0 A')).toBe(false)
    expect(isLikelyPerson('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(false)
    expect(isLikelyPerson('meta-externalagent/1.1')).toBe(false)
  })

  it('does not count scripts, monitors or an empty user agent', () => {
    expect(isLikelyPerson('curl/8.7.1')).toBe(false)
    expect(isLikelyPerson('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0 Safari/537.36')).toBe(false)
    expect(isLikelyPerson('')).toBe(false)
    expect(isLikelyPerson(null)).toBe(false)
  })

  it('a browser opened from inside WhatsApp is still a person — only the preview fetcher is not', () => {
    // WhatsApp's in-app browser identifies as the phone's normal browser.
    expect(isLikelyPerson('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')).toBe(true)
  })
})
