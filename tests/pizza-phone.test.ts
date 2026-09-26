import { describe, it, expect } from 'vitest'
import {
  normalizePhone, hashPhone, phoneOrderRows, phoneRangeIsTrustworthy,
  derivePhoneCustomers, mergePhoneIntoPayload,
  type PhoneCustomersRpc, type PhoneCustomers,
} from '@/lib/pizza-house-phone-pure'

const KEY = 'test-key-0123456789abcdef0123456789abcdef'

describe('normalizePhone', () => {
  it('keeps a clean Israeli mobile and strips separators', () => {
    expect(normalizePhone('0501234567')).toBe('0501234567')
    expect(normalizePhone('050-123-4567')).toBe('0501234567')
    expect(normalizePhone(' 050 1234567 ')).toBe('0501234567')
  })

  it('folds an international prefix back to the local form', () => {
    expect(normalizePhone('+972501234567')).toBe('0501234567')
    expect(normalizePhone('972501234567')).toBe('0501234567')
    expect(normalizePhone('+972-50-1234567')).toBe('0501234567')
  })

  it('accepts a 9-digit landline', () => {
    expect(normalizePhone('02-1234567')).toBe('021234567')
  })

  it('falls back to phone_solar only when phone is unusable', () => {
    expect(normalizePhone('', '0521111111')).toBe('0521111111')
    expect(normalizePhone('---', '0521111111')).toBe('0521111111')
    expect(normalizePhone('0501234567', '0521111111')).toBe('0501234567')
  })

  it('returns null for junk, placeholders and too-short numbers', () => {
    expect(normalizePhone('---')).toBeNull()
    expect(normalizePhone('0')).toBeNull()
    expect(normalizePhone('12345678')).toBeNull()
    expect(normalizePhone(null, null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe('hashPhone', () => {
  it('is deterministic for the same phone and key', () => {
    expect(hashPhone('0501234567', KEY)).toBe(hashPhone('0501234567', KEY))
    expect(hashPhone('0501234567', KEY)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes with the key — a rotated key must not match old rows by accident', () => {
    expect(hashPhone('0501234567', KEY)).not.toBe(hashPhone('0501234567', KEY + 'x'))
  })
})

describe('phoneOrderRows', () => {
  const good = { phone: '050-1234567', phone_solar: null, last_deal_id: 20010424, last_deal_date: '2026-09-24 23:17:24', last_deal_sum: '129.90' }

  it('builds an upsert row with the hashed phone and nothing identifying', () => {
    const { rows, dropped } = phoneOrderRows('mevaseret', [good], KEY, '2026-09-27T00:30:00.000Z')
    expect(dropped).toBe(0)
    expect(rows).toEqual([{
      branch_id: 'mevaseret',
      phone_hash: hashPhone('0501234567', KEY),
      deal_id: 20010424,
      deal_date: '2026-09-24 23:17:24',
      deal_sum: 129.9,
      captured_at: '2026-09-27T00:30:00.000Z',
    }])
    expect(JSON.stringify(rows)).not.toContain('1234567')
  })

  it('hashes two spellings of the same number to the same row', () => {
    const a = phoneOrderRows('m', [good], KEY).rows[0]
    const b = phoneOrderRows('m', [{ ...good, phone: '+972501234567' }], KEY).rows[0]
    expect(a.phone_hash).toBe(b.phone_hash)
  })

  it('drops rows that would corrupt the table instead of guessing', () => {
    const { rows, dropped } = phoneOrderRows('m', [
      { ...good, phone: '---', phone_solar: '' },                  // no phone
      { ...good, last_deal_id: 0 },                                // no order
      { ...good, last_deal_id: null },
      { ...good, last_deal_date: '0000-00-00 00:00:00' },          // MySQL zero date
      { ...good, last_deal_date: '1999-12-31 10:00:00' },          // before the POS existed
      { ...good, last_deal_date: '2026-13-45 10:00:00' },          // not a date
      { ...good, last_deal_date: null },
      { ...good, last_deal_sum: 'abc' },
    ], KEY)
    expect(rows).toEqual([])
    expect(dropped).toBe(8)
  })

  it('keeps one row per deal so a single upsert batch cannot hit the same key twice', () => {
    const { rows } = phoneOrderRows('m', [good, { ...good, phone: '0529999999' }], KEY)
    expect(rows).toHaveLength(1)
    expect(rows[0].phone_hash).toBe(hashPhone('0529999999', KEY))
  })
})

describe('phoneRangeIsTrustworthy', () => {
  it('is false on the day collection started — old customers would read as new', () => {
    expect(phoneRangeIsTrustworthy('2026-09-27', '2026-09-27')).toBe(false)
    expect(phoneRangeIsTrustworthy('2026-09-01', '2026-09-27')).toBe(false)
  })

  it('is true from the day after', () => {
    expect(phoneRangeIsTrustworthy('2026-09-28', '2026-09-27')).toBe(true)
  })

  it('is false when nothing has been collected', () => {
    expect(phoneRangeIsTrustworthy('2026-09-28', null)).toBe(false)
  })
})

const rpc = (over: Partial<PhoneCustomersRpc> = {}): PhoneCustomersRpc => ({
  base: 2136,
  recency: { up_to_30d: 165, d30_90: 317, d90_180: 418, d180_365: 849, over_365: 526 },
  in_range: { customers: 40, orders: 44, revenue: 5200 },
  new_vs_returning: { new: 10, returning: 30, new_revenue: 1200, returning_revenue: 4000 },
  frequency: { '1': 20, '2': 12, '3-5': 6, '6+': 2 },
  collection_start: '2026-09-27',
  last_captured_at: '2026-09-28T00:31:00+00:00',
  branches_with_data: ['mevaseret'],
  ...over,
})

describe('derivePhoneCustomers', () => {
  it('derives active/dormant from the recency buckets and marks both ranges', () => {
    const d = derivePhoneCustomers(rpc(), rpc(), '2026-09-28', '2026-09-21')
    expect(d).toMatchObject({ active_30d: 165, active_90d: 482, dormant_180d: 1375, trustworthy: true })
    expect(d?.prev.trustworthy).toBe(false)
  })

  it('returns null when the branches hold no phone data at all', () => {
    expect(derivePhoneCustomers(rpc({ base: 0, branches_with_data: [] }), rpc({ base: 0 }), '2026-09-28', '2026-09-21')).toBeNull()
  })
})

describe('mergePhoneIntoPayload', () => {
  const payload = {
    summary: { orders: 100, unique_customers: 55, returning_pct: 12, identity_coverage_pct: 60 } as Record<string, unknown>,
    prev_summary: { orders: 90, unique_customers: 50, returning_pct: 11, identity_coverage_pct: 58 } as Record<string, unknown>,
    customers: {
      newVsReturning: [{ kind: 'new', customers: 40, revenue: 1 }, { kind: 'returning', customers: 15, revenue: 2 }],
      frequency: [{ bucket: '1', customers: 50 }],
      vip: [{ last4: '1234' }],
    },
  }
  const phone = (over: Partial<PhoneCustomers> = {}): PhoneCustomers => ({
    ...rpc(), active_30d: 165, active_90d: 482, dormant_180d: 1375, trustworthy: true,
    prev: { in_range: { customers: 35, orders: 36, revenue: 4000 }, new_vs_returning: { new: 5, returning: 30, new_revenue: 500, returning_revenue: 3500 }, trustworthy: true },
    ...over,
  })

  it('leaves the card-based numbers alone when there is no phone data', () => {
    const { payload: out, identity_source } = mergePhoneIntoPayload(payload, null, ['mevaseret'])
    expect(identity_source).toBe('card')
    expect(out.summary.unique_customers).toBe(55)
    expect(out.summary.identity_source).toBe('card')
  })

  it('leaves them alone while either range is untrustworthy', () => {
    expect(mergePhoneIntoPayload(payload, phone({ trustworthy: false }), ['mevaseret']).identity_source).toBe('card')
    const p = phone(); p.prev.trustworthy = false
    expect(mergePhoneIntoPayload(payload, p, ['mevaseret']).identity_source).toBe('card')
  })

  it('leaves them alone in the all-branches view until every branch has phone data', () => {
    expect(mergePhoneIntoPayload(payload, phone(), ['main', 'mevaseret']).identity_source).toBe('card')
    expect(mergePhoneIntoPayload(payload, phone({ branches_with_data: ['main', 'mevaseret'] }), ['main', 'mevaseret']).identity_source).toBe('phone')
  })

  it('swaps in the phone figures for both periods and keeps VIP untouched', () => {
    const { payload: out, identity_source } = mergePhoneIntoPayload(payload, phone(), ['mevaseret'])
    expect(identity_source).toBe('phone')
    expect(out.summary).toMatchObject({ identity_source: 'phone', unique_customers: 40, returning_customers: 30, returning_pct: 75, identity_coverage_pct: 44 })
    expect(out.prev_summary).toMatchObject({ identity_source: 'phone', unique_customers: 35, returning_pct: 86, identity_coverage_pct: 40 })
    expect(out.customers.newVsReturning).toEqual([
      { kind: 'new', customers: 10, revenue: 1200 },
      { kind: 'returning', customers: 30, revenue: 4000 },
    ])
    expect(out.customers.frequency).toEqual([
      { bucket: '1', customers: 20 }, { bucket: '2', customers: 12 }, { bucket: '3-5', customers: 6 }, { bucket: '6+', customers: 2 },
    ])
    expect(out.customers.vip).toEqual([{ last4: '1234' }])
    // The input is not mutated — the route caches payloads.
    expect(payload.summary.unique_customers).toBe(55)
  })
})
