import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { listPizzaBranches } from '@/lib/pizza-house-db'
import { recentSyncAlerts } from '@/lib/pizza-house-sync-watch'
import { QUIET_MAX_ORDERS } from '@/lib/pizza-house-sync-watch-pure'
import { captureException } from '@/lib/logger'

/**
 * GET /api/pizza-house/sync-alerts — days a branch's till sent nothing, for
 * the status strip in the activity log (next to the backup status). Platform
 * owner/admin only; the shared Pizza House password is a scoped session and
 * never gets here.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(session.isOwner || session.role === 'admin')) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }
  try {
    const alerts = await recentSyncAlerts()
    const branches = listPizzaBranches()
    const label = (id: string) => branches.find(b => b.id === id)?.label ?? id
    return NextResponse.json({
      alerts: alerts.map(a => ({
        ...a,
        label: label(a.branch_id),
        // Aviv re-sent the day since it was flagged.
        resolved: a.orders_now > QUIET_MAX_ORDERS,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    captureException(err, { route: 'GET /api/pizza-house/sync-alerts' })
    return NextResponse.json({ error: 'שגיאה בטעינת הנתונים' }, { status: 500 })
  }
}
