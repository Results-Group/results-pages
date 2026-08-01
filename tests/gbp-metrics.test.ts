import { describe, it, expect } from 'vitest'
import { summarize, delta, dailySeries, type MetricRow } from '@/lib/gbp-metrics'

/**
 * Fixture: Givat Ze'ev, March–July 2026, read off the Business Profile UI.
 * These are the numbers the client sees, so they are the contract — if our
 * aggregation stops reproducing them, our dashboard is lying.
 */
const row = (metric: string, value: number, day = '2026-07-01'): MetricRow => ({ metric, day, value })

const GIVAT_ZEEV: MetricRow[] = [
  row('BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 5624),
  row('BUSINESS_IMPRESSIONS_MOBILE_MAPS', 4806),
  row('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 1286),
  row('BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 208),
  row('CALL_CLICKS', 7020),
  row('BUSINESS_DIRECTION_REQUESTS', 337),
  row('WEBSITE_CLICKS', 2203),
  row('BUSINESS_FOOD_MENU_CLICKS', 63),
]

describe('summarize — reproduces Business Profile’s own headline numbers', () => {
  const s = summarize(GIVAT_ZEEV)

  it('derives profile views as the sum of the four impression surfaces', () => {
    expect(s.views).toBe(11924)
  })

  it('derives interactions as the sum of the action metrics', () => {
    expect(s.interactions).toBe(9623)
  })

  it('keeps each action available on its own', () => {
    expect(s.calls).toBe(7020)
    expect(s.directions).toBe(337)
    expect(s.websiteClicks).toBe(2203)
    expect(s.menuViews).toBe(63)
  })

  it('splits impressions by surface, largest first, with the UI’s percentages', () => {
    expect(s.bySurface.map(x => [x.label, x.pct])).toEqual([
      ['חיפוש Google — נייד', 47],
      ['מפות Google — נייד', 40],
      ['חיפוש Google — מחשב', 11],
      ['מפות Google — מחשב', 2],
    ])
  })

  it('drops surfaces with no impressions instead of charting empty slices', () => {
    const partial = summarize([row('BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 10)])
    expect(partial.bySurface).toHaveLength(1)
  })

  it('returns zeros rather than NaN for an empty range', () => {
    const empty = summarize([])
    expect(empty.views).toBe(0)
    expect(empty.interactions).toBe(0)
    expect(empty.bySurface).toEqual([])
  })
})

describe('delta', () => {
  it('matches the changes shown in the UI', () => {
    // Website clicks +53.7%, calls -4.1%
    expect(delta(2203, 1433)).toBeCloseTo(53.7, 1)
    expect(delta(7020, 7320)).toBeCloseTo(-4.1, 1)
  })

  it('has no opinion without a baseline', () => {
    expect(delta(100, 0)).toBeNull()
  })
})

describe('dailySeries', () => {
  it('fills days Google omitted with zero — absent means quiet, not unknown', () => {
    const rows = [row('CALL_CLICKS', 5, '2026-07-01'), row('CALL_CLICKS', 7, '2026-07-03')]
    expect(dailySeries(rows, ['CALL_CLICKS'], '2026-07-01', '2026-07-03')).toEqual([
      { day: '2026-07-01', value: 5 },
      { day: '2026-07-02', value: 0 },
      { day: '2026-07-03', value: 7 },
    ])
  })

  it('adds up several metrics on the same day', () => {
    const rows = [row('CALL_CLICKS', 5), row('WEBSITE_CLICKS', 2)]
    expect(dailySeries(rows, ['CALL_CLICKS', 'WEBSITE_CLICKS'], '2026-07-01', '2026-07-01')).toEqual([
      { day: '2026-07-01', value: 7 },
    ])
  })

  it('returns nothing for an inverted range rather than looping', () => {
    expect(dailySeries([], ['CALL_CLICKS'], '2026-07-05', '2026-07-01')).toEqual([])
  })
})
