import { describe, it, expect } from 'vitest'
import { snapshotsToPrune } from '@/lib/backup-retention'

const NOW = new Date('2026-08-02T03:00:00Z')
const f = (day: string) => `${day}.json.gz`

describe('snapshotsToPrune — what survives', () => {
  it('keeps everything from the last 30 days', () => {
    const recent = [f('2026-08-01'), f('2026-07-20'), f('2026-07-04')]
    expect(snapshotsToPrune(recent, NOW)).toEqual([])
  })

  it('keeps the first of each month for the past year', () => {
    const monthlies = [f('2026-06-01'), f('2026-03-01'), f('2025-09-01')]
    expect(snapshotsToPrune(monthlies, NOW)).toEqual([])
  })

  it('drops the mid-month dailies once they leave the 30-day window', () => {
    expect(snapshotsToPrune([f('2026-06-15')], NOW)).toEqual([f('2026-06-15')])
  })

  it('drops monthlies older than a year', () => {
    expect(snapshotsToPrune([f('2025-07-01')], NOW)).toEqual([f('2025-07-01')])
  })
})

describe('snapshotsToPrune — what it must never touch', () => {
  it('leaves files it does not recognise alone, rather than guessing', () => {
    const strangers = ['README', 'db/', 'manifest.json', 'backup-final.json.gz', '']
    expect(snapshotsToPrune(strangers, NOW)).toEqual([])
  })

  it('never deletes a snapshot taken today, even at a month boundary', () => {
    expect(snapshotsToPrune([f('2026-08-02'), f('2026-08-01')], new Date('2026-08-02T23:59:00Z')))
      .toEqual([])
  })
})

describe('snapshotsToPrune — a full year of history', () => {
  it('converges on 30 dailies plus 11 monthlies, not unbounded growth', () => {
    // Every day for two years, then prune as the nightly job would.
    const days: string[] = []
    for (let i = 0; i < 730; i++) {
      const d = new Date(NOW)
      d.setUTCDate(d.getUTCDate() - i)
      days.push(f(d.toISOString().slice(0, 10)))
    }

    const doomed = new Set(snapshotsToPrune(days, NOW))
    const kept = days.filter(d => !doomed.has(d))

    // 30 days back from Aug 2 reaches Jul 3; the monthlies then run Jul 1 back
    // to Sep 1 of the previous year (Aug 1 is inside the daily window).
    expect(kept.length).toBeLessThan(50)
    expect(kept).toContain(f('2026-08-02'))
    expect(kept).toContain(f('2026-07-04'))
    expect(kept).toContain(f('2026-07-01'))
    expect(kept).toContain(f('2025-09-01'))
    expect(kept).not.toContain(f('2025-08-15'))
  })
})
