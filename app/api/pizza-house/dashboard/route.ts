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

/** All 12 datasets for the current AsyncLocalStorage branch context. */
async function fetchBranchData(range: DateRange, prevRange: DateRange, rangeDays: number): Promise<BranchData> {
  const [summary, prev_summary, timeseries, heatmap, weekdays, customers, products, channels, payments, orderTiming, deadItems, freshness] =
    await Promise.all([
      fetchSummary(range), fetchSummary(prevRange), fetchTimeseries(range, rangeDays), fetchHeatmap(range),
      fetchWeekdays(range), fetchCustomers(range), fetchProducts(range, prevRange), fetchChannels(range),
      fetchPayments(range), fetchOrderTiming(range), fetchDeadItems(range), fetchFreshness(),
    ])
  return { summary, prev_summary, timeseries, heatmap, weekdays, customers, products, channels, payments, orderTiming, deadItems, freshness } as unknown as BranchData
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

  try {
    let payload: BranchData
    let perBranch: { id: string; label: string; summary: unknown; prev_summary: unknown }[] | null = null

    if (branch === 'all') {
      // Fetch every branch in parallel, then aggregate + keep a per-branch breakdown.
      const perBranchData = await Promise.all(
        available.map(b => runWithBranch(b.id, () => fetchBranchData(range, prevRange, rangeDays))),
      )
      payload = aggregateBranches(perBranchData)
      perBranch = available.map((b, i) => ({
        id: b.id, label: b.label,
        summary: perBranchData[i].summary, prev_summary: perBranchData[i].prev_summary,
      }))
    } else {
      payload = await runWithBranch(branch, () => fetchBranchData(range, prevRange, rangeDays))
    }

    const data = {
      branch,
      branches: branchesForUi,
      perBranch,
      range: { from, to, days: rangeDays },
      prev_range: { from: prevFrom, to: addDays(from, -1) },
      ...payload,
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
