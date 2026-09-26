import { describe, it, expect } from 'vitest'
import { historicalTotals, withHistory, weekBucket, mergeTimeseries, coverageFor, combineCoverage } from '@/lib/pizza-house-history-pure'

// Stored history: 1–20 August, 10 orders / ₪1,000 a day.
const stored = Array.from({ length: 20 }, (_, i) => ({ day: `2026-08-${String(i + 1).padStart(2, '0')}`, orders: 10, revenue: 1000 }))
const POS_FIRST = '2026-08-18' // the till holds 18.8 onward

describe('historicalTotals', () => {
  it('sums only the stored days before the till takes over — no double count at the seam', () => {
    // August: 1–17 from history (17 days), 18–31 comes from the till.
    expect(historicalTotals(stored, '2026-08-01', '2026-08-31', POS_FIRST)).toEqual({ orders: 170, revenue: 17000 })
  })

  it('is zero when the range starts inside the till window', () => {
    expect(historicalTotals(stored, '2026-08-18', '2026-08-31', POS_FIRST)).toEqual({ orders: 0, revenue: 0 })
  })

  it('never borrows days after the range ends — the July-as-comparison bug', () => {
    // A period that ends on 10.8, before the till window: only 1–10.8, not 1–17.8.
    expect(historicalTotals(stored, '2026-08-01', '2026-08-10', POS_FIRST)).toEqual({ orders: 100, revenue: 10000 })
  })
})

describe('withHistory', () => {
  it('adds the stored days and recomputes the average basket', () => {
    const till = { orders: 140, revenue: 12000, avg_order: 85.71, delivery_pct: 48 }
    expect(withHistory(till, { orders: 170, revenue: 17000 })).toEqual({ orders: 310, revenue: 29000, avg_order: 93.55, delivery_pct: 48 })
  })

  it('returns the till summary untouched when there is nothing to add', () => {
    const till = { orders: 140, revenue: 12000, avg_order: 85.71 }
    expect(withHistory(till, { orders: 0, revenue: 0 })).toBe(till)
  })
})

describe('weekBucket', () => {
  it('maps a day to the Monday of its week, like MySQL WEEKDAY()', () => {
    expect(weekBucket('2026-08-17')).toBe('2026-08-17') // Monday
    expect(weekBucket('2026-08-23')).toBe('2026-08-17') // Sunday belongs to the week that began Monday
    expect(weekBucket('2026-08-24')).toBe('2026-08-24')
  })
})

describe('mergeTimeseries', () => {
  const tillDays = [{ bucket: '2026-08-18', revenue: 900, orders: 9 }, { bucket: '2026-08-19', revenue: 800, orders: 8 }]

  it('daily: fills the days before the till window and keeps the till days as they are', () => {
    const out = mergeTimeseries(tillDays, stored, '2026-08-15', '2026-08-31', POS_FIRST, 'day')
    expect(out.map(p => `${p.bucket.slice(8)}:${p.orders}`)).toEqual(['15:10', '16:10', '17:10', '18:9', '19:8'])
  })

  it('weekly: adds stored days into the till week that straddles the seam', () => {
    // Week of Mon 17.8: 17.8 from history (10) + till's partial week bucket (17).
    const out = mergeTimeseries([{ bucket: '2026-08-17', revenue: 1700, orders: 17 }], stored, '2026-08-10', '2026-08-31', POS_FIRST, 'week')
    expect(out).toEqual([
      { bucket: '2026-08-10', revenue: 7000, orders: 70 },
      { bucket: '2026-08-17', revenue: 2700, orders: 27 },
    ])
  })

  it('leaves an hourly chart alone — the history is per day', () => {
    expect(mergeTimeseries(tillDays, stored, '2026-08-01', '2026-08-31', POS_FIRST, 'hour')).toBe(tillDays)
  })

  it('a chart range that ends before the till window stops at its own end', () => {
    expect(mergeTimeseries([], stored, '2026-08-01', '2026-08-03', POS_FIRST, 'day').map(p => p.bucket)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
  })
})

describe('coverageFor', () => {
  it('a 7-day view inside the till window is fully covered', () => {
    expect(coverageFor('2026-09-20', '2026-09-13', POS_FIRST, '2026-07-22')).toMatchObject({
      range_detail_partial: false, prev_detail_partial: false, range_totals_partial: false, prev_totals_partial: false,
    })
  })

  it('30 days: the comparison is complete in totals, partial in detail', () => {
    expect(coverageFor('2026-08-28', '2026-07-29', POS_FIRST, '2026-07-22')).toMatchObject({
      range_detail_partial: false, prev_detail_partial: true, prev_totals_partial: false,
    })
  })

  it('"previous month": totals complete, detail only from the till window', () => {
    expect(coverageFor('2026-08-01', '2026-07-01', POS_FIRST, '2026-07-22')).toEqual({
      detail_from: POS_FIRST, totals_from: '2026-07-22',
      range_detail_partial: true, prev_detail_partial: true, range_totals_partial: false,
      // July, the comparison, only has 22–31.7 stored.
      prev_totals_partial: true,
    })
  })

  it('"all" from April: even the totals start late', () => {
    expect(coverageFor('2026-04-25', '2026-01-01', POS_FIRST, '2026-07-22').range_totals_partial).toBe(true)
  })
})

describe('combineCoverage', () => {
  it('takes the latest start and any partial flag across branches', () => {
    const a = coverageFor('2026-08-01', '2026-07-01', '2026-08-18', '2026-07-22')
    const b = coverageFor('2026-08-01', '2026-07-01', '2026-08-20', '2026-07-22')
    expect(combineCoverage([a, b])).toMatchObject({ detail_from: '2026-08-20', totals_from: '2026-07-22', range_detail_partial: true })
  })
})
