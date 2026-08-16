import { NextRequest, NextResponse } from 'next/server'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/dme-integrity
 * Called daily by Vercel Cron (see vercel.json).
 * Triggers the DME app's data-integrity scan (Base44 function `scheduledHealthCheck`)
 * and raises a Sentry event when critical issues come back.
 *
 * Why this lives here and not in DME: Base44 gives us no scheduler we control, and the
 * scan sat unreachable behind an admin-session gate — "scheduled" in name only — while
 * clients accumulated duplicate cards for six weeks (2026-06/08 incident). Sentry alone
 * cannot catch that class of bug: a dead permission rule is a *successful* query that
 * returns nothing, so no exception is ever thrown. This cron turns silent data
 * corruption into an explicit Sentry signal the team already watches.
 *
 * Vercel injects Authorization: Bearer <CRON_SECRET>. The DME side authenticates the
 * call with its own CRON_SECRET (env DME_CRON_SECRET here), sent as x-cron-secret.
 */

const DME_APP_ID = '68828e03342cb02ba62aa598'
const HEALTH_CHECK_URL = `https://base44.app/api/apps/${DME_APP_ID}/functions/scheduledHealthCheck`

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured — refusing cron request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dmeSecret = process.env.DME_CRON_SECRET
  if (!dmeSecret) {
    // Feature-off convention: a missing key disables the feature rather than erroring
    // every night. But a disabled integrity scan should still be visible once.
    logger.warn('DME_CRON_SECRET is not set — DME integrity scan skipped')
    return NextResponse.json({ skipped: true, reason: 'DME_CRON_SECRET not configured' })
  }

  try {
    const res = await fetch(HEALTH_CHECK_URL, {
      method: 'POST',
      headers: { 'x-cron-secret': dmeSecret, 'content-type': 'application/json' },
      body: '{}',
    })
    const report = await res.json().catch(() => null)

    if (!res.ok || !report?.success) {
      throw new Error(
        `DME health check failed: HTTP ${res.status} ${JSON.stringify(report)?.slice(0, 300)}`
      )
    }

    const stats = report.stats ?? {}
    logger.info('dme-integrity cron complete', { ...stats })

    if ((stats.highSeverity ?? 0) > 0) {
      // The scan also emails ADMIN_EMAIL from the DME side; this makes the same finding
      // page someone through the alerting channel that is actually monitored.
      captureException(
        new Error(
          `DME data integrity: ${stats.highSeverity} critical issue(s), ${stats.totalIssues} total`
        ),
        { stats }
      )
    }

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    captureException(err)
    logger.error('dme-integrity cron failed', { error: String(err) })
    return NextResponse.json({ error: 'DME integrity scan failed' }, { status: 500 })
  }
}
