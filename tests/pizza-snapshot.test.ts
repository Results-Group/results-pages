import { describe, it, expect } from 'vitest'
import { rowsForUpsert } from '@/lib/pizza-house-snapshot-pure'

const stats = [
  { day: '2026-08-24', orders: 40, revenue: 3500.5 },
  { day: '2026-08-25', orders: 38, revenue: 3200 },
  { day: '2026-08-26', orders: 12, revenue: 900 },
]

describe('rowsForUpsert', () => {
  it("excludes today's still-open trading day", () => {
    const rows = rowsForUpsert('mevaseret', stats, '2026-08-26')
    expect(rows.map(r => r.day)).toEqual(['2026-08-24', '2026-08-25'])
  })

  it('keeps every closed day and carries branch + values', () => {
    const rows = rowsForUpsert('main', stats, '2026-08-27')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ branch_id: 'main', day: '2026-08-24', orders: 40, revenue: 3500.5 })
  })

  it('drops malformed day strings instead of corrupting the table', () => {
    const rows = rowsForUpsert('main', [{ day: 'not-a-date', orders: 1, revenue: 1 }, ...stats], '2026-08-27')
    expect(rows).toHaveLength(3)
  })
})
