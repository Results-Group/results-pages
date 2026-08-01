import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { runWithBranch, isPizzaBranch, pizzaHouseQuery } from '@/lib/pizza-house-db'

/**
 * TEMPORARY read-only diagnostics — round 2 of the 2026-08-01 dashboard
 * investigation. Round 1 established: DB history starts 2026-06-25, no
 * identity columns are populated anywhere, and dc_deals (852 rows) is the
 * remaining delivery-undercount suspect. This round: what dc_deals is, how it
 * overlaps the fee-item heuristic, and how far z_info reaches back.
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
const IDENT_RE = /^[A-Za-z0-9_]+$/

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
    const dcCols = await safe('dcCols', () => pizzaHouseQuery<{ Field: string; Type: string }>(
      `SHOW COLUMNS FROM dc_deals`))
    const fields = Array.isArray(dcCols) ? dcCols.map(c => c.Field).filter(f => IDENT_RE.test(f)) : []
    const dateField = fields.find(f => /date|tm|time/i.test(f))

    const dc: Record<string, unknown> = {
      columns: Array.isArray(dcCols) ? dcCols.map(c => `${c.Field}:${c.Type}`) : dcCols,
    }

    dc.byType = await safe('dcTypes', () => pizzaHouseQuery(
      `SELECT type, COUNT(*) as rows_cnt FROM dc_deals GROUP BY type`))

    if (dateField) {
      dc.range = await safe('dcRange', async () =>
        (await pizzaHouseQuery(
          `SELECT MIN(\`${dateField}\`) as first, MAX(\`${dateField}\`) as last, COUNT(*) as rows_total FROM dc_deals`))[0])
    }

    if (fields.includes('id_deal')) {
      // dc_deals that are real July orders (positive-sum deals)
      dc.julyOrders = await safe('dcJuly', async () =>
        (await pizzaHouseQuery(
          `SELECT COUNT(DISTINCT d.id_deal) as n, ROUND(AVG(d.sum),2) as avg_order
           FROM dc_deals dc JOIN deals d ON d.id_deal = dc.id_deal
           WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0`, [FROM, TO]))[0])

      // ...of those, how many the fee-item heuristic MISSES
      dc.julyOrdersWithoutFeeItem = await safe('dcNoFee', async () =>
        (await pizzaHouseQuery(
          `SELECT COUNT(DISTINCT d.id_deal) as n, ROUND(AVG(d.sum),2) as avg_order
           FROM dc_deals dc JOIN deals d ON d.id_deal = dc.id_deal
           WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
             AND NOT EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE})`,
          [FROM, TO]))[0])

      dc.julyByType = await safe('dcJulyByType', () => pizzaHouseQuery(
        `SELECT dc.type, COUNT(DISTINCT d.id_deal) as orders, ROUND(AVG(d.sum),2) as avg_order
         FROM dc_deals dc JOIN deals d ON d.id_deal = dc.id_deal
         WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0
         GROUP BY dc.type`, [FROM, TO]))
    }

    // The corrected metric, previewed: positive-sum July deals that are
    // delivery by EITHER signal (fee item OR dc_deals row), on the same
    // denominator the KPI uses.
    const corrected = await safe('corrected', async () => {
      const [row] = await pizzaHouseQuery<{ orders: number; delivery: number }>(
        `SELECT COUNT(*) as orders,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM paymentitm p WHERE p.id_deal = d.id_deal AND ${FEE})
                          ${fields.includes('id_deal') ? "OR EXISTS (SELECT 1 FROM dc_deals dc WHERE dc.id_deal = d.id_deal)" : ''}
                     THEN 1 ELSE 0 END) as delivery
         FROM deals d WHERE d.tm_open >= ? AND d.tm_open < ? AND d.sum > 0`, [FROM, TO])
      return row
    })

    // z_info: does the Z-report history reach back years?
    const zCols = await safe('zCols', () => pizzaHouseQuery<{ Field: string; Type: string }>(
      `SHOW COLUMNS FROM z_info`))
    const zFields = Array.isArray(zCols) ? zCols.map(c => c.Field).filter(f => IDENT_RE.test(f)) : []
    const zDate = zFields.find(f => /date|tm|time/i.test(f))
    const zInfo: Record<string, unknown> = {
      columns: Array.isArray(zCols) ? zCols.map(c => `${c.Field}:${c.Type}`) : zCols,
    }
    if (zDate) {
      zInfo.range = await safe('zRange', async () =>
        (await pizzaHouseQuery(
          `SELECT MIN(\`${zDate}\`) as first, MAX(\`${zDate}\`) as last, COUNT(*) as rows_total FROM z_info`))[0])
      zInfo.yearly = await safe('zYearly', () => pizzaHouseQuery(
        `SELECT DATE_FORMAT(\`${zDate}\`, '%Y') as y, COUNT(*) as rows_cnt
         FROM z_info GROUP BY y ORDER BY y DESC LIMIT 12`))
    }

    return { branch, dc, corrected, zInfo }
  })

  return NextResponse.json(data)
}
