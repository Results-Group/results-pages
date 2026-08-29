import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { pizzaHouseQuery } from '@/lib/pizza-house-db'
import { captureException } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Same gate as the dashboard: a Pizza House token must actually be scoped to
 * Pizza House, and a platform token must be a non-scoped owner/admin. This
 * accepted ANY valid session until 2026-08-29, so a viewer created for an
 * unrelated client could read the till's lifetime deal count — and, on
 * failure, the raw mysql2 error, which names the POS host, user and port.
 */
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

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startedAt = Date.now()
  try {
    const rows = await pizzaHouseQuery<{ total: number; last_deal: string }>(
      'SELECT COUNT(*) as total, MAX(tm_open) as last_deal FROM deals'
    )
    return NextResponse.json({
      ok: true,
      latency_ms: Date.now() - startedAt,
      total_deals: rows[0]?.total ?? null,
      last_deal: rows[0]?.last_deal ?? null,
    })
  } catch (err) {
    // The real error goes to Sentry, never to the caller.
    captureException(err, { route: 'GET /api/pizza-house/health' })
    return NextResponse.json(
      { ok: false, latency_ms: Date.now() - startedAt, error: 'הקופה אינה זמינה' },
      { status: 500 },
    )
  }
}
