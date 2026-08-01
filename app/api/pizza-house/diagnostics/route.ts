import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { runWithBranch, isPizzaBranch, pizzaHouseQuery } from '@/lib/pizza-house-db'

/**
 * TEMPORARY read-only diagnostics — round 3 (final) of the 2026-08-01
 * dashboard investigation. Two questions left: does deals.paydesk expose a
 * dedicated delivery station (→ fee-less delivery undercount), and does
 * dc_deals carry usable meal-card identity (fill rates only, no values).
 * Aggregates only. DELETE THIS FILE after one read.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const ph = req.cookies.get('ph_session')?.value
  if (ph) {
    const phSession = await verifySessionToken(ph)
    if (phSession?.scope === 'pizza-house') return true
  }
  const rp = req.cookies.get('rp_session')?.value
  if (rp) {
    const session = await verifySessionToken(rp)
    if (session && (session.isOwner || session.role === 'admin')) return true
  }
  return false
}

const FEE = "(p.name LIKE '%משלוח%' OR p.name LIKE '%מישלוח%')"

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    return { error: `${label}: ${e instanceof Error ? e.message.slice(0, 200) : 'failed'}` }
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const branch = req.nextUrl.searchParams.get('branch') || 'main'
  if (!isPizzaBranch(branch)) {
    return NextResponse.json({ error: 'Unknown branch' }, { status: 400 })
  }
  const FROM = '2026-07-01'
  const TO = '2026-08-01'

  const data = await runWithBranch(branch, async () => {
    // ── Delivery: does the station number carry the channel? ──
    // For each paydesk in July (positive-sum deals): how many deals carry a
    // delivery-fee item vs not, and the average ticket of each half.
    const byPaydesk = await safe('byPaydesk', () => pizzaHouseQuery(
      `SELECT d.paydesk,
              COUNT(*) as orders,
              SUM(CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE}) THEN 1 ELSE 0 END) as with_fee,
              SUM(CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE}) THEN 0 ELSE 1 END) as without_fee,
              ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE}) THEN d.sum END), 2) as avg_with_fee,
              ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE}) THEN NULL ELSE d.sum END), 2) as avg_without_fee
       FROM deals d
       WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
       GROUP BY d.paydesk ORDER BY orders DESC`, [FROM, TO]))

    // Hour-of-day profile per paydesk half — a delivery station's fee-less
    // deals should mirror its fee-bearing hours, not the walk-in counter's.
    const hourlyShape = await safe('hourlyShape', () => pizzaHouseQuery(
      `SELECT d.paydesk,
              CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE}) THEN 'fee' ELSE 'nofee' END as half,
              SUM(CASE WHEN HOUR(d.tm_open) BETWEEN 11 AND 16 THEN 1 ELSE 0 END) as noon,
              SUM(CASE WHEN HOUR(d.tm_open) BETWEEN 17 AND 23 THEN 1 ELSE 0 END) as evening
       FROM deals d
       WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
       GROUP BY d.paydesk, half ORDER BY d.paydesk, half`, [FROM, TO]))

    // ── Meal-card identity: fill rates in dc_deals (no values) ──
    const dcIdentity = await safe('dcIdentity', async () =>
      (await pizzaHouseQuery(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN id_card IS NOT NULL AND id_card NOT IN ('', '---', '0') THEN 1 ELSE 0 END) as id_card_filled,
                COUNT(DISTINCT CASE WHEN id_card NOT IN ('', '---', '0') THEN id_card END) as id_card_distinct,
                SUM(CASE WHEN name IS NOT NULL AND name NOT IN ('', '---', '0') THEN 1 ELSE 0 END) as name_filled,
                COUNT(DISTINCT CASE WHEN name NOT IN ('', '---', '0') THEN name END) as name_distinct,
                SUM(CASE WHEN name_company IS NOT NULL AND name_company NOT IN ('', '---', '0') THEN 1 ELSE 0 END) as company_filled,
                COUNT(DISTINCT CASE WHEN name_company NOT IN ('', '---', '0') THEN name_company END) as company_distinct
         FROM dc_deals`))[0])

    // How many July meal-card orders would gain an identity
    const dcJuly = await safe('dcJuly', async () =>
      (await pizzaHouseQuery(
        `SELECT COUNT(*) as rows_cnt,
                COUNT(DISTINCT CASE WHEN id_card NOT IN ('', '---', '0') THEN id_card END) as distinct_cards
         FROM dc_deals WHERE date >= ? AND date < ? AND isreturn = 0`, [FROM, TO]))[0])

    return { branch, byPaydesk, hourlyShape, dcIdentity, dcJuly }
  })

  return NextResponse.json(data)
}
