import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { runWithBranch, listPizzaBranches } from '@/lib/pizza-house-db'
import { fetchDayIdentities, recordDay, logLedgerRun } from '@/lib/pizza-house-ledger'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/pizza-ledger
 *
 * Nightly: fold yesterday's customer identities into our own ledger, because
 * the POS purges its deal tables and we cannot recover history after the fact.
 * Every night skipped is a night of customer history lost for good.
 *
 * ?days=N replays the last N days — used to backfill the window the POS still
 * holds when the ledger is first switched on. Folding a day twice is a no-op.
 */

export const dynamic = 'force-dynamic'
// 300, not 60: a 40-day × 2-branch backfill takes ~2 minutes against the POS,
// and at 60s the function died mid-run (504) with the tail days never folded.
export const maxDuration = 300

const MAX_BACKFILL_DAYS = 45

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Vercel Cron presents the shared secret; a signed-in owner/admin may also run
 * it by hand. The backfill has to happen while the POS still holds the days —
 * requiring the secret would mean copying it out of Vercel to a terminal, and
 * the job only ever reads the POS and writes our own ledger.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return true

  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    if (session && !session.scope && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    logger.error('CRON_SECRET is not configured — refusing cron request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const branches = listPizzaBranches()
  if (branches.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no branch configured' })
  }

  const requested = Number(req.nextUrl.searchParams.get('days') || '1')
  const days = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), MAX_BACKFILL_DAYS)
  // Day 1 = yesterday: today is still open at the till.
  const targets = Array.from({ length: days }, (_, i) => isoDaysAgo(i + 1)).reverse()

  const results: Record<string, unknown>[] = []
  for (const branch of branches) {
    for (const day of targets) {
      try {
        const identities = await runWithBranch(branch.id, () => fetchDayIdentities(day))
        const { seen, created } = await recordDay(branch.id, day, identities)
        await logLedgerRun({
          branch_id: branch.id, covered_date: day,
          identities_seen: seen, new_identities: created, ok: true,
        })
        results.push({ branch: branch.id, day, seen, created })
      } catch (err) {
        // One bad day must not abort the rest — a gap in one branch is better
        // than losing every branch's night.
        captureException(err, { route: 'GET /api/cron/pizza-ledger', branch: branch.id, day })
        await logLedgerRun({
          branch_id: branch.id, covered_date: day,
          identities_seen: 0, new_identities: 0, ok: false,
          error: err instanceof Error ? err.message.slice(0, 300) : 'unknown',
        }).catch(() => { /* bookkeeping must never mask the original failure */ })
        results.push({ branch: branch.id, day, error: true })
      }
    }
  }

  const failed = results.filter(r => r.error).length
  logger.info(`Pizza ledger cron: ${results.length - failed}/${results.length} day-branch folds ok`)
  return NextResponse.json({ ok: failed === 0, days, results })
}
