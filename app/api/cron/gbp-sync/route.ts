import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  getConnections,
  openToken,
  accessTokenFor,
  fetchDailyMetrics,
  isGbpConfigured,
} from '@/lib/google-business'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/gbp-sync
 *
 * Nightly pull of Business Profile metrics into our own table.
 *
 * Cached rather than fetched live for three reasons: Google's quota is finite
 * and hard-won, the numbers only move once a day, and a dashboard that calls
 * Google on every page load fails whenever Google is slow. Caching also builds
 * history past the 18 months the Performance API will serve.
 *
 * ?days=N re-pulls a longer window (used for the initial backfill). Google's
 * data lags 2-3 days, so the last days of any window come back empty — that is
 * expected, not a failure.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_DAYS = 7
const MAX_DAYS = 540

function ymd(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  // Sec-Fetch-Site is written by the browser, not the page, so a page cannot
  // forge it. `cross-site` means something else navigated the admin here —
  // rp_session is SameSite=Lax, which still rides a top-level navigation, so
  // without this a link on any site would run the job. A typed or bookmarked
  // URL sends `none` and a link inside the admin sends `same-origin`; both
  // are the real manual-run flow and both still work.
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false
  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    if (session && !session.scope && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isGbpConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Google OAuth not configured' })
  }

  const requested = Number(req.nextUrl.searchParams.get('days') || DEFAULT_DAYS)
  const days = Math.min(Math.max(Number.isFinite(requested) ? requested : DEFAULT_DAYS, 1), MAX_DAYS)

  const to = new Date()
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - days)

  const connections = await getConnections()
  if (connections.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no connection stored' })
  }

  const results: Record<string, unknown>[] = []

  for (const conn of connections) {
    let accessToken: string
    try {
      accessToken = await accessTokenFor(openToken(conn.refresh_token_enc))
    } catch (err) {
      // A dead refresh token needs a human to re-consent; record it rather than
      // failing silently every night.
      const message = err instanceof Error ? err.message.slice(0, 300) : 'unknown'
      captureException(err, { route: 'GET /api/cron/gbp-sync', step: 'token', account: conn.account_email })
      await supabase.from('gbp_connections').update({ last_sync_error: message }).eq('id', conn.id)
      results.push({ account: conn.account_email, error: message })
      continue
    }

    const { data: locations } = await supabase
      .from('gbp_locations')
      .select('location_resource,title')
      .eq('connection_id', conn.id)

    if (!locations || locations.length === 0) {
      results.push({ account: conn.account_email, skipped: 'no locations discovered yet' })
      continue
    }

    for (const loc of locations) {
      try {
        const rows = await fetchDailyMetrics(loc.location_resource, ymd(from), ymd(to), accessToken)
        if (rows.length > 0) {
          const { error } = await supabase.from('gbp_daily_metrics').upsert(
            rows.map(r => ({
              location_resource: loc.location_resource,
              metric: r.metric,
              day: r.day,
              value: r.value,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'location_resource,metric,day' }
          )
          if (error) throw error
        }
        results.push({ location: loc.title ?? loc.location_resource, rows: rows.length })
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 300) : 'unknown'
        captureException(err, { route: 'GET /api/cron/gbp-sync', location: loc.location_resource })
        results.push({ location: loc.title ?? loc.location_resource, error: message })
      }
    }

    await supabase
      .from('gbp_connections')
      .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
      .eq('id', conn.id)
  }

  const failed = results.filter(r => r.error).length
  logger.info(`GBP sync: ${results.length - failed}/${results.length} locations ok`)
  return NextResponse.json({ ok: failed === 0, days, results })
}
