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
import { captureException } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<string, { data: unknown; at: number }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // The dedicated Pizza House session (from the shared dashboard password).
  const ph = req.cookies.get('ph_session')?.value
  if (ph && (await verifySessionToken(ph))) return true
  // Platform users may view it too, but only global admins/owners — a viewer
  // or editor from an unrelated workspace must not reach this client's
  // financial + customer PII.
  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    if (session && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? '' // inclusive calendar date

  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  const cacheKey = `${from}|${to}`
  const cached = cache.get(cacheKey)
  const isCurrentRange = to >= new Date().toISOString().slice(0, 10)
  // Ranges including today get a short TTL so fresh sales show up quickly
  const ttl = isCurrentRange ? 10 * 60 * 1000 : CACHE_TTL_MS
  if (cached && Date.now() - cached.at < ttl && !searchParams.has('refresh')) {
    return NextResponse.json(cached.data)
  }

  const rangeDays = daysBetween(from, to) + 1
  const range: DateRange = { from: `${from} 00:00:00`, to: `${addDays(to, 1)} 00:00:00` }
  const prevFrom = addDays(from, -rangeDays)
  const prevRange: DateRange = { from: `${prevFrom} 00:00:00`, to: `${from} 00:00:00` }

  try {
    const [summary, prevSummary, timeseries, heatmap, weekdays, customers, products, channels, payments, orderTiming, deadItems, freshness] =
      await Promise.all([
        fetchSummary(range),
        fetchSummary(prevRange),
        fetchTimeseries(range, rangeDays),
        fetchHeatmap(range),
        fetchWeekdays(range),
        fetchCustomers(range),
        fetchProducts(range, prevRange),
        fetchChannels(range),
        fetchPayments(range),
        fetchOrderTiming(range),
        fetchDeadItems(range),
        fetchFreshness(),
      ])

    const data = {
      range: { from, to, days: rangeDays },
      prev_range: { from: prevFrom, to: addDays(from, -1) },
      summary,
      prev_summary: prevSummary,
      timeseries,
      heatmap,
      weekdays,
      customers,
      products,
      channels,
      payments,
      orderTiming,
      deadItems,
      freshness,
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
