import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { summarize, dailySeries, ACTION_METRICS, IMPRESSION_METRICS, type MetricRow } from '@/lib/gbp-metrics'

/**
 * GET /api/pizza-house/gbp?from=&to=&branch=
 *
 * Serves the cached Business Profile numbers for the dashboard. Reads only our
 * own table — never Google — so the panel renders at page speed and keeps
 * working when Google doesn't.
 *
 * Returns `connected: false` rather than an error when nothing has been synced
 * yet, so the dashboard can explain itself instead of showing a broken widget.
 */

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Givat Ze'ev, Mar-Jul 2026, transcribed from the Business Profile UI. */
const PREVIEW_GIVAT_ZEEV: MetricRow[] = [
  { metric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', day: '2026-07-01', value: 5624 },
  { metric: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', day: '2026-07-01', value: 4806 },
  { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', day: '2026-07-01', value: 1286 },
  { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', day: '2026-07-01', value: 208 },
  { metric: 'CALL_CLICKS', day: '2026-07-01', value: 7020 },
  { metric: 'BUSINESS_DIRECTION_REQUESTS', day: '2026-07-01', value: 337 },
  { metric: 'WEBSITE_CLICKS', day: '2026-07-01', value: 2203 },
  { metric: 'BUSINESS_FOOD_MENU_CLICKS', day: '2026-07-01', value: 63 },
]

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const ph = req.cookies.get('ph_session')?.value
  if (ph) {
    const phSession = await verifySessionToken(ph)
    if (phSession?.scope === 'pizza-house') return true
  }
  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    if (session && !session.scope && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function rowsFor(locations: string[], from: string, to: string): Promise<MetricRow[]> {
  if (locations.length === 0) return []
  const { data, error } = await supabase
    .from('gbp_daily_metrics')
    .select('metric,day,value')
    .in('location_resource', locations)
    .gte('day', from)
    .lte('day', to)
  if (error) throw error
  return (data || []) as MetricRow[]
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  const branch = searchParams.get('branch') || 'main'

  // Preview: the real figures read off the Business Profile UI, so the panel can
  // be reviewed before Google grants quota. Totals only — the source is a
  // five-month summary, and spreading it over daily rows would be inventing a
  // shape we have never seen. Owner/admin only, flagged in the response, and
  // never written to the metrics table.
  if (searchParams.get('preview') === '1') {
    const rp = req.cookies.get('rp_session')?.value
    const session = rp ? await verifySessionToken(rp) : null
    if (!session || session.scope || !(session.isOwner || session.role === 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      connected: true,
      preview: true,
      has_data: true,
      locations: [{ title: 'גבעת זאב (נתוני הדגמה)', branch_id: 'main' }],
      range: { from, to },
      summary: summarize(PREVIEW_GIVAT_ZEEV),
      prev_summary: summarize([]),
      series: null,
    })
  }

  // Unmapped listings are deliberately included in the "all" view rather than
  // hidden: better to show a number attributed to no branch than to silently
  // drop a location nobody remembered to map.
  let query = supabase.from('gbp_locations').select('location_resource,title,branch_id')
  if (branch !== 'all') query = query.eq('branch_id', branch)
  const { data: locations, error } = await query
  if (error) throw error

  if (!locations || locations.length === 0) {
    return NextResponse.json({
      connected: false,
      reason: branch === 'all'
        ? 'טרם חובר פרופיל עסקי'
        : 'לא מופה סניף בפרופיל העסקי',
    })
  }

  const resources = locations.map(l => l.location_resource)
  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const prevFrom = shiftDays(from, -spanDays)
  const prevTo = shiftDays(from, -1)

  const [rows, prevRows] = await Promise.all([
    rowsFor(resources, from, to),
    rowsFor(resources, prevFrom, prevTo),
  ])

  return NextResponse.json({
    connected: true,
    locations: locations.map(l => ({ title: l.title, branch_id: l.branch_id })),
    range: { from, to },
    prev_range: { from: prevFrom, to: prevTo },
    summary: summarize(rows),
    prev_summary: summarize(prevRows),
    series: {
      views: dailySeries(rows, IMPRESSION_METRICS, from, to),
      interactions: dailySeries(rows, ACTION_METRICS, from, to),
    },
    // Empty until the first sync lands; the UI uses it to explain the state.
    has_data: rows.length > 0,
  })
}
