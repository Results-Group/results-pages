import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { summarize, monthlySeries, ACTION_METRICS, IMPRESSION_METRICS, type MetricRow } from '@/lib/gbp-metrics'

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

/**
 * Both branches, Mar-Jul 2026, transcribed from the Business Profile UI.
 * Each set reconciles to Google's own two headline figures exactly, which is
 * what made it safe to build the aggregation before having API access.
 */
const preview = (v: Record<string, number>): MetricRow[] =>
  Object.entries(v).map(([metric, value]) => ({ metric, day: '2026-07-01', value }))

const PREVIEW_BY_BRANCH: Record<string, { title: string; rows: MetricRow[] }> = {
  main: {
    title: 'גבעת זאב',
    rows: preview({
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 5624,
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: 4806,
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 1286,
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 208,
      CALL_CLICKS: 7020,
      BUSINESS_DIRECTION_REQUESTS: 337,
      WEBSITE_CLICKS: 2203,
      BUSINESS_FOOD_MENU_CLICKS: 63,
    }),
  },
  mevaseret: {
    title: 'מבשרת ציון',
    rows: preview({
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 2557,
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: 1130,
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 710,
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 90,
      CALL_CLICKS: 1565,
      BUSINESS_DIRECTION_REQUESTS: 339,
      WEBSITE_CLICKS: 714,
      BUSINESS_FOOD_MENU_CLICKS: 41,
    }),
  },
}

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
    // "all" sums the branches, the same way the live path sums their locations.
    const chosen = branch === 'all'
      ? Object.entries(PREVIEW_BY_BRANCH)
      : Object.entries(PREVIEW_BY_BRANCH).filter(([id]) => id === branch)
    if (chosen.length === 0) {
      return NextResponse.json({ connected: false, reason: 'אין נתוני הדגמה לסניף זה' })
    }
    return NextResponse.json({
      connected: true,
      preview: true,
      has_data: true,
      locations: chosen.map(([id, b]) => ({ title: `${b.title} (הדגמה)`, branch_id: id })),
      range: { from, to },
      summary: summarize(chosen.flatMap(([, b]) => b.rows)),
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
    // Monthly, not daily: these numbers move slowly and a daily line is noise.
    series: {
      views: monthlySeries(rows, IMPRESSION_METRICS),
      interactions: monthlySeries(rows, ACTION_METRICS),
    },
    // Empty until the first sync lands; the UI uses it to explain the state.
    has_data: rows.length > 0,
  })
}
