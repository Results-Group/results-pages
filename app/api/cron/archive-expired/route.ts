import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException, logger } from '@/lib/logger'

/**
 * GET /api/cron/archive-expired
 * Called daily by Vercel Cron (see vercel.json).
 * Moves any live campaign whose end date has passed to the archived state, so
 * stale creative stops occupying the active list. Reversible (status only).
 * Vercel injects Authorization: Bearer <CRON_SECRET>.
 */
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

  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'archived', updated_at: now })
      .lt('expires_at', now)
      .not('expires_at', 'is', null)
      // Only live campaigns: a draft that happens to carry a past end date must
      // stay a draft, and templates are never "live" to begin with.
      .eq('status', 'published')
      .eq('is_template', false)
      .is('deleted_at', null)
      .select('id, campaign_name, workspace_id')

    if (error) throw error

    const archived = data?.length ?? 0
    logger.info('archive-expired cron complete', { archived })
    if (archived > 0) {
      await logAudit({
        action: 'update',
        entity_type: 'campaign',
        entity_label: `Auto-archived ${archived} expired campaign(s)`,
        workspace_id: null,
        meta: { archived, source: 'cron' },
      })
    }
    return NextResponse.json({ ok: true, archived })
  } catch (err) {
    captureException(err, { route: 'GET /api/cron/archive-expired' })
    return NextResponse.json({ error: 'archive-expired failed' }, { status: 500 })
  }
}
