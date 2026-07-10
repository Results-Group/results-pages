import { NextRequest, NextResponse } from 'next/server'
import { syncClientsFromMonday, isMondayConfigured } from '@/lib/monday'
import { logAudit } from '@/lib/audit'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/sync-clients
 * Called daily by Vercel Cron (see vercel.json).
 * Vercel automatically injects an Authorization: Bearer <CRON_SECRET> header.
 */
export async function GET(req: NextRequest) {
  // Verify the request comes from Vercel Cron
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isMondayConfigured()) {
    logger.info('Monday.com cron: skipped (not configured)')
    return NextResponse.json({ skipped: true, reason: 'not configured' })
  }

  try {
    const result = await syncClientsFromMonday()
    logger.info('Monday.com cron sync complete', result)

    await logAudit({
      action: 'create',
      entity_type: 'client',
      entity_label: `Monday cron sync: ${result.created} created, ${result.skipped} skipped`,
      workspace_id: process.env.MONDAY_SYNC_WORKSPACE_ID ?? null,
      meta: { ...result, source: 'cron' },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    captureException(err, { route: 'GET /api/cron/sync-clients' })
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
