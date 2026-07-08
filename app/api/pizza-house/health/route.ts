import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { pizzaHouseQuery } from '@/lib/pizza-house-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const phToken = req.cookies.get('ph_session')?.value
  const rpToken = req.cookies.get('rp_session')?.value
  const phValid = phToken ? await verifySessionToken(phToken) : null
  const rpValid = rpToken ? await verifySessionToken(rpToken) : null
  if (!phValid && !rpValid) {
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
    return NextResponse.json(
      {
        ok: false,
        latency_ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
