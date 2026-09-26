import { createHmac } from 'node:crypto'

/**
 * The pure half of the phone-based customer ledger (node-testable, no
 * supabase/mysql). See docs/superpowers/specs/2026-09-26-pizza-phone-customers-design.md.
 *
 * Since 2026-09-24 the Aviv POS exposes, per delivery customer, the customer's
 * LAST order (client_delivery.last_deal_id/_date/_sum) — Mevaseret first,
 * Giv'at Ze'ev once Aviv repeats the change there. One order per customer is
 * not a history, so the nightly cron folds each snapshot into our own table
 * and the history accumulates from there.
 */

/** Exactly the five columns read from client_delivery. Never a name or email. */
export interface RawPhoneOrder {
  phone: string | null
  phone_solar: string | null
  last_deal_id: number | string | null
  /** mysql2 runs with dateStrings: true → 'YYYY-MM-DD HH:MM:SS' (Israel local time). */
  last_deal_date: string | null
  last_deal_sum: number | string | null
}

export interface PhoneOrderRow {
  branch_id: string
  phone_hash: string
  deal_id: number
  deal_date: string
  deal_sum: number
  captured_at: string
}

/**
 * Digits only; +972 folded back to the local 0-prefix; `phone_solar` (the
 * mobile column) only when `phone` is unusable — in Mevaseret the two agree
 * on 99% of rows and only 6 customers have a mobile alone. Under 9 digits is
 * not a phone number in Israel, so it yields null and the row is dropped.
 */
export function normalizePhone(phone: string | null | undefined, phoneSolar?: string | null): string | null {
  for (const candidate of [phone, phoneSolar]) {
    let digits = (candidate ?? '').replace(/\D/g, '')
    if (digits.length === 12 && digits.startsWith('972')) digits = '0' + digits.slice(3)
    if (digits.length >= 9) return digits
  }
  return null
}

/**
 * HMAC, not a plain hash: a phone number has ~10^9 possible values, so an
 * unkeyed SHA-256 of it can be reversed by brute force in minutes. The key is
 * PIZZAHOUSE_PHONE_KEY — deliberately not SESSION_SECRET, which already keys
 * the card ledger; rotating it must not wipe this history too.
 */
export function hashPhone(normalized: string, key: string): string {
  return createHmac('sha256', key).update(`phone:${normalized}`).digest('hex')
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

/**
 * Rows ready for upsert. Anything that would corrupt the table is dropped
 * and counted rather than guessed at: no usable phone, deal id 0/NULL, the
 * MySQL zero date, a date before the POS existed, a non-date, a non-number.
 * One row per deal_id (last wins): Postgres rejects a single upsert batch
 * that touches the same key twice.
 */
export function phoneOrderRows(
  branchId: string,
  raw: RawPhoneOrder[],
  key: string,
  capturedAt: string = new Date().toISOString(),
): { rows: PhoneOrderRow[]; dropped: number } {
  const byDeal = new Map<number, PhoneOrderRow>()
  let dropped = 0
  for (const r of raw) {
    const phone = normalizePhone(r.phone, r.phone_solar)
    const dealId = Number(r.last_deal_id)
    const date = String(r.last_deal_date ?? '')
    const sum = Number(r.last_deal_sum)
    const validDate = DATETIME_RE.test(date) && date >= '2000-01-01' && !Number.isNaN(Date.parse(date.replace(' ', 'T')))
    if (!phone || !Number.isInteger(dealId) || dealId <= 0 || !validDate || !Number.isFinite(sum)) {
      dropped++
      continue
    }
    byDeal.set(dealId, {
      branch_id: branchId,
      phone_hash: hashPhone(phone, key),
      deal_id: dealId,
      deal_date: date,
      deal_sum: Math.round(sum * 100) / 100,
      captured_at: capturedAt,
    })
  }
  return { rows: [...byDeal.values()], dropped }
}

/** What the pizza_phone_customers() Postgres function returns. */
export interface PhoneCustomersRpc {
  base: number
  recency: { up_to_30d: number; d30_90: number; d90_180: number; d180_365: number; over_365: number }
  in_range: { customers: number; orders: number; revenue: number }
  new_vs_returning: { new: number; returning: number; new_revenue: number; returning_revenue: number }
  frequency: Record<string, number>
  /** Israel calendar date of the first capture, or null before the first run. */
  collection_start: string | null
  last_captured_at: string | null
  branches_with_data: string[]
}

export interface PhoneCustomers extends PhoneCustomersRpc {
  active_30d: number
  active_90d: number
  dormant_180d: number
  /** Whether new-vs-returning for the requested range can be believed. */
  trustworthy: boolean
  prev: {
    in_range: PhoneCustomersRpc['in_range']
    new_vs_returning: PhoneCustomersRpc['new_vs_returning']
    trustworthy: boolean
  }
}

/**
 * New-vs-returning is only honest for a range that starts AFTER the day
 * collection began. Before that day we know one order per customer — their
 * last — so a long-time customer whose last order falls inside the range
 * would be counted as "new". From the next day on, everyone who was a
 * customer before has an earlier order on file, and the figure is exact.
 */
export function phoneRangeIsTrustworthy(fromDate: string, collectionStart: string | null): boolean {
  if (!collectionStart) return false
  return fromDate > collectionStart
}

export function derivePhoneCustomers(
  current: PhoneCustomersRpc,
  prev: PhoneCustomersRpc,
  fromDate: string,
  prevFromDate: string,
): PhoneCustomers | null {
  if (!current.base) return null
  const r = current.recency
  return {
    ...current,
    active_30d: r.up_to_30d,
    active_90d: r.up_to_30d + r.d30_90,
    dormant_180d: r.d180_365 + r.over_365,
    trustworthy: phoneRangeIsTrustworthy(fromDate, current.collection_start),
    prev: {
      in_range: prev.in_range,
      new_vs_returning: prev.new_vs_returning,
      trustworthy: phoneRangeIsTrustworthy(prevFromDate, current.collection_start),
    },
  }
}

export interface MergeablePayload {
  summary: Record<string, unknown>
  prev_summary: Record<string, unknown>
  customers: {
    newVsReturning: { kind: string; customers: number; revenue: number }[]
    frequency: { bucket: string; customers: number }[]
  }
}

const FREQUENCY_BUCKETS = ['1', '2', '3-5', '6+']
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

/**
 * Swaps the card-based customer figures for phone-based ones — only when
 * every branch on screen has phone data (no mixing a phone branch with a
 * card branch under one number) and BOTH periods are trustworthy (otherwise
 * the "vs previous period" delta compares a phone count with a card count).
 * Otherwise the payload goes out exactly as the POS produced it, tagged
 * identity_source: 'card'. Never mutates its input — the route caches it.
 */
export function mergePhoneIntoPayload<T extends MergeablePayload>(
  payload: T,
  phone: PhoneCustomers | null,
  requiredBranches: string[],
): { payload: T; identity_source: 'phone' | 'card' } {
  const covered = !!phone && requiredBranches.every(b => phone.branches_with_data.includes(b))
  if (!phone || !covered || !phone.trustworthy || !phone.prev.trustworthy) {
    return {
      identity_source: 'card',
      payload: { ...payload, summary: { ...payload.summary, identity_source: 'card' } },
    }
  }
  const cur = phone.new_vs_returning
  const prev = phone.prev.new_vs_returning
  return {
    identity_source: 'phone',
    payload: {
      ...payload,
      summary: {
        ...payload.summary,
        identity_source: 'phone',
        unique_customers: phone.in_range.customers,
        returning_customers: cur.returning,
        returning_pct: pct(cur.returning, cur.new + cur.returning),
        identity_coverage_pct: pct(phone.in_range.orders, Number(payload.summary.orders ?? 0)),
      },
      prev_summary: {
        ...payload.prev_summary,
        identity_source: 'phone',
        unique_customers: phone.prev.in_range.customers,
        returning_customers: prev.returning,
        returning_pct: pct(prev.returning, prev.new + prev.returning),
        identity_coverage_pct: pct(phone.prev.in_range.orders, Number(payload.prev_summary.orders ?? 0)),
      },
      customers: {
        ...payload.customers,
        newVsReturning: [
          { kind: 'new', customers: cur.new, revenue: cur.new_revenue },
          { kind: 'returning', customers: cur.returning, revenue: cur.returning_revenue },
        ],
        frequency: FREQUENCY_BUCKETS.map(bucket => ({ bucket, customers: phone.frequency[bucket] ?? 0 })),
      },
    },
  }
}
