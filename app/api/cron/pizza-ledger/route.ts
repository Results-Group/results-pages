import { NextRequest, NextResponse } from 'next/server'
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
export const maxDuration = 60

const MAX_BACKFILL_DAYS = 45

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured — refusing cron request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
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
