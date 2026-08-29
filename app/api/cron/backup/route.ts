import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  backupTarget, ensureBucket, dumpTables, listAllObjects, copyChangedFiles,
  writeSnapshot, pruneOldSnapshots,
} from '@/lib/backup'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/backup
 *
 * Nightly snapshot of every table plus an incremental copy of storage.
 * Same authorization shape as the pizza-ledger cron: Vercel's shared secret,
 * or a signed-in owner/admin who wants to force a run.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return true

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
  if (!process.env.CRON_SECRET) {
    logger.error('CRON_SECRET is not configured — refusing cron request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const { client: target, offsite, id: targetId } = backupTarget()

  try {
    await ensureBucket(target)
    const { dumps, total } = await dumpTables()
    const objects = await listAllObjects()
    const snapshotPath = await writeSnapshot(dumps, objects, target)
    const { copied, bytes, remaining } = await copyChangedFiles(objects, target, targetId)
    const pruned = await pruneOldSnapshots(target)

    await supabase.from('backup_runs').insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: true,
      table_rows: total,
      files_total: objects.length,
      files_copied: copied,
      bytes_copied: bytes,
      snapshot_path: snapshotPath,
    })

    logger.info(
      `Backup ok: ${total} rows, ${objects.length} files (${copied} copied, ${remaining} pending), ` +
      `${pruned} old snapshots pruned, offsite=${offsite}`
    )
    return NextResponse.json({
      ok: true, offsite, table_rows: total,
      files_total: objects.length, files_copied: copied, files_pending: remaining,
      bytes_copied: bytes, snapshot: snapshotPath, pruned,
    })
  } catch (err) {
    // A backup that fails quietly is the worst outcome — it buys confidence
    // without cover. Record the failure so the gap is visible.
    captureException(err, { route: 'GET /api/cron/backup' })
    try {
      await supabase.from('backup_runs').insert({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
      })
    } catch {
      // bookkeeping must not mask the original failure
    }

    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Backup failed' },
      { status: 500 }
    )
  }
}
