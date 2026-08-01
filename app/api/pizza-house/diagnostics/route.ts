import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { runWithBranch, isPizzaBranch, pizzaHouseQuery } from '@/lib/pizza-house-db'

/**
 * TEMPORARY read-only diagnostics — investigating three client reports on the
 * dashboard numbers (2026-08-01): delivery undercount, returning-customers
 * near zero despite years of history, and customer-identity signals beyond the
 * credit card. Same pattern as the July phone-hunt inspectors: deploy, query
 * once through an authorized session, analyze, DELETE THIS FILE.
 *
 * Everything returned is aggregate — counts, fill rates, column names, item
 * names. No customer values ever leave the DB.
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

const IDENT_RE = /^[A-Za-z0-9_]+$/
/** Column-name patterns that could carry customer identity or order channel. */
const HUNT_RE = 'phone|tel|mail|addr|street|city|client|cust|deliver|courier|shipp|order_type|type|source|origin|takeaway|remark|comment|note'

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
    // ── 1. How deep does the data actually go? ──
    const depth = await safe('depth', async () => ({
      deals: (await pizzaHouseQuery(
        `SELECT MIN(tm_open) as first, MAX(tm_open) as last, COUNT(*) as rows_total FROM deals`))[0],
      creditcard: (await pizzaHouseQuery(
        `SELECT MIN(date) as first, MAX(date) as last, COUNT(*) as rows_total FROM creditcard`))[0],
      dealsMonthly: await pizzaHouseQuery(
        `SELECT DATE_FORMAT(tm_open, '%Y-%m') as ym, COUNT(*) as deals
         FROM deals GROUP BY ym ORDER BY ym DESC LIMIT 40`),
      creditcardMonthly: await pizzaHouseQuery(
        `SELECT DATE_FORMAT(date, '%Y-%m') as ym, COUNT(*) as rows_cnt
         FROM creditcard GROUP BY ym ORDER BY ym DESC LIMIT 40`),
    }))

    // ── 2. Returning-customers: is validto churn destroying identity? ──
    const returning = await safe('returning', async () => ({
      julyCards_cardPlusValidto: (await pizzaHouseQuery(
        `SELECT COUNT(DISTINCT CONCAT(id_card,'|',validto)) as n FROM creditcard
         WHERE date >= ? AND date < ? AND id_card != '' AND sum > 0`, [FROM, TO]))[0],
      returning_cardPlusValidto: (await pizzaHouseQuery(
        `SELECT COUNT(DISTINCT CONCAT(c.id_card,'|',c.validto)) as n FROM creditcard c
         WHERE c.date >= ? AND c.date < ? AND c.id_card != '' AND c.sum > 0
           AND EXISTS (SELECT 1 FROM creditcard p
                       WHERE p.id_card = c.id_card AND p.validto = c.validto AND p.date < ?)`,
        [FROM, TO, FROM]))[0],
      returning_cardOnly: (await pizzaHouseQuery(
        `SELECT COUNT(DISTINCT c.id_card) as n FROM creditcard c
         WHERE c.date >= ? AND c.date < ? AND c.id_card != '' AND c.sum > 0
           AND EXISTS (SELECT 1 FROM creditcard p
                       WHERE p.id_card = c.id_card AND p.date < ?)`,
        [FROM, TO, FROM]))[0],
      cardsBeforeJuly: (await pizzaHouseQuery(
        `SELECT COUNT(DISTINCT id_card) as n FROM creditcard WHERE date < ? AND id_card != ''`,
        [FROM]))[0],
    }))

    // ── 3. Delivery: what does the item ledger actually contain? ──
    const delivery = await safe('delivery', async () => ({
      topItems: await pizzaHouseQuery(
        `SELECT name, COUNT(DISTINCT id_deal) as deals, ROUND(SUM(sum),0) as total
         FROM paymentitm WHERE date >= ? AND date < ?
         GROUP BY name ORDER BY deals DESC LIMIT 50`, [FROM, TO]),
      deliveryishNames: await pizzaHouseQuery(
        `SELECT name, COUNT(DISTINCT id_deal) as deals, ROUND(SUM(sum),0) as total
         FROM paymentitm WHERE date >= ? AND date < ?
           AND (name LIKE '%שליח%' OR name LIKE '%חינם%' OR name LIKE '%וולט%'
                OR LOWER(name) LIKE '%wolt%' OR name LIKE '%תן ביס%' OR name LIKE '%ביס%'
                OR LOWER(name) LIKE '%deliver%' OR name LIKE '%הובלה%' OR name LIKE '%משלוח%')
         GROUP BY name ORDER BY deals DESC LIMIT 40`, [FROM, TO]),
    }))

    // ── 4. Schema hunt: identity + channel signals anywhere in the DB ──
    const huntCols = await safe('hunt', () => pizzaHouseQuery<{ t: string; c: string; dt: string }>(
      `SELECT TABLE_NAME as t, COLUMN_NAME as c, DATA_TYPE as dt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME REGEXP ?
       ORDER BY TABLE_NAME, COLUMN_NAME`, [HUNT_RE]))

    const tables = await safe('tables', () => pizzaHouseQuery<{ t: string; rows_est: number }>(
      `SELECT TABLE_NAME as t, TABLE_ROWS as rows_est FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_ROWS DESC`))

    const dealsCols = await safe('dealsCols', () => pizzaHouseQuery(
      `SHOW COLUMNS FROM deals`))

    // ── 5. Fill rates for hunted columns (aggregates only, capped) ──
    const fillRates: Record<string, unknown> = {}
    if (Array.isArray(huntCols) && Array.isArray(tables)) {
      const sizeByTable = new Map(tables.map(x => [x.t, Number(x.rows_est) || 0]))
      for (const { t, c } of huntCols.slice(0, 30)) {
        if (!IDENT_RE.test(t) || !IDENT_RE.test(c)) continue
        if ((sizeByTable.get(t) ?? 0) > 3_000_000) { fillRates[`${t}.${c}`] = 'skipped (too large)'; continue }
        fillRates[`${t}.${c}`] = await safe(`${t}.${c}`, async () =>
          (await pizzaHouseQuery(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN \`${c}\` IS NOT NULL AND \`${c}\` NOT IN ('', '---', '0') THEN 1 ELSE 0 END) as filled,
                    COUNT(DISTINCT \`${c}\`) as distinct_vals
             FROM \`${t}\``))[0])
      }
    }

    // ── 6. Channel flags: GROUP BY any deals column that smells like a type ──
    const channelFlags: Record<string, unknown> = {}
    if (Array.isArray(dealsCols)) {
      const candidates = (dealsCols as { Field: string }[])
        .map(x => x.Field)
        .filter(f => IDENT_RE.test(f) && /type|kind|source|origin|table|deliver|takeaway|club|station|pos/i.test(f))
        .slice(0, 8)
      for (const f of candidates) {
        channelFlags[f] = await safe(`deals.${f}`, () => pizzaHouseQuery(
          `SELECT \`${f}\` as v, COUNT(*) as deals FROM deals
           WHERE tm_open >= ? AND tm_open < ? GROUP BY \`${f}\`
           ORDER BY deals DESC LIMIT 15`, [FROM, TO]))
      }
    }

    return { branch, depth, returning, delivery, huntCols, tables, dealsCols, fillRates, channelFlags }
  })

  return NextResponse.json(data)
}
