import { describe, it, expect } from 'vitest'
import { quietDay, quietDays, syncAlerts } from '@/lib/pizza-house-sync-watch-pure'

// Thursdays in Sept 2026: 3, 10, 17, 24 — and Aug 27, 20, 13.
const thursdays = (orders: Record<string, number>) =>
  Object.entries(orders).map(([day, n]) => ({ day, orders: n }))

describe('quietDay', () => {
  it('flags a normally busy weekday that recorded nothing — the 10.9 Mevaseret gap', () => {
    const counts = thursdays({ '2026-08-13': 41, '2026-08-20': 38, '2026-08-27': 44, '2026-09-03': 40 })
    expect(quietDay(counts, '2026-09-10')).toEqual({ day: '2026-09-10', orders: 0, usualOrders: 41 })
  })

  it('treats one or two after-midnight orders as nothing recorded', () => {
    const counts = [...thursdays({ '2026-08-20': 38, '2026-08-27': 44, '2026-09-03': 40 }), { day: '2026-09-10', orders: 2 }]
    expect(quietDay(counts, '2026-09-10')?.orders).toBe(2)
  })

  it('stays quiet about a normal day', () => {
    const counts = [...thursdays({ '2026-08-20': 38, '2026-08-27': 44, '2026-09-03': 40 }), { day: '2026-09-10', orders: 3 }]
    expect(quietDay(counts, '2026-09-10')).toBeNull()
  })

  it('stays quiet about a weekday the branch is normally closed on (Friday)', () => {
    // Fridays carry at most the spill-over from Thursday night.
    const counts = thursdays({ '2026-08-21': 1, '2026-08-28': 0, '2026-09-04': 2 })
    expect(quietDay(counts, '2026-09-11')).toBeNull()
  })

  it('needs two open weeks out of four — one busy week is not a pattern', () => {
    const counts = thursdays({ '2026-09-03': 40 })
    expect(quietDay(counts, '2026-09-10')).toBeNull()
  })

  it('stays quiet when there is no history at all (a new branch)', () => {
    expect(quietDay([], '2026-09-10')).toBeNull()
  })
})

describe('quietDays', () => {
  it('returns every flagged day, oldest first', () => {
    const counts = thursdays({
      '2026-08-13': 41, '2026-08-20': 38, '2026-08-27': 44, '2026-09-03': 40, '2026-09-17': 39,
      // Mondays
      '2026-08-17': 30, '2026-08-24': 35, '2026-08-31': 33, '2026-09-07': 45,
    })
    expect(quietDays(counts, ['2026-09-14', '2026-09-10', '2026-09-17']).map(q => q.day)).toEqual(['2026-09-10', '2026-09-14'])
  })
})

describe('syncAlerts', () => {
  // Four prior weeks of normal Saturdays and Thursdays for both branches.
  const history = (b: 'main' | 'mev') => thursdays({
    '2026-08-15': b === 'main' ? 98 : 21, '2026-08-22': b === 'main' ? 95 : 22, '2026-08-29': b === 'main' ? 101 : 20, '2026-09-05': b === 'main' ? 99 : 23,
    '2026-08-13': b === 'main' ? 70 : 55, '2026-08-20': b === 'main' ? 72 : 54, '2026-08-27': b === 'main' ? 69 : 57, '2026-09-03': b === 'main' ? 71 : 56,
  })

  it('one branch quiet while the other traded → a branch alert naming what the other did', () => {
    const counts = { main: [...history('main'), { day: '2026-09-10', orders: 60 }], mevaseret: history('mev') }
    expect(syncAlerts(counts, ['2026-09-10'])).toEqual([{
      branch_id: 'mevaseret', day: '2026-09-10', kind: 'branch', orders: 0, usual_orders: 56,
      others: [{ branch_id: 'main', orders: 60 }],
    }])
  })

  it('every branch quiet the same day → "all", the holiday pattern (Rosh Hashanah 12.9)', () => {
    const counts = { main: history('main'), mevaseret: history('mev') }
    const alerts = syncAlerts(counts, ['2026-09-12'])
    expect(alerts.map(a => `${a.branch_id}:${a.kind}`)).toEqual(['main:all', 'mevaseret:all'])
  })

  it('a single configured branch still alerts at branch level', () => {
    expect(syncAlerts({ mevaseret: history('mev') }, ['2026-09-10'])[0]?.kind).toBe('branch')
  })
})
