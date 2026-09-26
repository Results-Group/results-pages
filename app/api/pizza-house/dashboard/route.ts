import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import {
  fetchSummary,
  fetchTimeseries,
  fetchHeatmap,
  fetchWeekdays,
  fetchCustomers,
  fetchProducts,
  fetchChannels,
  fetchPayments,
  fetchOrderTiming,
  fetchDeadItems,
  fetchFreshness,
  type DateRange,
} from '@/lib/pizza-house-queries'
import { runWithBranch, isPizzaBranch, listPizzaBranches } from '@/lib/pizza-house-db'
import { aggregateBranches, type BranchData } from '@/lib/pizza-house-aggregate'
import { fetchPhoneCustomers } from '@/lib/pizza-house-phone'
import { fetchStoredDailyTotals, fetchStoredFirstDay } from '@/lib/pizza-house-snapshot'
import {
  historicalTotals, withHistory, mergeTimeseries, coverageFor, combineCoverage, type Coverage,
} from '@/lib/pizza-house-history-pure'
import { mergePhoneIntoPayload } from '@/lib/pizza-house-phone-pure'
import { captureException } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<string, { data: unknown; at: number }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/**
 * Ceiling on the requested span. Several of the queries behind this route
 * (VIP customers, visit frequency, dead items) scan whole POS tables, and the
 * range was previously unbounded — `from=1990-01-01` was a valid request
 * against a live restaurant till. Two years covers every real comparison.
 */
const MAX_RANGE_DAYS = 800

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // The dedicated Pizza House session (from the shared dashboard password).
  // Must actually be a Pizza House token: both cookies share a payload format,
  // so without the scope check any platform user could paste their own session
  // in as ph_session and skip the admin-only rule below.
  const ph = req.cookies.get('ph_session')?.value
  if (ph) {
    const phSession = await verifySessionToken(ph)
    if (phSession?.scope === 'pizza-house') return true
  }
  // Platform users may view it too, but only global admins/owners — a viewer
  // or editor from an unrelated workspace must not reach this client's
  // financial + customer PII.
  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    // !session.scope, like every sibling gate: a scoped token must never pass
    // as a platform admin, even though today's scoped tokens are all viewers.
    if (session && !session.scope && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

async function isPlatformAdmin(req: NextRequest): Promise<boolean> {
  const rp = req.cookies.get('rp_session')?.value
  if (!rp) return false
  const session = await verifySessionToken(rp)
  return !!session && !session.scope && (session.isOwner || session.role === 'admin')
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

interface Days { from: string; to: string; prevFrom: string; prevTo: string }

/**
 * All 12 datasets for the current AsyncLocalStorage branch context, with
 * orders/revenue completed from our stored history for any days the till has
 * already purged (see lib/pizza-house-history-pure.ts). When the previous
 * period lies inside the till window — every range up to 7 days — nothing is
 * read from the history and the payload is exactly the till's.
 */
async function fetchBranchData(branchId: string, range: DateRange, prevRange: DateRange, rangeDays: number, days: Days): Promise<BranchData & { coverage: Coverage }> {
  const [summary, prev_summary, timeseries, heatmap, weekdays, customers, products, channels, payments, orderTiming, deadItems, freshness] =
    await Promise.all([
      fetchSummary(range), fetchSummary(prevRange), fetchTimeseries(range, rangeDays), fetchHeatmap(range),
      fetchWeekdays(range), fetchCustomers(range), fetchProducts(range, prevRange), fetchChannels(range),
      fetchPayments(range), fetchOrderTiming(range), fetchDeadItems(range), fetchFreshness(),
    ])
  const data = { summary, prev_summary, timeseries, heatmap, weekdays, customers, products, channels, payments, orderTiming, deadItems, freshness } as unknown as BranchData

  const posFirstDay = freshness.first_deal ? String(freshness.first_deal).slice(0, 10) : null
  // The previous period always starts first, so it decides whether any
  // history is needed at all.
  if (!posFirstDay || days.prevFrom >= posFirstDay) {
    return { ...data, coverage: coverageFor(days.from, days.prevFrom, posFirstDay, null) }
  }
  try {
    const [stored, storedFirst] = await Promise.all([
      fetchStoredDailyTotals(branchId, days.prevFrom, days.to),
      fetchStoredFirstDay(branchId),
    ])
    return {
      ...data,
      summary: withHistory(data.summary, historicalTotals(stored, days.from, days.to, posFirstDay)),
      prev_summary: withHistory(data.prev_summary, historicalTotals(stored, days.prevFrom, days.prevTo, posFirstDay)),
      timeseries: {
        ...data.timeseries,
        points: mergeTimeseries(data.timeseries.points, stored, days.from, days.to, posFirstDay, data.timeseries.granularity),
      },
      coverage: coverageFor(days.from, days.prevFrom, posFirstDay, storedFirst),
    }
  } catch (err) {
    // The history makes long ranges complete; without it they fall back to
    // exactly what the till holds, as before — never a failed dashboard.
    captureException(err, { route: 'GET /api/pizza-house/dashboard', branch: branchId, phase: 'history' })
    return { ...data, coverage: coverageFor(days.from, days.prevFrom, posFirstDay, null) }
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The heavy queries below run against the restaurant's live till, and one
  // shared password is all it takes to hold a reload loop open during dinner
  // service. Keyed per IP: holders of the shared password are indistinguishable.
  const rl = await rateLimit(req, { windowMs: 60_000, max: 20, prefix: 'ph-dash' })
  if (rl) return rl

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? '' // inclusive calendar date
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  // Date.parse guards the format; this guards the span. Also catches '0000-00-00',
  // which passes DATE_RE and then threw a raw RangeError out of addDays.
  const spanDays = daysBetween(from, to)
  if (!Number.isFinite(spanDays) || spanDays < 0 || spanDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: 'טווח התאריכים גדול מדי' }, { status: 400 })
  }

  const available = listPizzaBranches()
  if (available.length === 0) {
    return NextResponse.json({ error: 'No branch configured' }, { status: 503 })
  }
  // "all" = the unified cross-branch view (only meaningful with >1 branch).
  // Otherwise fall back to the first configured branch rather than erroring if
  // the requested branch (default 'main') isn't set up in this environment.
  const allowAll = available.length > 1
  let branch = searchParams.get('branch') || 'main'
  if (branch === 'all') { if (!allowAll) branch = available[0].id }
  else if (!isPizzaBranch(branch)) branch = available[0].id

  const branchesForUi = allowAll ? [{ id: 'all', label: 'כל הסניפים — מאוחד' }, ...available] : available

  const cacheKey = `${branch}|${from}|${to}`
  const cached = cache.get(cacheKey)
  const isCurrentRange = to >= new Date().toISOString().slice(0, 10)
  // Ranges including today get a short TTL so fresh sales show up quickly
  const ttl = isCurrentRange ? 10 * 60 * 1000 : CACHE_TTL_MS
  // `refresh` bypasses the cache and re-runs every query against the till, so
  // it is a staff lever, not something any password holder can hold down.
  const forceRefresh = searchParams.has('refresh') && (await isPlatformAdmin(req))
  if (cached && Date.now() - cached.at < ttl && !forceRefresh) {
    return NextResponse.json(cached.data)
  }

  const rangeDays = daysBetween(from, to) + 1
  const range: DateRange = { from: `${from} 00:00:00`, to: `${addDays(to, 1)} 00:00:00` }
  const prevFrom = addDays(from, -rangeDays)
  const prevRange: DateRange = { from: `${prevFrom} 00:00:00`, to: `${from} 00:00:00` }
  const days: Days = { from, to, prevFrom, prevTo: addDays(from, -1) }

  try {
    let payload: BranchData
    let coverage: Coverage
    let perBranch: { id: string; label: string; summary: unknown; prev_summary: unknown }[] | null = null

    if (branch === 'all') {
      // Fetch every branch in parallel, then aggregate + keep a per-branch breakdown.
      const perBranchData = await Promise.all(
        available.map(b => runWithBranch(b.id, () => fetchBranchData(b.id, range, prevRange, rangeDays, days))),
      )
      payload = aggregateBranches(perBranchData)
      coverage = combineCoverage(perBranchData.map(d => d.coverage))
      perBranch = available.map((b, i) => ({
        id: b.id, label: b.label,
        summary: perBranchData[i].summary, prev_summary: perBranchData[i].prev_summary,
      }))
    } else {
      const { coverage: c, ...one } = await runWithBranch(branch, () => fetchBranchData(branch, range, prevRange, rangeDays, days))
      payload = one
      coverage = c
    }

    // Phone-based customer figures come from our own ledger (Supabase), not
    // the till. Losing them costs the customer-base block, never the
    // dashboard — so a failure here is reported and swallowed. The merge
    // only swaps the card-based numbers when every branch on screen has
    // phone data and both periods are past the collection start.
    const branchIds = branch === 'all' ? available.map(b => b.id) : [branch]
    const phoneCustomers = await fetchPhoneCustomers(branchIds, range, prevRange, from, prevFrom)
      .catch(err => {
        captureException(err, { route: 'GET /api/pizza-house/dashboard', phase: 'phone-customers' })
        return null
      })
    const merged = mergePhoneIntoPayload(payload, phoneCustomers, branchIds)

    const data = {
      branch,
      branches: branchesForUi,
      perBranch,
      range: { from, to, days: rangeDays },
      prev_range: { from: prevFrom, to: addDays(from, -1) },
      ...merged.payload,
      phoneCustomers,
      identity_source: merged.identity_source,
      coverage,
      generated_at: new Date().toISOString(),
    }

    cache.set(cacheKey, { data, at: Date.now() })
    // Keep memory bounded in long-lived instances
    if (cache.size > 50) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) cache.delete(oldest[0])
    }

    return NextResponse.json(data)
  } catch (err) {
    captureException(err, { route: 'GET /api/pizza-house/dashboard' })
    // Don't leak raw DB error text (schema/host details) to the client
    return NextResponse.json({ error: 'שגיאה בטעינת הנתונים' }, { status: 500 })
  }
}
